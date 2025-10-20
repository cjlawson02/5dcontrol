package camera

import (
	"fmt"
	"log"
	_ "net/http/pprof"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cjlawson02/5dcontrol/server/gphoto2"
)

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
	pausePreview   chan bool
	batteryLevel   atomic.Uint32
	batteryQuit    chan struct{}
}

// Compile-time check to ensure RealCamera implements CameraController
var _ CameraController = (*RealCamera)(nil)

var (
	framePool = sync.Pool{
		New: func() any {
			return new(Frame)
		},
	}
)

func NewRealCamera() *RealCamera {
	return &RealCamera{
		disconnectedCh: make(chan struct{}),
		isConnected:    atomic.Bool{},
	}
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
	manager.disconnectedCh = make(chan struct{}) // Create new channel for new connection
	manager.isConnected.Store(true)

	// Initialize battery level
	manager.updateBatteryLevel()

	// Start periodic battery level updates
	manager.batteryQuit = make(chan struct{})
	go manager.runBatteryUpdateLoop()

	return nil
}

func (manager *RealCamera) AddClient(id string) {
	if !manager.isConnected.Load() {
		return // Don't start capture if camera is not connected
	}

	if _, loaded := manager.clients.LoadOrStore(id, struct{}{}); !loaded {
		// First client - start capture
		if !manager.capturing.Swap(true) {
			manager.captureQuit = make(chan struct{})
			go manager.RunCaptureLoop()
		}
	}
}

func (manager *RealCamera) RemoveClient(id string) {
	if _, loaded := manager.clients.LoadAndDelete(id); loaded {
		// Check if this was the last client
		empty := true
		manager.clients.Range(func(key, value any) bool {
			empty = false
			return false
		})

		if empty {
			// Last client disconnected - stop capture
			if manager.capturing.Swap(false) {
				close(manager.captureQuit)
			}
		}
	}
}

func (manager *RealCamera) CaptureImage() error {
	if !manager.isConnected.Load() {
		return fmt.Errorf("camera is not connected")
	}

	manager.pausePreview <- true // request pause

	err := manager.camera.Capture(manager.ctx)

	manager.pausePreview <- false
	return err
}

// TriggerFocus attempts to trigger autofocus on the camera
func (manager *RealCamera) TriggerFocus() error {
	if !manager.isConnected.Load() {
		return fmt.Errorf("camera is not connected")
	}

	// Try to trigger autofocus by setting focus mode to auto and back
	// This is a workaround since GPhoto2 doesn't have direct autofocus trigger
	originalMode, err := manager.camera.GetConfigValueString("afmode", manager.ctx)
	if err != nil {
		log.Printf("Could not get current AF mode: %v", err)
		// Continue anyway, as this might not be critical
	}

	// Try to set AF mode to trigger autofocus
	// Different cameras may use different config keys
	afKeys := []string{"afmode", "autofocus", "focusmode", "focus"}
	afValues := []string{"Auto", "On", "AF", "Single"}

	for i, key := range afKeys {
		if err := manager.camera.SetConfigValueString(key, afValues[i], manager.ctx); err == nil {
			log.Printf("Successfully set %s to %s", key, afValues[i])
			break
		}
	}

	// Restore original mode if we changed it
	if originalMode != "" {
		time.Sleep(100 * time.Millisecond) // Brief delay
		manager.camera.SetConfigValueString("afmode", originalMode, manager.ctx)
	}

	return nil
}

func (manager *RealCamera) RunCaptureLoop() {
	if !manager.isConnected.Load() {
		return // Don't run capture loop if camera is not connected
	}

	file, err := manager.camera.File()
	if err != nil {
		log.Fatal("failed to create CameraFile")
	}
	defer file.Close()

	var frameCount int
	var start = time.Now()

	for manager.capturing.Load() {
		select {
		case <-manager.captureQuit:
			return
		case pause := <-manager.pausePreview:
			if pause {
				<-manager.pausePreview // wait for resume
			}
		default:
			if err := manager.camera.CapturePreview(file, manager.ctx); err != nil {
				log.Printf("CapturePreview failed: %v", err)
				if err.Error() == "Could not find the requested device on the USB port" {
					manager.handleDisconnect()
					return
				}
				time.Sleep(1 * time.Second)
				continue
			}

			data, size, err := file.GetDataAndSize()
			if err != nil {
				log.Printf("Failed to get data: %v", err)
				if err.Error() == "Could not find the requested device on the USB port" {
					manager.handleDisconnect()
					return
				}
				time.Sleep(1 * time.Second)
				continue
			}

			frame := framePool.Get().(*Frame)

			// reuse buffer if capacity is enough
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
	// Only handle disconnect once
	if !manager.isConnected.Swap(false) {
		return // Already disconnected
	}

	// Stop battery update loop
	if manager.batteryQuit != nil {
		close(manager.batteryQuit)
		manager.batteryQuit = nil
	}

	if manager.camera != nil {
		manager.camera.Close()
		manager.ctx.Close()
		manager.camera = nil
		manager.ctx = nil
	}
	// Clear the latest frame to prevent showing stale frames
	if old := manager.LatestFrame.Swap(nil); old != nil {
		framePool.Put(old)
	}
	close(manager.disconnectedCh)
}

func (manager *RealCamera) Close() {
	if manager.camera != nil {
		log.Println("Releasing camera...")
		if err := manager.camera.Exit(manager.ctx); err != nil {
			log.Printf("Failed to exit camera: %v", err)
		}
		manager.handleDisconnect()
		time.Sleep(1 * time.Second) // allow USB flush
	}
}

// GetBatteryLevel returns the current battery level as a percentage (0-100)
func (manager *RealCamera) GetBatteryLevel() uint8 {
	return uint8(manager.batteryLevel.Load())
}

// updateBatteryLevel reads the battery level from the camera and updates the stored value
func (manager *RealCamera) updateBatteryLevel() {
	if !manager.isConnected.Load() || manager.camera == nil || manager.ctx == nil {
		manager.batteryLevel.Store(0)
		return
	}

	// Try different battery level configuration keys that might be used by Canon 5D Mark III
	batteryKeys := []string{
		"/main/status/batterylevel",
		"/main/status/battery",
		"/main/status/batteryvoltage",
		"batterylevel",
		"battery",
		"batteryvoltage",
	}

	var batteryLevel uint32 = 0

	for _, key := range batteryKeys {
		value, err := manager.camera.GetConfigValueString(key, manager.ctx)
		if err != nil {
			log.Printf("Failed to read battery level with key '%s': %v", key, err)
			continue
		}

		// Try to parse as integer
		if level, parseErr := strconv.ParseUint(value, 10, 32); parseErr == nil {
			batteryLevel = uint32(level)
			log.Printf("Successfully read battery level: %d%% using key '%s'", batteryLevel, key)
			break
		}

		// Try to parse as float and convert to percentage
		if level, parseErr := strconv.ParseFloat(value, 64); parseErr == nil {
			// Some cameras return voltage or normalized values
			if level <= 1.0 {
				// Normalized value (0.0-1.0)
				batteryLevel = uint32(level * 100)
			} else if level <= 10.0 {
				// Voltage value (assume 7.2V is 100%)
				batteryLevel = uint32((level / 7.2) * 100)
			} else {
				// Direct percentage
				batteryLevel = uint32(level)
			}
			log.Printf("Successfully read battery level: %d%% using key '%s' (parsed from %s)", batteryLevel, key, value)
			break
		}

		log.Printf("Could not parse battery level value '%s' from key '%s'", value, key)
	}

	// Clamp battery level to 0-100 range
	if batteryLevel > 100 {
		batteryLevel = 100
	}

	manager.batteryLevel.Store(batteryLevel)

	// If we couldn't read any battery level, set to 0
	if batteryLevel == 0 {
		log.Printf("Failed to read battery level from camera")
	}
}

// runBatteryUpdateLoop periodically updates the battery level
func (manager *RealCamera) runBatteryUpdateLoop() {
	ticker := time.NewTicker(30 * time.Second) // Update every 30 seconds
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
