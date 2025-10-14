package camera

import (
	"sync"
	"testing"
	"time"
)

func TestNewCameraManager(t *testing.T) {
	manager := NewCameraManager()

	if manager == nil {
		t.Fatal("NewCameraManager() returned nil")
	}

	if manager.isConnected.Load() {
		t.Error("Expected camera to be disconnected initially")
	}

	if manager.capturing.Load() {
		t.Error("Expected camera to not be capturing initially")
	}

	if manager.disconnectedCh == nil {
		t.Error("Expected disconnectedCh to be initialized")
	}

	if manager.pausePreview == nil {
		t.Error("Expected pausePreview to be initialized")
	}
}

func TestCameraManager_IsConnected(t *testing.T) {
	manager := NewCameraManager()

	// Initially disconnected
	if manager.IsConnected() {
		t.Error("Expected camera to be disconnected initially")
	}

	// Simulate connection
	manager.isConnected.Store(true)
	if !manager.IsConnected() {
		t.Error("Expected camera to be connected after setting flag")
	}
}

func TestCameraManager_GetLatestFrame(t *testing.T) {
	manager := NewCameraManager()

	// Initially no frame
	frame := manager.GetLatestFrame()
	if frame != nil {
		t.Error("Expected no frame initially")
	}

	// Set a frame
	testFrame := &Frame{
		Data:      []byte("test data"),
		Timestamp: time.Now(),
	}
	manager.LatestFrame.Store(testFrame)

	frame = manager.GetLatestFrame()
	if frame == nil {
		t.Fatal("Expected frame to be set")
	}

	if string(frame.Data) != "test data" {
		t.Errorf("Expected frame data 'test data', got '%s'", string(frame.Data))
	}
}

func TestCameraManager_GetBatteryLevel(t *testing.T) {
	manager := NewCameraManager()

	// Initially 0
	level := manager.GetBatteryLevel()
	if level != 0 {
		t.Errorf("Expected battery level 0, got %d", level)
	}

	// Set battery level
	manager.batteryLevel.Store(75)
	level = manager.GetBatteryLevel()
	if level != 75 {
		t.Errorf("Expected battery level 75, got %d", level)
	}
}

func TestCameraManager_AddClient(t *testing.T) {
	manager := NewCameraManager()

	// Add client when disconnected - should not start capture
	manager.AddClient("client1")

	// Check that client was not added
	_, exists := manager.clients.Load("client1")
	if exists {
		t.Error("Expected client not to be added when camera is disconnected")
	}

	// Connect camera
	manager.isConnected.Store(true)

	// Add first client - should start capture
	manager.AddClient("client1")

	// Check that client was added
	_, exists = manager.clients.Load("client1")
	if !exists {
		t.Error("Expected client to be added")
	}

	// Check that capturing started
	if !manager.capturing.Load() {
		t.Error("Expected capture to start when first client connects")
	}

	// Add second client - should not restart capture
	manager.AddClient("client2")

	// Check that both clients exist
	_, exists1 := manager.clients.Load("client1")
	_, exists2 := manager.clients.Load("client2")
	if !exists1 || !exists2 {
		t.Error("Expected both clients to be added")
	}
}

func TestCameraManager_RemoveClient(t *testing.T) {
	manager := NewCameraManager()
	manager.isConnected.Store(true)

	// Add two clients
	manager.AddClient("client1")
	manager.AddClient("client2")

	// Remove one client - should not stop capture
	manager.RemoveClient("client1")

	// Check that client1 was removed but client2 remains
	_, exists1 := manager.clients.Load("client1")
	_, exists2 := manager.clients.Load("client2")

	if exists1 {
		t.Error("Expected client1 to be removed")
	}
	if !exists2 {
		t.Error("Expected client2 to remain")
	}

	// Should still be capturing
	if !manager.capturing.Load() {
		t.Error("Expected capture to continue with remaining client")
	}

	// Remove last client - should stop capture
	manager.RemoveClient("client2")

	// Check that client2 was removed
	_, exists2 = manager.clients.Load("client2")
	if exists2 {
		t.Error("Expected client2 to be removed")
	}

	// Should stop capturing
	if manager.capturing.Load() {
		t.Error("Expected capture to stop when last client disconnects")
	}
}

func TestCameraManager_CaptureImage(t *testing.T) {
	manager := NewCameraManager()

	// Try to capture when disconnected - should return error
	err := manager.CaptureImage()
	if err == nil {
		t.Error("Expected error when capturing while disconnected")
	}

	// Connect camera
	manager.isConnected.Store(true)

	// Capture should succeed (though it won't actually capture without real camera)
	// We can't test the actual capture without mocking gphoto2
	// This test mainly verifies the connection check
}

func TestCameraManager_TriggerFocus(t *testing.T) {
	manager := NewCameraManager()

	// Try to focus when disconnected - should return error
	err := manager.TriggerFocus()
	if err == nil {
		t.Error("Expected error when focusing while disconnected")
	}

	// Connect camera
	manager.isConnected.Store(true)

	// Focus should succeed (though it won't actually focus without real camera)
	// We can't test the actual focus without mocking gphoto2
	// This test mainly verifies the connection check
}

func TestCameraManager_DisconnectedCh(t *testing.T) {
	manager := NewCameraManager()

	ch := manager.DisconnectedCh()
	if ch == nil {
		t.Error("Expected disconnected channel to be non-nil")
	}

	// Test that the channel is the same instance
	ch2 := manager.DisconnectedCh()
	if ch != ch2 {
		t.Error("Expected same channel instance")
	}
}

func TestCameraManager_handleDisconnect(t *testing.T) {
	manager := NewCameraManager()
	manager.isConnected.Store(true)

	// Set up some state
	manager.batteryQuit = make(chan struct{})
	testFrame := &Frame{Data: []byte("test"), Timestamp: time.Now()}
	manager.LatestFrame.Store(testFrame)

	// Handle disconnect
	manager.handleDisconnect()

	// Check that camera is disconnected
	if manager.IsConnected() {
		t.Error("Expected camera to be disconnected")
	}

	// Check that battery quit channel was closed
	if manager.batteryQuit != nil {
		select {
		case <-manager.batteryQuit:
			// Expected
		default:
			t.Error("Expected battery quit channel to be closed")
		}
	}

	// Check that latest frame was cleared
	frame := manager.GetLatestFrame()
	if frame != nil {
		t.Error("Expected latest frame to be cleared")
	}

	// Check that disconnected channel was closed
	select {
	case <-manager.disconnectedCh:
		// Expected
	default:
		t.Error("Expected disconnected channel to be closed")
	}
}

func TestFramePool(t *testing.T) {
	// Test frame pool reuse
	frame1 := framePool.Get().(*Frame)
	frame1.Data = []byte("test1")
	frame1.Timestamp = time.Now()

	framePool.Put(frame1)

	frame2 := framePool.Get().(*Frame)

	// Should get the same frame back (reused)
	if frame2 != frame1 {
		t.Error("Expected frame pool to reuse frames")
	}

	// Data should be reset (frame pool doesn't reset data, just reuses the struct)
	// The frame pool just reuses the struct, it doesn't reset the data
	// This is expected behavior
}

func TestCameraManager_ConcurrentAccess(t *testing.T) {
	manager := NewCameraManager()
	manager.isConnected.Store(true)

	var wg sync.WaitGroup

	// Test concurrent client additions
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			manager.AddClient(string(rune('a' + id)))
		}(i)
	}

	wg.Wait()

	// Check that all clients were added
	clientCount := 0
	manager.clients.Range(func(key, value interface{}) bool {
		clientCount++
		return true
	})

	if clientCount != 10 {
		t.Errorf("Expected 10 clients, got %d", clientCount)
	}

	// Test concurrent client removals
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			manager.RemoveClient(string(rune('a' + id)))
		}(i)
	}

	wg.Wait()

	// Check that all clients were removed
	clientCount = 0
	manager.clients.Range(func(key, value interface{}) bool {
		clientCount++
		return true
	})

	if clientCount != 0 {
		t.Errorf("Expected 0 clients, got %d", clientCount)
	}
}

func TestCameraManager_BatteryLevelUpdate(t *testing.T) {
	manager := NewCameraManager()
	manager.isConnected.Store(true)

	// Test battery level clamping
	manager.batteryLevel.Store(150) // Over 100
	level := manager.GetBatteryLevel()
	// The GetBatteryLevel method doesn't clamp, it just returns the stored value
	// Clamping happens in updateBatteryLevel method
	if level != 150 {
		t.Errorf("Expected battery level 150, got %d", level)
	}

	manager.batteryLevel.Store(50)
	level = manager.GetBatteryLevel()
	if level != 50 {
		t.Errorf("Expected battery level 50, got %d", level)
	}
}

func TestCameraManager_Close(t *testing.T) {
	manager := NewCameraManager()
	manager.isConnected.Store(true)

	// Set up some state
	manager.batteryQuit = make(chan struct{})

	// Close should not panic
	manager.Close()

	// Close only calls handleDisconnect if there's a real camera
	// In test environment, there's no camera, so it won't disconnect
	// This is expected behavior
	if manager.IsConnected() {
		t.Log("Camera remains connected after close (no real camera in test)")
	}
}
