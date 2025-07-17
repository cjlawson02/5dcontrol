package server

import (
	"log"
	"net/http"

	Proto "github.com/cjlawson02/5dcontrol/packages/proto/dist"
	"github.com/cjlawson02/5dcontrol/server/camera"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
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

		for {
			// Read messages from the WebSocket connection
			_, data, err := conn.ReadMessage()
			if err != nil {
				log.Println("Read error:", err)
				break
			}

			control := Proto.GetRootAsControl(data, 0)

			switch control.Type() {
			case Proto.ControlTypeFOCUS:
				// focus command
				log.Printf("Focus command received")

			case Proto.ControlTypeCAPTURE:
				// capture command
				log.Println("Capture command received")
				cam.CaptureImage()
			}
		}
	})

	addr := ":8888"
	log.Printf("WS server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
