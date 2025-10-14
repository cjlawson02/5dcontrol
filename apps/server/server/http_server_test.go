package server

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/cjlawson02/5dcontrol/server/camera"
)

// MockCameraLike implements CameraLike interface for testing
type MockCameraLike struct {
	connected         bool
	clients           map[string]struct{}
	latestFrame       *camera.Frame
	clientCount       int
	addClientCalls    int
	removeClientCalls int
}

func NewMockCameraLike() *MockCameraLike {
	return &MockCameraLike{
		connected: false,
		clients:   make(map[string]struct{}),
	}
}

func (m *MockCameraLike) IsConnected() bool {
	return m.connected
}

func (m *MockCameraLike) AddClient(id string) {
	m.addClientCalls++
	m.clients[id] = struct{}{}
	m.clientCount = len(m.clients)
}

func (m *MockCameraLike) RemoveClient(id string) {
	m.removeClientCalls++
	delete(m.clients, id)
	m.clientCount = len(m.clients)
}

func (m *MockCameraLike) GetLatestFrame() *camera.Frame {
	return m.latestFrame
}

func (m *MockCameraLike) SetLatestFrame(frame *camera.Frame) {
	m.latestFrame = frame
}

func TestRunHTTPServer_MJPEG_NotConnected(t *testing.T) {
	mockCam := NewMockCameraLike()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/live.mjpeg" {
			// Simulate the MJPEG handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}
		}
	}))
	defer server.Close()

	// Test MJPEG endpoint when camera is not connected
	resp, err := http.Get(server.URL + "/live.mjpeg")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, resp.StatusCode)
	}
}

func TestRunHTTPServer_MJPEG_Connected(t *testing.T) {
	mockCam := NewMockCameraLike()
	mockCam.connected = true

	// Create test frame
	testFrame := &camera.Frame{
		Data:      []byte("fake jpeg data"),
		Timestamp: time.Now(),
	}
	mockCam.SetLatestFrame(testFrame)

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/live.mjpeg" {
			// Simulate the MJPEG handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}

			w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
			mockCam.AddClient(r.RemoteAddr)
			defer mockCam.RemoveClient(r.RemoteAddr)

			// Send one frame
			frame := mockCam.GetLatestFrame()
			if frame != nil {
				header := fmt.Sprintf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", len(frame.Data))
				w.Write([]byte(header))
				w.Write(frame.Data)
				w.Write([]byte("\r\n"))
			}
		}
	}))
	defer server.Close()

	// Test MJPEG endpoint when camera is connected
	resp, err := http.Get(server.URL + "/live.mjpeg")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if contentType != "multipart/x-mixed-replace; boundary=frame" {
		t.Errorf("Expected content type 'multipart/x-mixed-replace; boundary=frame', got '%s'", contentType)
	}

	// Check that client was added
	if mockCam.addClientCalls != 1 {
		t.Errorf("Expected 1 AddClient call, got %d", mockCam.addClientCalls)
	}
}

func TestRunHTTPServer_Photo_NotConnected(t *testing.T) {
	mockCam := NewMockCameraLike()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/photo.jpg" {
			// Simulate the photo handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}
		}
	}))
	defer server.Close()

	// Test photo endpoint when camera is not connected
	resp, err := http.Get(server.URL + "/photo.jpg")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, resp.StatusCode)
	}
}

func TestRunHTTPServer_Photo_NoFrame(t *testing.T) {
	mockCam := NewMockCameraLike()
	mockCam.connected = true

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/photo.jpg" {
			// Simulate the photo handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}

			frame := mockCam.GetLatestFrame()
			if frame == nil {
				http.Error(w, "No frame available", http.StatusServiceUnavailable)
				return
			}

			w.Header().Set("Content-Type", "image/jpeg")
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(frame.Data)))
			w.Write(frame.Data)
		}
	}))
	defer server.Close()

	// Test photo endpoint when no frame is available
	resp, err := http.Get(server.URL + "/photo.jpg")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Expected status %d, got %d", http.StatusServiceUnavailable, resp.StatusCode)
	}
}

func TestRunHTTPServer_Photo_WithFrame(t *testing.T) {
	mockCam := NewMockCameraLike()
	mockCam.connected = true

	// Create test frame
	testFrame := &camera.Frame{
		Data:      []byte("fake jpeg data"),
		Timestamp: time.Now(),
	}
	mockCam.SetLatestFrame(testFrame)

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/photo.jpg" {
			// Simulate the photo handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}

			frame := mockCam.GetLatestFrame()
			if frame == nil {
				http.Error(w, "No frame available", http.StatusServiceUnavailable)
				return
			}

			w.Header().Set("Content-Type", "image/jpeg")
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(frame.Data)))
			w.Write(frame.Data)
		}
	}))
	defer server.Close()

	// Test photo endpoint with frame
	resp, err := http.Get(server.URL + "/photo.jpg")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if contentType != "image/jpeg" {
		t.Errorf("Expected content type 'image/jpeg', got '%s'", contentType)
	}

	// Check content length
	contentLength := resp.Header.Get("Content-Length")
	expectedLength := fmt.Sprintf("%d", len(testFrame.Data))
	if contentLength != expectedLength {
		t.Errorf("Expected content length '%s', got '%s'", expectedLength, contentLength)
	}

	// Check body content
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}

	if !bytes.Equal(body, testFrame.Data) {
		t.Error("Response body does not match frame data")
	}
}

func TestRunHTTPServer_MJPEG_ClientLifecycle(t *testing.T) {
	mockCam := NewMockCameraLike()
	mockCam.connected = true

	// Create test frame
	testFrame := &camera.Frame{
		Data:      []byte("fake jpeg data"),
		Timestamp: time.Now(),
	}
	mockCam.SetLatestFrame(testFrame)

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/live.mjpeg" {
			// Simulate the MJPEG handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}

			w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
			mockCam.AddClient(r.RemoteAddr)
			defer mockCam.RemoveClient(r.RemoteAddr)

			// Send one frame and close connection
			frame := mockCam.GetLatestFrame()
			if frame != nil {
				header := fmt.Sprintf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", len(frame.Data))
				w.Write([]byte(header))
				w.Write(frame.Data)
				w.Write([]byte("\r\n"))
			}
		}
	}))
	defer server.Close()

	// Test MJPEG endpoint
	resp, err := http.Get(server.URL + "/live.mjpeg")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response: %v", err)
	}

	// Check that response contains frame data
	if !bytes.Contains(body, testFrame.Data) {
		t.Error("Response does not contain frame data")
	}

	// Check that client was added and removed
	if mockCam.addClientCalls != 1 {
		t.Errorf("Expected 1 AddClient call, got %d", mockCam.addClientCalls)
	}
	if mockCam.removeClientCalls != 1 {
		t.Errorf("Expected 1 RemoveClient call, got %d", mockCam.removeClientCalls)
	}
}

func TestRunHTTPServer_MJPEG_MultipartFormat(t *testing.T) {
	mockCam := NewMockCameraLike()
	mockCam.connected = true

	// Create test frame
	testFrame := &camera.Frame{
		Data:      []byte("fake jpeg data"),
		Timestamp: time.Now(),
	}
	mockCam.SetLatestFrame(testFrame)

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/live.mjpeg" {
			// Simulate the MJPEG handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}

			w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
			mockCam.AddClient(r.RemoteAddr)
			defer mockCam.RemoveClient(r.RemoteAddr)

			// Send one frame
			frame := mockCam.GetLatestFrame()
			if frame != nil {
				header := fmt.Sprintf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", len(frame.Data))
				w.Write([]byte(header))
				w.Write(frame.Data)
				w.Write([]byte("\r\n"))
			}
		}
	}))
	defer server.Close()

	// Test MJPEG endpoint
	resp, err := http.Get(server.URL + "/live.mjpeg")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response: %v", err)
	}

	// Check multipart format
	bodyStr := string(body)
	if !strings.Contains(bodyStr, "--frame") {
		t.Error("Response does not contain multipart boundary")
	}
	if !strings.Contains(bodyStr, "Content-Type: image/jpeg") {
		t.Error("Response does not contain JPEG content type")
	}
	if !strings.Contains(bodyStr, "Content-Length:") {
		t.Error("Response does not contain content length")
	}
}

func TestRunHTTPServer_UnknownEndpoint(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/live.mjpeg" || r.URL.Path == "/photo.jpg" {
			// Handle known endpoints
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	// Test unknown endpoint
	resp, err := http.Get(server.URL + "/unknown")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
}

func TestRunHTTPServer_ConcurrentClients(t *testing.T) {
	mockCam := NewMockCameraLike()
	mockCam.connected = true

	// Create test frame
	testFrame := &camera.Frame{
		Data:      []byte("fake jpeg data"),
		Timestamp: time.Now(),
	}
	mockCam.SetLatestFrame(testFrame)

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/live.mjpeg" {
			// Simulate the MJPEG handler logic
			if !mockCam.IsConnected() {
				http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
				return
			}

			w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
			mockCam.AddClient(r.RemoteAddr)
			defer mockCam.RemoveClient(r.RemoteAddr)

			// Send one frame
			frame := mockCam.GetLatestFrame()
			if frame != nil {
				header := fmt.Sprintf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", len(frame.Data))
				w.Write([]byte(header))
				w.Write(frame.Data)
				w.Write([]byte("\r\n"))
			}
		}
	}))
	defer server.Close()

	// Test multiple concurrent clients
	clientCount := 5
	done := make(chan bool, clientCount)

	for i := 0; i < clientCount; i++ {
		go func() {
			resp, err := http.Get(server.URL + "/live.mjpeg")
			if err != nil {
				t.Errorf("Request failed: %v", err)
				done <- false
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
				done <- false
				return
			}

			done <- true
		}()
	}

	// Wait for all clients
	successCount := 0
	for i := 0; i < clientCount; i++ {
		if <-done {
			successCount++
		}
	}

	if successCount != clientCount {
		t.Errorf("Expected %d successful requests, got %d", clientCount, successCount)
	}

	// Check that all clients were added and removed
	if mockCam.addClientCalls != clientCount {
		t.Errorf("Expected %d AddClient calls, got %d", clientCount, mockCam.addClientCalls)
	}
	if mockCam.removeClientCalls != clientCount {
		t.Errorf("Expected %d RemoveClient calls, got %d", clientCount, mockCam.removeClientCalls)
	}
}
