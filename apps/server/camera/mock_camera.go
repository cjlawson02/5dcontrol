package camera

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"log"
	"sync"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// mockCameraDevice simulates a camera for demo/testing purposes
type mockCameraDevice struct {
	frameCount int
}

func newMockCameraDevice() *mockCameraDevice {
	return &mockCameraDevice{frameCount: 0}
}

// GenerateFrame creates a synthetic preview frame
func (m *mockCameraDevice) GenerateFrame() ([]byte, error) {
	m.frameCount++
	return m.encodeFrame(1920, 1080, "DEMO MODE", "Mock Camera", time.Now().Format("15:04:05"))
}

// GenerateCaptureStill creates a distinct still used after CaptureImage.
func (m *mockCameraDevice) GenerateCaptureStill() ([]byte, error) {
	m.frameCount++
	stamp := time.Now().Format("15:04:05.000")
	return m.encodeFrame(1280, 720, "CAPTURED", "Mock Still", stamp)
}

func (m *mockCameraDevice) encodeFrame(width, height int, line1, line2, line3 string) ([]byte, error) {
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r := uint8((x + m.frameCount) % 256)
			g := uint8((y + m.frameCount/2) % 256)
			b := uint8(((x + y + m.frameCount) / 2) % 256)
			img.Set(x, y, color.RGBA{r, g, b, 255})
		}
	}

	addLabel(img, width/2-300, height/2-50, line1)
	addLabel(img, width/2-200, height/2+50, line2)
	addLabel(img, width/2-150, height/2+150, line3)

	buf := new(bytes.Buffer)
	if err := jpeg.Encode(buf, img, &jpeg.Options{Quality: 85}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func addLabel(img *image.RGBA, x, y int, label string) {
	scale := 8
	charWidth := 7 * scale
	point := fixed.Point26_6{X: fixed.I(0), Y: fixed.I(13)}

	for i, char := range label {
		charImg := image.NewRGBA(image.Rect(0, 0, 7, 13))
		d := &font.Drawer{
			Dst:  charImg,
			Src:  image.NewUniform(color.RGBA{255, 255, 255, 255}),
			Face: basicfont.Face7x13,
			Dot:  point,
		}
		d.DrawString(string(char))

		offsetX := x + i*charWidth
		for sy := 0; sy < 13; sy++ {
			for sx := 0; sx < 7; sx++ {
				if charImg.At(sx, sy) != (color.RGBA{0, 0, 0, 0}) {
					for dy := 0; dy < scale; dy++ {
						for dx := 0; dx < scale; dx++ {
							px := offsetX + sx*scale + dx
							py := y + sy*scale + dy
							if px >= 0 && px < img.Bounds().Dx() && py >= 0 && py < img.Bounds().Dy() {
								img.Set(px, py, color.RGBA{255, 255, 255, 255})
							}
						}
					}
				}
			}
		}
	}
}

// MockCamera wraps RealCamera for demo/testing without hardware.
type MockCamera struct {
	*RealCamera
	mockCam         *mockCameraDevice
	settingsMu      sync.Mutex
	currentSettings CameraSettings
	// Simulated delay between Capture() return and a "file-added" event.
	// Used by completion bench in demo mode to show A vs B differences.
	simulatedEventLag time.Duration
}

var _ CameraController = (*MockCamera)(nil)
var _ SettingsController = (*MockCamera)(nil)

// NewMockCamera creates a camera controller that uses mock camera
func NewMockCamera() *MockCamera {
	return &MockCamera{
		RealCamera: NewRealCamera(),
		mockCam:    newMockCameraDevice(),
		currentSettings: CameraSettings{
			ShutterSpeed:         "1/125",
			Aperture:             "f/5.6",
			ISO:                  "400",
			ExposureCompensation: "0",
			AutoExposureMode:     "Manual",
		},
		simulatedEventLag: 200 * time.Millisecond,
	}
}

// Connect simulates camera connection and sets up the exclusive worker path.
func (m *MockCamera) Connect() error {
	log.Println("Mock camera: Simulating connection...")
	m.stateMachine = &StateMachine{}
	cmdCh := make(chan cameraCommand, 8)
	m.commandChannel = cmdCh
	m.previewManager = NewPreviewManager()
	m.captureQuit = make(chan struct{})
	m.disconnectedCh = make(chan struct{})
	m.batteryLevel.Store(85)
	m.shuttingDown.Store(false)
	m.closeOnce = sync.Once{}
	m.workerWG.Add(1)
	go func(ch chan cameraCommand) {
		defer m.workerWG.Done()
		cameraWorker(ch)
	}(cmdCh)
	m.isConnected.Store(true)
	return nil
}

// RunMockCaptureLoop generates synthetic frames
func (m *MockCamera) RunMockCaptureLoop() {
	log.Println("Mock camera: Starting capture loop...")

	var frameCount int
	var start = time.Now()
	ticker := time.NewTicker(33 * time.Millisecond)
	defer ticker.Stop()

	for m.capturing.Load() && !m.shuttingDown.Load() {
		select {
		case <-m.captureQuit:
			log.Println("Mock camera: Capture loop stopped")
			return
		case <-ticker.C:
			if m.previewManager != nil {
				select {
				case <-m.captureQuit:
					return
				case <-m.previewManager.pauseChannel:
					log.Println("Mock camera: Preview paused")
					select {
					case <-m.captureQuit:
						return
					case <-m.previewManager.resumeChannel:
						log.Println("Mock camera: Preview resumed")
					}
					continue
				default:
				}
			}
			if m.previewPaused.Load() {
				continue
			}

			data, err := m.mockCam.GenerateFrame()
			if err != nil {
				log.Printf("Mock camera: Failed to generate frame: %v", err)
				continue
			}

			frame := framePool.Get().(*Frame)
			if cap(frame.Data) < len(data) {
				frame.Data = make([]byte, len(data))
			} else {
				frame.Data = frame.Data[:len(data)]
			}
			copy(frame.Data, data)
			frame.Timestamp = time.Now()

			old := m.LatestFrame.Swap(frame)
			if old != nil {
				framePool.Put(old)
			}

			frameCount++
			if time.Since(start) >= 3*time.Second {
				fps := float64(frameCount) / time.Since(start).Seconds()
				log.Printf("Mock camera FPS: %.2f", fps)
				frameCount = 0
				start = time.Now()
			}
		}
	}
}

// AddClient starts the mock capture loop when first client connects
func (m *MockCamera) AddClient(id string) {
	if !m.isConnected.Load() || m.shuttingDown.Load() {
		return
	}
	if _, loaded := m.clients.LoadOrStore(id, struct{}{}); !loaded {
		if !m.capturing.Swap(true) {
			m.captureQuit = make(chan struct{})
			m.previewWG.Add(1)
			go func() {
				defer m.previewWG.Done()
				m.RunMockCaptureLoop()
			}()
		}
	}
}

// CaptureImage simulates capture with instrumented completion modes.
// It models Capture() returning before a delayed "file-added" so demo benches
// can show differences between A / B / hybrid.
func (m *MockCamera) CaptureImage() (*OperationResult, error) {
	if m.stateMachine == nil || !m.isConnected.Load() {
		// disconnected: no-op success for tests that call before Connect
		return &OperationResult{
			Type:     OperationCapture,
			Status:   OperationStatusSuccess,
			Duration: 0,
		}, nil
	}
	if err := m.stateMachine.StartOperation(OperationCapture, m.previewManager); err != nil {
		return nil, err
	}

	start := time.Now()
	opID := m.stateMachine.ActiveOpID()
	timing := &CaptureTiming{Mode: m.completionMode}

	// Simulate shutter / Capture() blocking work.
	time.Sleep(100 * time.Millisecond)
	timing.CommandReturnAt = time.Since(start)

	lag := m.simulatedEventLag
	if lag < 0 {
		lag = 0
	}

	switch m.completionMode {
	case CompletionCommandReturn:
		// Done at command return; event would arrive later (not waited).
		timing.DoneAt = time.Since(start)
		timing.Success = true
	case CompletionWaitEvent:
		time.Sleep(lag)
		timing.FirstUsefulEventAt = time.Since(start)
		timing.FirstUsefulEvent = "file-added"
		timing.EventsSeen = []string{"file-added"}
		timing.DoneAt = time.Since(start)
		timing.Success = true
	case CompletionHybrid:
		time.Sleep(lag)
		timing.FirstUsefulEventAt = time.Since(start)
		timing.FirstUsefulEvent = "file-added"
		timing.EventsSeen = []string{"file-added", "capture-complete"}
		timing.DoneAt = time.Since(start)
		timing.Success = true
	}

	var cached *CachedCapture
	if still, err := m.mockCam.GenerateCaptureStill(); err != nil {
		log.Printf("Mock camera: failed to generate capture still: %v", err)
	} else if c, err := StoreJPEGCapture(m.lastCapture, still); err != nil {
		log.Printf("Mock camera: failed to cache capture still: %v", err)
	} else {
		cached = c
	}

	m.stateMachine.CompleteOperation()
	if m.previewManager != nil {
		m.previewManager.resumePreview()
	}

	log.Printf("Mock camera: Capture complete (mode=%s done=%s id=%v)", m.completionMode, timing.DoneAt, cachedID(cached))
	return &OperationResult{
		OperationID: opID,
		Type:        OperationCapture,
		Status:      OperationStatusSuccess,
		Duration:    timing.DoneAt,
		Timing:      timing,
		Data:        cached,
	}, nil
}

func cachedID(c *CachedCapture) string {
	if c == nil {
		return ""
	}
	return c.ID
}

// TriggerFocus simulates triggering autofocus
func (m *MockCamera) TriggerFocus() (*OperationResult, error) {
	if m.stateMachine == nil || !m.isConnected.Load() {
		return &OperationResult{Type: OperationFocus, Status: OperationStatusSuccess}, nil
	}
	return m.runExclusive(OperationFocus, func() (any, error) {
		time.Sleep(50 * time.Millisecond)
		log.Println("Mock camera: Triggering autofocus")
		return nil, nil
	})
}

func (m *MockCamera) GetCurrentSettings() (*CameraSettings, error) {
	m.settingsMu.Lock()
	defer m.settingsMu.Unlock()
	cp := m.currentSettings
	return &cp, nil
}

func (m *MockCamera) GetAvailableSettings() (*AvailableSettings, error) {
	return &AvailableSettings{
		ShutterSpeeds:         []string{"1/60", "1/125", "1/250", "1/500"},
		Apertures:             []string{"f/2.8", "f/4", "f/5.6", "f/8"},
		ISOs:                  []string{"100", "200", "400", "800"},
		ExposureCompensations: []string{"-1", "0", "+1"},
		AutoExposureModes:     []string{"Manual", "Av", "Tv", "P"},
	}, nil
}

func (m *MockCamera) SetShutterSpeed(value string) error {
	_, err := m.runExclusive(OperationSettings, func() (any, error) {
		m.settingsMu.Lock()
		m.currentSettings.ShutterSpeed = value
		m.settingsMu.Unlock()
		time.Sleep(20 * time.Millisecond)
		return nil, nil
	})
	return err
}

func (m *MockCamera) SetAperture(value string) error {
	_, err := m.runExclusive(OperationSettings, func() (any, error) {
		m.settingsMu.Lock()
		m.currentSettings.Aperture = value
		m.settingsMu.Unlock()
		time.Sleep(20 * time.Millisecond)
		return nil, nil
	})
	return err
}

func (m *MockCamera) SetISO(value string) error {
	_, err := m.runExclusive(OperationSettings, func() (any, error) {
		m.settingsMu.Lock()
		m.currentSettings.ISO = value
		m.settingsMu.Unlock()
		time.Sleep(20 * time.Millisecond)
		return nil, nil
	})
	return err
}

func (m *MockCamera) SetExposureCompensation(value string) error {
	_, err := m.runExclusive(OperationSettings, func() (any, error) {
		m.settingsMu.Lock()
		m.currentSettings.ExposureCompensation = value
		m.settingsMu.Unlock()
		time.Sleep(20 * time.Millisecond)
		return nil, nil
	})
	return err
}
