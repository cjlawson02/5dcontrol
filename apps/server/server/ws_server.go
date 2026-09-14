package server

import (
	"log"
	"net/http"
	"sync"

	Proto "github.com/cjlawson02/5dcontrol/packages/proto/dist"
	"github.com/cjlawson02/5dcontrol/server/camera"
	flatbuffers "github.com/google/flatbuffers/go"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// clientHub manages all connected WebSocket clients
type clientHub struct {
	clients    map[*websocket.Conn]bool
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	broadcast  chan []byte
	mu         sync.RWMutex
}

func newClientHub() *clientHub {
	return &clientHub{
		clients:    make(map[*websocket.Conn]bool),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		broadcast:  make(chan []byte, 256),
	}
}

func (h *clientHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client registered, total clients: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				log.Printf("WebSocket client unregistered, total clients: %d", len(h.clients))
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.BinaryMessage, message)
				if err != nil {
					log.Printf("Failed to broadcast to client: %v", err)
					// Don't remove client here, let the read loop handle it
				}
			}
			h.mu.RUnlock()
		}
	}
}

var hub *clientHub

// buildStatusMessage creates a status message for the given camera
func buildStatusMessage(cam camera.CameraController) []byte {
	builder := flatbuffers.NewBuilder(1024) // Increased buffer size for more data

	// Get real battery level from camera
	batteryLevel := cam.GetBatteryLevel()

	// Build status message
	Proto.StatusStart(builder)
	Proto.StatusAddCameraConnected(builder, cam.IsConnected())
	Proto.StatusAddBatteryLevel(builder, batteryLevel)
	status := Proto.StatusEnd(builder)

	Proto.MessageStart(builder)
	Proto.MessageAddMessageType(builder, Proto.MessageTypeSTATUS)
	Proto.MessageAddStatus(builder, status)
	msg := Proto.MessageEnd(builder)

	builder.Finish(msg)
	return builder.FinishedBytes()
}

// sendStatus sends a status message to a single client
func sendStatus(conn *websocket.Conn, cam camera.CameraController) {
	message := buildStatusMessage(cam)
	if err := conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
		log.Println("Failed to send status:", err)
	}
}

// broadcastStatus sends status to all connected clients
func broadcastStatus(cam camera.CameraController) {
	if hub != nil {
		message := buildStatusMessage(cam)
		hub.broadcast <- message
	}
}

// RunWebSocketServer starts the WebSocket handler for camera control.
func RunWebSocketServer(cam camera.CameraController, updates <-chan camera.CameraController) {
	// Initialize and start the client hub
	hub = newClientHub()
	go hub.run()

	// Listen for camera updates and broadcast status to all clients
	if updates != nil {
		go func() {
			for c := range updates {
				cam = c
				log.Println("Camera update received, broadcasting status to all clients")
				broadcastStatus(cam)
			}
		}()
	}

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Upgrade error:", err)
			return
		}
		defer func() {
			hub.unregister <- conn
			conn.Close()
		}()

		// Register client with hub
		hub.register <- conn

		// Send initial status on connection
		sendStatus(conn, cam)

		for {
			// Read messages from the WebSocket connection
			_, data, err := conn.ReadMessage()
			if err != nil {
				log.Println("Read error:", err)
				break
			}

			msg := Proto.GetRootAsMessage(data, 0)

			switch msg.MessageType() {
			case Proto.MessageTypeCOMMAND:
				cmd := new(Proto.Command)
				if msg.Command(cmd) != nil {
					switch cmd.Type() {
					case Proto.ControlTypeFOCUS:
						log.Println("Focus command received")
						if _, err := cam.TriggerFocus(); err != nil {
							log.Printf("Failed to trigger focus: %v", err)
						}
					case Proto.ControlTypeCAPTURE:
						log.Println("Capture command received")
						if _, err := cam.CaptureImage(); err != nil {
							log.Printf("Failed to capture image: %v", err)
						}
					case Proto.ControlTypeQUERY_STATUS:
						log.Println("Status query received")
						// Send status back
						sendStatus(conn, cam)
					}
				}

			case Proto.MessageTypeSTATUS:
				// Usually client wouldn't send this, but log it if needed
				log.Println("Unexpected STATUS message from client")
			}

		}
	})

	addr := ":8888"
	log.Printf("WS server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
