package server

import (
	"log"
	"net/http"

	Proto "github.com/cjlawson02/5dcontrol/packages/proto/dist"
	"github.com/cjlawson02/5dcontrol/server/camera"
	flatbuffers "github.com/google/flatbuffers/go"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func sendStatus(conn *websocket.Conn, cam *camera.CameraManager) {
	builder := flatbuffers.NewBuilder(0)

	// Example values
	batteryLevel := uint8(82)

	Proto.StatusStart(builder)
	Proto.StatusAddCameraConnected(builder, cam.IsConnected())
	Proto.StatusAddBatteryLevel(builder, batteryLevel)
	status := Proto.StatusEnd(builder)

	Proto.MessageStart(builder)
	Proto.MessageAddMessageType(builder, Proto.MessageTypeSTATUS)
	Proto.MessageAddStatus(builder, status)
	msg := Proto.MessageEnd(builder)

	builder.Finish(msg)

	if err := conn.WriteMessage(websocket.BinaryMessage, builder.FinishedBytes()); err != nil {
		log.Println("Failed to send status:", err)
	}
}

// RunWebSocketServer starts the WebSocket handler for camera control.
func RunWebSocketServer(cam *camera.CameraManager, updates <-chan *camera.CameraManager) {
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Upgrade error:", err)
			return
		}
		defer conn.Close()

		// Send status once on connection
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
						// Handle focus
					case Proto.ControlTypeCAPTURE:
						log.Println("Capture command received")
						cam.CaptureImage()
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
