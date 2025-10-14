package camera

import (
	"bytes"
	"image"
	"image/jpeg"
	"testing"
	"time"
)

func TestNewMockCamera(t *testing.T) {
	mock := NewMockCamera()

	if mock == nil {
		t.Fatal("NewMockCamera() returned nil")
	}

	if mock.frameCount != 0 {
		t.Errorf("Expected frameCount to be 0, got %d", mock.frameCount)
	}
}

func TestMockCamera_GenerateFrame(t *testing.T) {
	mock := NewMockCamera()

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

func TestMockCamera_GenerateFrame_ImageProperties(t *testing.T) {
	mock := NewMockCamera()

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

func TestNewMockCameraManager(t *testing.T) {
	mockManager := NewMockCameraManager()

	if mockManager == nil {
		t.Fatal("NewMockCameraManager() returned nil")
	}

	if mockManager.CameraManager == nil {
		t.Error("Expected CameraManager to be initialized")
	}

	if mockManager.mockCam == nil {
		t.Error("Expected mockCam to be initialized")
	}
}

func TestMockCameraManager_Connect(t *testing.T) {
	mockManager := NewMockCameraManager()

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

func TestMockCameraManager_AddClient(t *testing.T) {
	mockManager := NewMockCameraManager()

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

func TestMockCameraManager_CaptureImage(t *testing.T) {
	mockManager := NewMockCameraManager()

	// Capture when disconnected - should not error
	err := mockManager.CaptureImage()
	if err != nil {
		t.Errorf("CaptureImage() failed when disconnected: %v", err)
	}

	// Connect camera
	mockManager.isConnected.Store(true)

	// Capture should succeed
	err = mockManager.CaptureImage()
	if err != nil {
		t.Errorf("CaptureImage() failed: %v", err)
	}
}

func TestMockCameraManager_RunMockCaptureLoop(t *testing.T) {
	mockManager := NewMockCameraManager()
	mockManager.isConnected.Store(true)
	mockManager.capturing.Store(true)
	mockManager.captureQuit = make(chan struct{})

	// Start capture loop in goroutine
	go mockManager.RunMockCaptureLoop()

	// Wait a bit for frames to be generated
	time.Sleep(100 * time.Millisecond)

	// Check that frames are being generated
	frame := mockManager.GetLatestFrame()
	if frame == nil {
		t.Error("Expected frames to be generated")
	}

	// Stop capture loop
	close(mockManager.captureQuit)

	// Wait for loop to stop
	time.Sleep(50 * time.Millisecond)
}

func TestMockCameraManager_PauseResume(t *testing.T) {
	mockManager := NewMockCameraManager()
	mockManager.isConnected.Store(true)
	mockManager.capturing.Store(true)
	mockManager.captureQuit = make(chan struct{})
	mockManager.pausePreview = make(chan bool, 2)

	// Start capture loop in goroutine
	go mockManager.RunMockCaptureLoop()

	// Wait for initial frame
	time.Sleep(50 * time.Millisecond)

	// Pause preview
	mockManager.pausePreview <- true

	// Wait a bit
	time.Sleep(50 * time.Millisecond)

	// Resume preview
	mockManager.pausePreview <- false

	// Wait for more frames
	time.Sleep(50 * time.Millisecond)

	// Stop capture loop
	close(mockManager.captureQuit)
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
		data, err := mock.GenerateFrame()
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
	for i := 0; i < 10; i++ {
		data, err := mock.GenerateFrame()
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

func TestMockCameraManager_ConcurrentAccess(t *testing.T) {
	mockManager := NewMockCameraManager()
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
	mockManager.clients.Range(func(key, value interface{}) bool {
		clientCount++
		return true
	})

	if clientCount != 5 {
		t.Errorf("Expected 5 clients, got %d", clientCount)
	}
}

func TestMockCameraManager_FrameGeneration(t *testing.T) {
	mockManager := NewMockCameraManager()
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
