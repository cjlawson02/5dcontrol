package server

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/cjlawson02/5dcontrol/server/camera"
)

// RunHTTPServer starts the HTTP endpoints for MJPEG streaming and snapshots.
func RunHTTPServer(cam *camera.CameraManager, updates <-chan *camera.CameraManager) {
	if updates != nil {
		go func() {
			for c := range updates {
				cam = c
			}
		}()
	}
	// MJPEG stream handler
	http.HandleFunc("/live.mjpeg", func(w http.ResponseWriter, r *http.Request) {
		clientID := r.RemoteAddr
		log.Printf("New MJPEG client connected: %s", clientID)

		if cam == nil || !cam.IsConnected() {
			http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
			return
		}

		w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
		cam.AddClient(clientID)
		defer cam.RemoveClient(clientID)

		var lastFrame *camera.Frame
		for cam.IsConnected() {
			frame := cam.LatestFrame.Load()
			if frame == nil || frame == lastFrame {
				time.Sleep(1 * time.Millisecond)
				continue
			}
			header := fmt.Appendf(nil, "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", len(frame.Data))
			if _, err := w.Write(header); err != nil {
				log.Printf("Write error: %v\n", err)
				return
			}
			if _, err := w.Write(frame.Data); err != nil {
				log.Printf("Write error: %v\n", err)
				return
			}
			if _, err := w.Write([]byte("\r\n")); err != nil {
				log.Printf("Write trailer error: %v\n", err)
				return
			}

			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}

			lastFrame = frame
		}
	})

	// Snapshot handler
	http.HandleFunc("/photo.jpg", func(w http.ResponseWriter, r *http.Request) {
		if cam == nil || !cam.IsConnected() {
			http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
			return
		}

		frame := cam.LatestFrame.Load()
		if frame == nil {
			http.Error(w, "No frame available", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(frame.Data)))
		if _, err := w.Write(frame.Data); err != nil {
			log.Printf("Write error: %v", err)
			return
		}

		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	})

	addr := ":8080"
	log.Printf("HTTP server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
