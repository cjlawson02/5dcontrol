package camera

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"log"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// MockCamera simulates a camera for demo/testing purposes
type MockCamera struct {
	frameCount int
}

// NewMockCamera creates a new mock camera instance
func NewMockCamera() *MockCamera {
	return &MockCamera{
		frameCount: 0,
	}
}

// GenerateFrame creates a synthetic preview frame
func (m *MockCamera) GenerateFrame() ([]byte, error) {
	m.frameCount++

	// Create a 1920x1080 image
	width, height := 1920, 1080
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Create a gradient background
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			// Create a subtle animated gradient
			r := uint8((x + m.frameCount) % 256)
			g := uint8((y + m.frameCount/2) % 256)
			b := uint8(((x + y + m.frameCount) / 2) % 256)
			img.Set(x, y, color.RGBA{r, g, b, 255})
		}
	}

	// Draw large text overlays
	addLabel(img, width/2-300, height/2-50, "DEMO MODE")
	addLabel(img, width/2-200, height/2+50, "Mock Camera")
	addLabel(img, width/2-150, height/2+150, time.Now().Format("15:04:05"))

	// Encode to JPEG
	buf := new(bytes.Buffer)
	if err := jpeg.Encode(buf, img, &jpeg.Options{Quality: 85}); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// addLabel adds text to an image
func addLabel(img *image.RGBA, x, y int, label string) {
	// Draw each character scaled up
	scale := 8 // Scale factor for larger text
	charWidth := 7 * scale

	point := fixed.Point26_6{X: fixed.I(0), Y: fixed.I(13)}

	for i, char := range label {
		// Create a small image for the character
		charImg := image.NewRGBA(image.Rect(0, 0, 7, 13))
		d := &font.Drawer{
			Dst:  charImg,
			Src:  image.NewUniform(color.RGBA{255, 255, 255, 255}),
			Face: basicfont.Face7x13,
			Dot:  point,
		}
		d.DrawString(string(char))

		// Scale up and draw to main image
		offsetX := x + i*charWidth
		for sy := 0; sy < 13; sy++ {
			for sx := 0; sx < 7; sx++ {
				if charImg.At(sx, sy) != (color.RGBA{0, 0, 0, 0}) {
					// Draw scaled pixel
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

// MockCameraManager wraps a regular CameraManager to use mock camera
type MockCameraManager struct {
	*CameraManager
	mockCam *MockCamera
}

// NewMockCameraManager creates a camera manager that uses mock camera
func NewMockCameraManager() *MockCameraManager {
	return &MockCameraManager{
		CameraManager: NewCameraManager(),
		mockCam:       NewMockCamera(),
	}
}

// Connect simulates camera connection
func (m *MockCameraManager) Connect() error {
	log.Println("Mock camera: Simulating connection...")
	m.isConnected.Store(true)
	m.captureQuit = make(chan struct{})
	m.disconnectedCh = make(chan struct{})
	return nil
}

// RunMockCaptureLoop generates synthetic frames
func (m *MockCameraManager) RunMockCaptureLoop() {
	log.Println("Mock camera: Starting capture loop...")

	var frameCount int
	var start = time.Now()

	ticker := time.NewTicker(33 * time.Millisecond) // ~30fps
	defer ticker.Stop()

	for m.capturing.Load() {
		select {
		case <-m.captureQuit:
			log.Println("Mock camera: Capture loop stopped")
			return
		case pause := <-m.pausePreview:
			if pause {
				log.Println("Mock camera: Preview paused")
				<-m.pausePreview // wait for resume
				log.Println("Mock camera: Preview resumed")
			}
		case <-ticker.C:
			data, err := m.mockCam.GenerateFrame()
			if err != nil {
				log.Printf("Mock camera: Failed to generate frame: %v", err)
				continue
			}

			frame := framePool.Get().(*Frame)

			// reuse buffer if capacity is enough
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
func (m *MockCameraManager) AddClient(id string) {
	if !m.isConnected.Load() {
		return
	}

	if _, loaded := m.clients.LoadOrStore(id, struct{}{}); !loaded {
		// First client - start mock capture
		if !m.capturing.Swap(true) {
			m.captureQuit = make(chan struct{})
			go m.RunMockCaptureLoop()
		}
	}
}

// CaptureImage simulates taking a photo
func (m *MockCameraManager) CaptureImage() error {
	if !m.isConnected.Load() {
		return nil
	}

	log.Println("Mock camera: Simulating capture...")

	// Pause preview briefly
	select {
	case m.pausePreview <- true:
	default:
	}

	// Simulate capture delay
	time.Sleep(100 * time.Millisecond)

	// Resume preview
	select {
	case m.pausePreview <- false:
	default:
	}

	log.Println("Mock camera: Capture complete!")
	return nil
}
