package camera

import (
	"bytes"
	"image"
	"image/jpeg"
	"testing"
	"time"
)

func TestNewMockCameraDevice(t *testing.T) {
	mock := newMockCameraDevice()

	if mock == nil {
		t.Fatal("newMockCameraDevice() returned nil")
	}

	if mock.frameCount != 0 {
		t.Errorf("Expected frameCount to be 0, got %d", mock.frameCount)
	}
}

func TestMockCameraDevice_GenerateFrame(t *testing.T) {
	mock := newMockCameraDevice()

	// Generate first frame
	data1, err := mock.GenerateFrame()
	if err != nil {
		t.Fatalf("GenerateFrame() failed: %v", err)
	}

	if len(data1) == 0 {
		t.Error("Expected frame data to be non-empty")
	}

	// Verify it's valid JPEG
	_, err = jpeg.Decode(bytes.NewReader(data1))
	if err != nil {
		t.Errorf("Generated frame is not valid JPEG: %v", err)
	}

	// Generate second frame
	data2, err := mock.GenerateFrame()
	if err != nil {
		t.Fatalf("GenerateFrame() failed: %v", err)
	}

	// Frames should be different (animated gradient)
	if bytes.Equal(data1, data2) {
		t.Error("Expected frames to be different (animated)")
	}

	// Frame count should increment
	if mock.frameCount != 2 {
		t.Errorf("Expected frameCount to be 2, got %d", mock.frameCount)
	}
}

func TestMockCameraDevice_GenerateFrame_ImageProperties(t *testing.T) {
	mock := newMockCameraDevice()

	data, err := mock.GenerateFrame()
	if err != nil {
		t.Fatalf("GenerateFrame() failed: %v", err)
	}

	// Decode and verify image properties
	img, err := jpeg.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("Failed to decode generated frame: %v", err)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Should be 1920x1080
	if width != 1920 {
		t.Errorf("Expected width 1920, got %d", width)
	}
	if height != 1080 {
		t.Errorf("Expected height 1080, got %d", height)
	}
}

func TestNewMockCamera(t *testing.T) {
	mockManager := NewMockCamera()

	if mockManager == nil {
		t.Fatal("NewMockCamera() returned nil")
	}

	if mockManager.RealCamera == nil {
		t.Error("Expected RealCamera to be initialized")
	}

	if mockManager.mockCam == nil {
		t.Error("Expected mockCam to be initialized")
	}
}

func TestMockCamera_Connect(t *testing.T) {
	mockManager := NewMockCamera()

	err := mockManager.Connect()
	if err != nil {
		t.Fatalf("Connect() failed: %v", err)
	}

	if !mockManager.IsConnected() {
		t.Error("Expected mock camera to be connected")
	}

	if mockManager.captureQuit == nil {
		t.Error("Expected captureQuit channel to be initialized")
	}

	if mockManager.disconnectedCh == nil {
		t.Error("Expected disconnectedCh channel to be initialized")
	}
}

func TestMockCamera_AddClient(t *testing.T) {
	mockManager := NewMockCamera()

	// Add client when disconnected - should not start capture
	mockManager.AddClient("client1")

	// Check that client was not added
	_, exists := mockManager.clients.Load("client1")
	if exists {
		t.Error("Expected client not to be added when camera is disconnected")
	}

	// Connect camera
	mockManager.isConnected.Store(true)

	// Add first client - should start capture
	mockManager.AddClient("client1")

	// Check that client was added
	_, exists = mockManager.clients.Load("client1")
	if !exists {
		t.Error("Expected client to be added")
	}

	// Check that capturing started
	if !mockManager.capturing.Load() {
		t.Error("Expected capture to start when first client connects")
	}
}

func TestMockCamera_CaptureImage(t *testing.T) {
	mockManager := NewMockCamera()

	// Capture when disconnected - should not error
	_, err := mockManager.CaptureImage()
	if err != nil {
		t.Errorf("CaptureImage() failed when disconnected: %v", err)
	}

	// Connect camera
	if err := mockManager.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}

	// Capture should succeed
	res, err := mockManager.CaptureImage()
	if err != nil {
		t.Errorf("CaptureImage() failed: %v", err)
	}
	if res == nil || res.Timing == nil {
		t.Errorf("expected timing on capture result")
	}
}

func TestMockCamera_PauseResume(t *testing.T) {
	mockManager := NewMockCamera()
	if err := mockManager.Connect(); err != nil {
		t.Fatal(err)
	}
	mockManager.capturing.Store(true)
	mockManager.captureQuit = make(chan struct{})
	go mockManager.RunMockCaptureLoop()

	time.Sleep(50 * time.Millisecond)

	mockManager.previewManager.pausePreview()
	time.Sleep(50 * time.Millisecond)
	mockManager.previewManager.resumePreview()

	time.Sleep(50 * time.Millisecond)

	close(mockManager.captureQuit)
	mockManager.capturing.Store(false)
}

func TestMockCamera_RunMockCaptureLoop(t *testing.T) {
	mockManager := NewMockCamera()
	mockManager.isConnected.Store(true)
	mockManager.capturing.Store(true)
	mockManager.captureQuit = make(chan struct{})

	// Start capture loop in goroutine
	go mockManager.RunMockCaptureLoop()

	// Wait a bit for frames to be generated
	// Poll for a short period to see if a frame is generated
	var frame *Frame
	for range 10 {
		frame = mockManager.GetLatestFrame()
		if frame != nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	if frame == nil {
		t.Error("Expected frames to be generated, but got none")
	}

	// Stop capture loop
	close(mockManager.captureQuit)

	// Wait for loop to stop
	time.Sleep(50 * time.Millisecond)
}

func TestAddLabel(t *testing.T) {
	// Create a test image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))

	// Add a label
	addLabel(img, 10, 20, "TEST")

	// Check that some pixels were set (not all black)
	hasWhitePixels := false
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			if r > 0 || g > 0 || b > 0 || a > 0 {
				hasWhitePixels = true
				break
			}
		}
		if hasWhitePixels {
			break
		}
	}

	if !hasWhitePixels {
		t.Error("Expected label to draw some white pixels")
	}
}

func TestMockCamera_FrameAnimation(t *testing.T) {
	mock := NewMockCamera()

	// Generate multiple frames and verify they're different
	frames := make([][]byte, 5)
	for i := 0; i < 5; i++ {
		data, err := mock.mockCam.GenerateFrame()
		if err != nil {
			t.Fatalf("GenerateFrame() failed: %v", err)
		}
		frames[i] = data
	}

	// All frames should be different
	for i := 0; i < len(frames); i++ {
		for j := i + 1; j < len(frames); j++ {
			if bytes.Equal(frames[i], frames[j]) {
				t.Errorf("Frames %d and %d are identical (not animated)", i, j)
			}
		}
	}
}

func TestMockCamera_FrameConsistency(t *testing.T) {
	mock := NewMockCamera()

	// Generate frames and verify they're valid JPEG
	for i := range 10 {
		data, err := mock.mockCam.GenerateFrame()
		if err != nil {
			t.Fatalf("GenerateFrame() failed on iteration %d: %v", i, err)
		}

		// Verify JPEG validity
		_, err = jpeg.Decode(bytes.NewReader(data))
		if err != nil {
			t.Errorf("Frame %d is not valid JPEG: %v", i, err)
		}

		// Verify size is reasonable (should be several KB)
		if len(data) < 1000 {
			t.Errorf("Frame %d is too small: %d bytes", i, len(data))
		}
	}
}

func TestMockCamera_ConcurrentAccess(t *testing.T) {
	mockManager := NewMockCamera()
	mockManager.isConnected.Store(true)

	// Test concurrent client operations
	done := make(chan bool)

	// Add clients concurrently
	for i := 0; i < 5; i++ {
		go func(id int) {
			mockManager.AddClient(string(rune('a' + id)))
			done <- true
		}(i)
	}

	// Wait for all additions
	for i := 0; i < 5; i++ {
		<-done
	}

	// Verify all clients were added
	clientCount := 0
	mockManager.clients.Range(func(key, value any) bool {
		clientCount++
		return true
	})

	if clientCount != 5 {
		t.Errorf("Expected 5 clients, got %d", clientCount)
	}
}

func TestMockCamera_FrameGeneration(t *testing.T) {
	mockManager := NewMockCamera()
	mockManager.isConnected.Store(true)
	mockManager.capturing.Store(true)
	mockManager.captureQuit = make(chan struct{})

	// Start capture loop
	go mockManager.RunMockCaptureLoop()

	// Wait for frames
	time.Sleep(200 * time.Millisecond)

	// Check that we have frames
	frame := mockManager.GetLatestFrame()
	if frame == nil {
		t.Fatal("Expected frames to be generated")
	}

	// Verify frame data is valid JPEG
	_, err := jpeg.Decode(bytes.NewReader(frame.Data))
	if err != nil {
		t.Errorf("Generated frame is not valid JPEG: %v", err)
	}

	// Verify timestamp is recent
	if time.Since(frame.Timestamp) > time.Second {
		t.Error("Frame timestamp is too old")
	}

	// Stop capture
	close(mockManager.captureQuit)
}
