package camera

import (
	"errors"
	"fmt"
	"log"
	_ "net/http/pprof"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cjlawson02/5dcontrol/server/gphoto2"
)

type cameraCommand struct {
	command  func() (any, error)
	response chan any
	err      chan error
}

// RealCamera implements CameraController for real camera hardware via GPhoto2
type RealCamera struct {
	camera         *gphoto2.Camera
	ctx            *gphoto2.Context
	LatestFrame    atomic.Pointer[Frame]
	clients        sync.Map
	captureQuit    chan struct{}
	capturing      atomic.Bool
	isConnected    atomic.Bool
	disconnectedCh chan struct{}
	previewPaused  atomic.Bool // used by MockCamera embed; real path uses PreviewManager
	previewMutex   sync.Mutex
	batteryLevel   atomic.Uint32
	batteryQuit    chan struct{}

	stateMachine   *StateMachine
	previewManager *PreviewManager
	commandChannel chan cameraCommand

	previewWG    sync.WaitGroup
	workerWG     sync.WaitGroup
	shuttingDown atomic.Bool
	closeOnce    sync.Once

	// completionMode selects how CaptureImage decides it is done.
	completionMode CompletionMode
	// eventWaitTimeout bounds WaitEvent draining after capture (modes B/hybrid).
	eventWaitTimeout time.Duration

	// lastCapture caches the most recent still for HTTP serve + WS notify.
	lastCapture *CaptureStore
}

// Compile-time check to ensure RealCamera implements CameraController
var _ CameraController = (*RealCamera)(nil)
var _ OperationManager = (*RealCamera)(nil)
var _ SettingsController = (*RealCamera)(nil)

var (
	framePool = sync.Pool{
		New: func() any {
			return new(Frame)
		},
	}
)

func NewRealCamera() *RealCamera {
	return &RealCamera{
		disconnectedCh:   make(chan struct{}),
		isConnected:      atomic.Bool{},
		completionMode:   CompletionCommandReturn,
		eventWaitTimeout: 5 * time.Second,
		lastCapture:      NewCaptureStore(),
	}
}

// GetLastCapture returns the most recent cached still, or nil.
func (manager *RealCamera) GetLastCapture() *CachedCapture {
	if manager == nil || manager.lastCapture == nil {
		return nil
	}
	return manager.lastCapture.Latest()
}

// SetCompletionMode selects capture completion strategy (for benches / experiments).
func (manager *RealCamera) SetCompletionMode(mode CompletionMode) {
	manager.completionMode = mode
}

// CompletionMode returns the current capture completion strategy.
func (manager *RealCamera) CompletionMode() CompletionMode {
	return manager.completionMode
}

func (manager *RealCamera) Connect() error {
	if manager.isConnected.Load() {
		return nil
	}

	ctx := gphoto2.NewContext()
	if ctx == nil {
		return fmt.Errorf("failed to create camera context")
	}

	camera, err := gphoto2.NewCamera()
	if err != nil {
		ctx.Close()
		return fmt.Errorf("failed to create camera: %w", err)
	}

	if err := camera.Init(ctx); err != nil {
		camera.Close()
		ctx.Close()
		return fmt.Errorf("failed to initialize camera: %w", err)
	}

	_ = camera.SetConfigValueString("capturetarget", "Memory card", ctx)
	_ = camera.SetConfigValueString("reviewtime", "None", ctx)

	manager.camera = camera
	manager.ctx = ctx
	manager.captureQuit = make(chan struct{})
	manager.disconnectedCh = make(chan struct{})

	manager.stateMachine = &StateMachine{}
	cmdCh := make(chan cameraCommand)
	manager.commandChannel = cmdCh
	manager.previewManager = NewPreviewManager()
	// Allow Close to run again after a previous disconnect/reconnect cycle.
	manager.closeOnce = sync.Once{}
	manager.shuttingDown.Store(false)

	manager.workerWG.Add(1)
	go func(ch chan cameraCommand) {
		defer manager.workerWG.Done()
		cameraWorker(ch)
	}(cmdCh)

	manager.isConnected.Store(true)

	// Battery via worker (serialized with other USB traffic)
	manager.updateBatteryLevel()
	manager.batteryQuit = make(chan struct{})
	go manager.runBatteryUpdateLoop()

	return nil
}

func (manager *RealCamera) AddClient(id string) {
	if !manager.isConnected.Load() || manager.shuttingDown.Load() {
		return
	}

	if _, loaded := manager.clients.LoadOrStore(id, struct{}{}); !loaded {
		if !manager.capturing.Swap(true) {
			manager.captureQuit = make(chan struct{})
			manager.previewWG.Add(1)
			go func() {
				defer manager.previewWG.Done()
				manager.RunCaptureLoop()
			}()
		}
	}
}

func (manager *RealCamera) RemoveClient(id string) {
	manager.clients.Delete(id)

	empty := true
	manager.clients.Range(func(_, _ any) bool {
		empty = false
		return false
	})

	if empty {
		manager.stopPreviewAndWait()
	}
}

// stopPreviewAndWait signals the preview loop to exit and waits for it.
func (manager *RealCamera) stopPreviewAndWait() {
	if manager.capturing.Swap(false) {
		if manager.captureQuit != nil {
			select {
			case <-manager.captureQuit:
				// already closed
			default:
				close(manager.captureQuit)
			}
		}
	}
	// Unblock a paused preview loop waiting on resume.
	if manager.previewManager != nil {
		manager.previewManager.resumePreview()
	}
	manager.previewWG.Wait()
}

// runExclusive pauses preview, marks the camera busy, runs fn on the USB worker, then resumes.
func (manager *RealCamera) runExclusive(opType OperationType, fn func() (any, error)) (*OperationResult, error) {
	if manager.stateMachine == nil || !manager.isConnected.Load() {
		return nil, ErrNotConnected
	}
	if err := manager.stateMachine.StartOperation(opType, manager.previewManager); err != nil {
		return nil, err
	}

	start := time.Now()
	opID := manager.stateMachine.ActiveOpID()

	result, err := manager.execOnWorker(fn)

	manager.stateMachine.CompleteOperation()
	if manager.previewManager != nil {
		manager.previewManager.resumePreview()
	}

	status := OperationStatusSuccess
	if err != nil {
		status = OperationStatusFailed
	}

	return &OperationResult{
		OperationID: opID,
		Type:        opType,
		Status:      status,
		Error:       err,
		Duration:    time.Since(start),
		Data:        result,
	}, err
}

func (manager *RealCamera) execOnWorker(fn func() (any, error)) (any, error) {
	if manager.shuttingDown.Load() || manager.commandChannel == nil {
		return nil, ErrNotConnected
	}

	cmd := cameraCommand{
		command:  fn,
		response: make(chan any, 1),
		err:      make(chan error, 1),
	}
	if !manager.trySendCommand(cmd) {
		return nil, ErrNotConnected
	}

	select {
	case err := <-cmd.err:
		return nil, err
	case res := <-cmd.response:
		return res, nil
	}
}

func (manager *RealCamera) trySendCommand(cmd cameraCommand) (ok bool) {
	defer func() {
		if recover() != nil {
			ok = false
		}
	}()
	ch := manager.commandChannel
	if ch == nil || manager.shuttingDown.Load() {
		return false
	}
	ch <- cmd
	return true
}

// CaptureImage takes a still using the configured CompletionMode.
// On success it downloads the file (when possible) into lastCapture for HTTP/WS.
func (manager *RealCamera) CaptureImage() (*OperationResult, error) {
	if manager.stateMachine == nil || !manager.isConnected.Load() {
		return nil, ErrNotConnected
	}
	if err := manager.stateMachine.StartOperation(OperationCapture, manager.previewManager); err != nil {
		return nil, err
	}

	start := time.Now()
	opID := manager.stateMachine.ActiveOpID()
	timing := &CaptureTiming{Mode: manager.completionMode}

	var captureErr error
	var path *gphoto2.CameraFilePath

	// Phase 1: always run Capture() on the worker and record when it returns.
	res, captureErr := manager.execOnWorker(func() (any, error) {
		return manager.camera.Capture(manager.ctx)
	})
	timing.CommandReturnAt = time.Since(start)
	if captureErr == nil {
		path, _ = res.(*gphoto2.CameraFilePath)
	}

	if captureErr != nil {
		timing.Success = false
		timing.Error = captureErr.Error()
		timing.DoneAt = time.Since(start)
		manager.finishOp(false)
		return &OperationResult{
			OperationID: opID,
			Type:        OperationCapture,
			Status:      OperationStatusFailed,
			Error:       captureErr,
			Duration:    timing.DoneAt,
			Timing:      timing,
		}, captureErr
	}

	// Phase 2: optional event wait (modes B / hybrid).
	switch manager.completionMode {
	case CompletionCommandReturn:
		// done
	case CompletionWaitEvent, CompletionHybrid:
		manager.drainCaptureEvents(start, timing)
	}

	var cached *CachedCapture
	if path != nil && path.Name != "" {
		jpegBytes, dlErr := manager.downloadCaptureJPEG(path)
		if dlErr != nil {
			log.Printf("Capture download failed (%s/%s): %v — falling back to preview frame", path.Folder, path.Name, dlErr)
			jpegBytes = manager.previewFrameCopy()
		}
		if len(jpegBytes) > 0 {
			var storeErr error
			cached, storeErr = StoreJPEGCapture(manager.lastCapture, jpegBytes)
			if storeErr != nil {
				log.Printf("Failed to cache capture JPEG: %v", storeErr)
			}
		}
	} else if frame := manager.previewFrameCopy(); len(frame) > 0 {
		var storeErr error
		cached, storeErr = StoreJPEGCapture(manager.lastCapture, frame)
		if storeErr != nil {
			log.Printf("Failed to cache preview fallback JPEG: %v", storeErr)
		}
	}

	timing.DoneAt = time.Since(start)
	timing.Success = true
	manager.finishOp(true)

	return &OperationResult{
		OperationID: opID,
		Type:        OperationCapture,
		Status:      OperationStatusSuccess,
		Duration:    timing.DoneAt,
		Timing:      timing,
		Data:        cached,
	}, nil
}

func (manager *RealCamera) previewFrameCopy() []byte {
	frame := manager.GetLatestFrame()
	if frame == nil || len(frame.Data) == 0 {
		return nil
	}
	out := make([]byte, len(frame.Data))
	copy(out, frame.Data)
	return out
}

// downloadCaptureJPEG pulls the still from the camera card.
// Prefers NORMAL for .jpg/.jpeg; for RAW-looking names tries PREVIEW first.
func (manager *RealCamera) downloadCaptureJPEG(path *gphoto2.CameraFilePath) ([]byte, error) {
	if path == nil {
		return nil, fmt.Errorf("nil capture path")
	}
	nameLower := strings.ToLower(path.Name)
	isJPEG := strings.HasSuffix(nameLower, ".jpg") || strings.HasSuffix(nameLower, ".jpeg")

	tryTypes := []gphoto2.CameraFileType{gphoto2.FILE_TYPE_NORMAL}
	if !isJPEG {
		tryTypes = []gphoto2.CameraFileType{gphoto2.FILE_TYPE_PREVIEW, gphoto2.FILE_TYPE_NORMAL}
	}

	var lastErr error
	for _, ft := range tryTypes {
		data, err := manager.execOnWorker(func() (any, error) {
			file, err := manager.camera.File()
			if err != nil {
				return nil, err
			}
			defer file.Close()
			if err := manager.camera.FileGet(path.Folder, path.Name, ft, file, manager.ctx); err != nil {
				return nil, err
			}
			bytes, _, err := file.GetDataAndSize()
			if err != nil {
				return nil, err
			}
			out := make([]byte, len(bytes))
			copy(out, bytes)
			return out, nil
		})
		if err != nil {
			lastErr = err
			continue
		}
		jpegBytes, _ := data.([]byte)
		if len(jpegBytes) == 0 {
			lastErr = fmt.Errorf("empty file data")
			continue
		}
		// Reject obvious non-JPEG if we can sniff SOI.
		if len(jpegBytes) >= 2 && jpegBytes[0] == 0xff && jpegBytes[1] == 0xd8 {
			return jpegBytes, nil
		}
		if isJPEG || ft == gphoto2.FILE_TYPE_PREVIEW {
			// Some firmwares omit SOI in edge cases; still return if caller asked for JPEG/preview.
			return jpegBytes, nil
		}
		lastErr = fmt.Errorf("downloaded data is not JPEG")
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no download attempts succeeded")
	}
	return nil, lastErr
}

func (manager *RealCamera) finishOp(success bool) {
	manager.stateMachine.CompleteOperation()
	if manager.previewManager != nil {
		manager.previewManager.resumePreview()
	}
	if !success {
		log.Println("Capture operation finished with error")
	}
}

// drainCaptureEvents waits for FileAdded / CaptureComplete (or timeout).
func (manager *RealCamera) drainCaptureEvents(start time.Time, timing *CaptureTiming) {
	deadline := time.Now().Add(manager.eventWaitTimeout)
	gotUseful := false

	for time.Now().Before(deadline) {
		remaining := time.Until(deadline)
		timeoutMs := int(remaining / time.Millisecond)
		if timeoutMs < 1 {
			timeoutMs = 1
		}
		if timeoutMs > 500 {
			timeoutMs = 500 // keep loop responsive
		}

		res, err := manager.execOnWorker(func() (any, error) {
			eventType, eventData, err := manager.camera.WaitEvent(timeoutMs, manager.ctx)
			if err != nil {
				return nil, err
			}
			return map[string]any{"type": eventType, "data": eventData}, nil
		})
		if err != nil {
			log.Printf("WaitEvent during capture drain: %v", err)
			continue
		}

		payload, _ := res.(map[string]any)
		eventType, _ := payload["type"].(gphoto2.CameraEventType)
		name := eventName(eventType)
		if eventType != gphoto2.EventTimeout {
			timing.EventsSeen = append(timing.EventsSeen, name)
		}

		useful := eventType == gphoto2.EventFileAdded || eventType == gphoto2.EventCaptureComplete
		if useful && !gotUseful {
			gotUseful = true
			elapsed := time.Since(start)
			timing.FirstUsefulEventAt = elapsed
			timing.FirstUsefulEvent = name
			// Mode B: done on first useful event.
			if manager.completionMode == CompletionWaitEvent {
				return
			}
			// Hybrid: record event, keep draining briefly for sibling events, then return.
			if manager.completionMode == CompletionHybrid {
				// short extra drain window
				extraDeadline := time.Now().Add(300 * time.Millisecond)
				for time.Now().Before(extraDeadline) {
					res2, err2 := manager.execOnWorker(func() (any, error) {
						et, _, err := manager.camera.WaitEvent(50, manager.ctx)
						return et, err
					})
					if err2 != nil {
						break
					}
					et, _ := res2.(gphoto2.CameraEventType)
					if et != gphoto2.EventTimeout {
						timing.EventsSeen = append(timing.EventsSeen, eventName(et))
					}
				}
				return
			}
		}
	}

	if !gotUseful {
		log.Printf("No FileAdded/CaptureComplete within %s (mode=%s)", manager.eventWaitTimeout, manager.completionMode)
	}
}

func eventName(t gphoto2.CameraEventType) string {
	switch t {
	case gphoto2.EventUnknown:
		return "unknown"
	case gphoto2.EventTimeout:
		return "timeout"
	case gphoto2.EventFileAdded:
		return "file-added"
	case gphoto2.EventFolderAdded:
		return "folder-added"
	case gphoto2.EventCaptureComplete:
		return "capture-complete"
	case gphoto2.EventFileChanged:
		return "file-changed"
	default:
		return fmt.Sprintf("event(%d)", int(t))
	}
}

// TriggerFocus attempts to trigger autofocus on the camera.
// Positioned AF on the 5D III is best-effort: coords are logged, then the
// existing center AF drive runs.
func (manager *RealCamera) TriggerFocus(req FocusRequest) (*OperationResult, error) {
	return manager.runExclusive(OperationFocus, func() (any, error) {
		if req.HasPoint {
			x, y := ClampFocusPoint(req.X, req.Y)
			log.Printf("Focus point (%.3f, %.3f) received; 5D III AF-point selection is best-effort — using body AF drive", x, y)
		}
		if err := manager.camera.SetConfigValueString("capture", "1", manager.ctx); err != nil {
			return nil, err
		}
		defer func() {
			_ = manager.camera.SetConfigValueString("cancelautofocus", "1", manager.ctx)
			_ = manager.camera.SetConfigValueString("capture", "0", manager.ctx)
		}()

		if err := manager.camera.SetConfigValueString("autofocusdrive", "1", manager.ctx); err != nil {
			return nil, err
		}

		const (
			pollInterval        = 100 * time.Millisecond
			stableReadsRequired = 2
		)
		var last string
		stable := 0
		deadline := time.Now().Add(5 * time.Second)

		for time.Now().Before(deadline) {
			val, err := manager.camera.GetConfigValueString("focusinfo", manager.ctx)
			if err != nil {
				return nil, fmt.Errorf("focusinfo not available: %w", err)
			}

			trim := strings.TrimSpace(val)
			if trim == "" || trim == "{}" {
				stable = 0
				last = trim
				time.Sleep(pollInterval)
				continue
			}

			if trim == last {
				stable++
				if stable >= stableReadsRequired {
					return nil, nil
				}
			} else {
				stable = 1
			}
			last = trim
			time.Sleep(pollInterval)
		}

		return nil, fmt.Errorf("focus timed out waiting for stable focusinfo")
	})
}

func cameraWorker(ch chan cameraCommand) {
	if ch == nil {
		return
	}
	for cmd := range ch {
		res, err := cmd.command()
		if err != nil {
			cmd.err <- err
		} else {
			cmd.response <- res
		}
	}
}

func (manager *RealCamera) RunCaptureLoop() {
	if !manager.isConnected.Load() || manager.shuttingDown.Load() {
		return
	}
	if manager.previewManager == nil || manager.camera == nil {
		return
	}

	file, err := manager.camera.File()
	if err != nil {
		log.Printf("failed to create CameraFile: %v", err)
		return
	}
	defer file.Close()

	var frameCount int
	var start = time.Now()

	for manager.capturing.Load() && manager.isConnected.Load() && !manager.shuttingDown.Load() {
		select {
		case <-manager.captureQuit:
			return
		default:
		}

		// Pause handling: also wake on quit so Close can't deadlock.
		select {
		case <-manager.captureQuit:
			return
		case <-manager.previewManager.pauseChannel:
			log.Println("RunCaptureLoop: Paused.")
			select {
			case <-manager.captureQuit:
				return
			case <-manager.previewManager.resumeChannel:
				log.Println("RunCaptureLoop: Resumed.")
			}
			continue
		default:
		}

		if manager.camera == nil || manager.shuttingDown.Load() {
			return
		}

		_, err := manager.execOnWorker(func() (any, error) {
			if manager.camera == nil || manager.ctx == nil {
				return nil, ErrNotConnected
			}
			return nil, manager.camera.CapturePreview(file, manager.ctx)
		})
		if err != nil {
			if errors.Is(err, ErrNotConnected) || manager.shuttingDown.Load() {
				return
			}
			log.Printf("CapturePreview failed: %v", err)
			if strings.Contains(err.Error(), "Could not find the requested device on the USB port") {
				manager.handleDisconnect()
				return
			}
			time.Sleep(1 * time.Second)
			continue
		}

		data, size, err := file.GetDataAndSize()
		if err != nil {
			log.Printf("Failed to get data: %v", err)
			if strings.Contains(err.Error(), "Could not find the requested device on the USB port") {
				manager.handleDisconnect()
				return
			}
			time.Sleep(1 * time.Second)
			continue
		}

		frame := framePool.Get().(*Frame)
		if cap(frame.Data) < size {
			frame.Data = make([]byte, size)
		} else {
			frame.Data = frame.Data[:size]
		}
		copy(frame.Data, data)
		frame.Timestamp = time.Now()

		old := manager.LatestFrame.Swap(frame)
		if old != nil {
			framePool.Put(old)
		}

		frameCount++
		if time.Since(start) >= 3*time.Second {
			fps := float64(frameCount) / time.Since(start).Seconds()
			log.Printf("Average FPS: %.2f", fps)
			frameCount = 0
			start = time.Now()
		}
	}
}

func (manager *RealCamera) DisconnectedCh() <-chan struct{} {
	return manager.disconnectedCh
}

func (manager *RealCamera) IsConnected() bool {
	return manager.isConnected.Load()
}

func (manager *RealCamera) GetLatestFrame() *Frame {
	return manager.LatestFrame.Load()
}

func (manager *RealCamera) handleDisconnect() {
	// Always async: Close waits on previewWG, and USB errors are often detected
	// inside RunCaptureLoop (which holds that WaitGroup).
	go manager.Close()
}

func (manager *RealCamera) Close() {
	manager.closeOnce.Do(func() {
		log.Println("Releasing camera...")
		manager.shuttingDown.Store(true)
		manager.isConnected.Store(false)

		// Stop periodic battery reads first.
		if manager.batteryQuit != nil {
			close(manager.batteryQuit)
			manager.batteryQuit = nil
		}

		// Stop preview and wait so CapturePreview cannot race Exit/Free.
		manager.clients.Range(func(key, _ any) bool {
			manager.clients.Delete(key)
			return true
		})
		manager.stopPreviewAndWait()

		// Stop the worker before touching native camera memory.
		ch := manager.commandChannel
		manager.commandChannel = nil
		if ch != nil {
			close(ch)
		}
		manager.workerWG.Wait()

		// No concurrent USB users remain; exit + free safely.
		if manager.camera != nil && manager.ctx != nil {
			if err := manager.camera.Exit(manager.ctx); err != nil {
				log.Printf("Failed to exit camera: %v", err)
			}
		}
		if manager.camera != nil {
			if err := manager.camera.Close(); err != nil {
				log.Printf("Failed to free camera: %v", err)
			}
			manager.camera = nil
		}
		if manager.ctx != nil {
			manager.ctx.Close()
			manager.ctx = nil
		}

		if old := manager.LatestFrame.Swap(nil); old != nil {
			framePool.Put(old)
		}

		if manager.disconnectedCh != nil {
			select {
			case <-manager.disconnectedCh:
			default:
				close(manager.disconnectedCh)
			}
		}
	})
}

func (manager *RealCamera) GetBatteryLevel() uint8 {
	return uint8(manager.batteryLevel.Load())
}

func (manager *RealCamera) updateBatteryLevel() {
	if !manager.isConnected.Load() || manager.shuttingDown.Load() || manager.camera == nil || manager.ctx == nil {
		return
	}
	if manager.commandChannel == nil || manager.stateMachine == nil {
		return
	}
	// Never touch USB off-worker. If busy, skip until the next tick.
	if manager.stateMachine.GetState() != StateIdle {
		return
	}

	res, err := manager.runExclusive(OperationSettings, func() (any, error) {
		return manager.camera.GetConfigValueString("batterylevel", manager.ctx)
	})
	if err != nil {
		log.Printf("Battery read skipped/failed: %v", err)
		return
	}
	value, _ := res.Data.(string)
	manager.storeBatteryString(value)
}

func (manager *RealCamera) storeBatteryString(value string) {
	var batteryLevel uint32
	cleanValue := value
	if len(value) > 0 && value[len(value)-1] == '%' {
		cleanValue = value[:len(value)-1]
	}
	if level, parseErr := strconv.ParseUint(cleanValue, 10, 32); parseErr == nil {
		batteryLevel = uint32(level)
		log.Printf("Battery level: %d%%", batteryLevel)
	}
	manager.batteryLevel.Store(batteryLevel)
}

func (manager *RealCamera) runBatteryUpdateLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-manager.batteryQuit:
			return
		case <-ticker.C:
			manager.updateBatteryLevel()
		}
	}
}
