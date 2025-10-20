package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/cjlawson02/5dcontrol/server/camera"
	"github.com/gorilla/websocket"
)

func TestWebSocketServer_BasicConnection(t *testing.T) {
	// Create a real camera manager for testing
	camManager := camera.NewRealCamera()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Upgrade to WebSocket
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("WebSocket upgrade failed: %v", err)
		}
		defer conn.Close()

		// Send initial status
		sendStatus(conn, camManager)

		// Read messages until connection closes
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				// Connection closed
				break
			}
		}
	}))
	defer server.Close()

	// Connect to WebSocket
	wsURL := "ws" + server.URL[4:] + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("WebSocket connection failed: %v", err)
	}
	defer conn.Close()

	// Connection should be successful
	if conn == nil {
		t.Error("Expected WebSocket connection to be established")
	}
}

func TestWebSocketServer_UpgradeError(t *testing.T) {
	// Create test server that fails to upgrade
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't upgrade to WebSocket, just return error
		http.Error(w, "Upgrade failed", http.StatusBadRequest)
	}))
	defer server.Close()

	// Try to connect to WebSocket
	wsURL := "ws" + server.URL[4:] + "/ws"
	_, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Error("Expected WebSocket connection to fail")
	}
}

func TestWebSocketServer_ConnectionClose(t *testing.T) {
	// Create a real camera manager for testing
	camManager := camera.NewRealCamera()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Upgrade to WebSocket
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("WebSocket upgrade failed: %v", err)
		}
		defer conn.Close()

		// Send initial status
		sendStatus(conn, camManager)

		// Read messages until error
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				// Expected read error
				break
			}
		}
	}))
	defer server.Close()

	// Connect to WebSocket
	wsURL := "ws" + server.URL[4:] + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("WebSocket connection failed: %v", err)
	}

	// Close connection
	err = conn.Close()
	if err != nil {
		t.Fatalf("Failed to close connection: %v", err)
	}

	// Wait a bit for server to detect close
	// This test mainly ensures the server handles connection closes gracefully
}

func TestWebSocketServer_SendStatus(t *testing.T) {
	// Create a real camera manager for testing
	camManager := camera.NewRealCamera()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Upgrade to WebSocket
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("WebSocket upgrade failed: %v", err)
		}
		defer conn.Close()

		// Send status
		sendStatus(conn, camManager)
	}))
	defer server.Close()

	// Connect to WebSocket
	wsURL := "ws" + server.URL[4:] + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("WebSocket connection failed: %v", err)
	}
	defer conn.Close()

	// Read message
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read message: %v", err)
	}

	// Should receive some data
	if len(data) == 0 {
		t.Error("Expected to receive data from sendStatus")
	}
}

func TestWebSocketServer_MultipleConnections(t *testing.T) {
	// Create a real camera manager for testing
	camManager := camera.NewRealCamera()

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Upgrade to WebSocket
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("WebSocket upgrade failed: %v", err)
		}
		defer conn.Close()

		// Send initial status
		sendStatus(conn, camManager)

		// Read messages until connection closes
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				// Connection closed
				break
			}
		}
	}))
	defer server.Close()

	// Test multiple connections
	wsURL := "ws" + server.URL[4:] + "/ws"

	// First connection
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("First WebSocket connection failed: %v", err)
	}
	defer conn1.Close()

	// Second connection
	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Second WebSocket connection failed: %v", err)
	}
	defer conn2.Close()

	// Both connections should be successful
	if conn1 == nil || conn2 == nil {
		t.Error("Expected both WebSocket connections to be established")
	}
}
