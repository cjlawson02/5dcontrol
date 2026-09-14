package server

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/cjlawson02/5dcontrol/server/camera"
)

// RunHTTPServer starts the HTTP endpoints for MJPEG streaming and snapshots.
func RunHTTPServer(cam camera.CameraController, updates <-chan camera.CameraController) {
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
			frame := cam.GetLatestFrame()
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

	// Live-view snapshot (preview frame — not necessarily last capture).
	http.HandleFunc("/photo.jpg", func(w http.ResponseWriter, r *http.Request) {
		if cam == nil || !cam.IsConnected() {
			http.Error(w, "Camera not connected", http.StatusServiceUnavailable)
			return
		}

		frame := cam.GetLatestFrame()
		if frame == nil {
			http.Error(w, "No frame available", http.StatusServiceUnavailable)
			return
		}
		writeJPEG(w, frame.Data)
	})

	// Last-capture stills: /captures/{id}/full.jpg and /captures/{id}/thumb.jpg
	// Also /captures/latest/full.jpg and /captures/latest/thumb.jpg
	http.HandleFunc("/captures/", func(w http.ResponseWriter, r *http.Request) {
		if cam == nil {
			http.Error(w, "Camera unavailable", http.StatusServiceUnavailable)
			return
		}
		id, kind, ok := parseCapturePath(r.URL.Path)
		if !ok {
			http.NotFound(w, r)
			return
		}

		var cached *camera.CachedCapture
		if id == "latest" {
			cached = cam.GetLastCapture()
		} else {
			latest := cam.GetLastCapture()
			if latest != nil && latest.ID == id {
				cached = latest
			}
		}
		if cached == nil {
			http.Error(w, "Capture not found", http.StatusNotFound)
			return
		}

		var data []byte
		switch kind {
		case "full":
			data = cached.FullJPEG
		case "thumb":
			data = cached.ThumbJPEG
		default:
			http.NotFound(w, r)
			return
		}
		if len(data) == 0 {
			http.Error(w, "Capture empty", http.StatusNotFound)
			return
		}
		w.Header().Set("Cache-Control", "private, max-age=3600")
		writeJPEG(w, data)
	})

	addr := ":8080"
	log.Printf("HTTP server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func writeJPEG(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
	if _, err := w.Write(data); err != nil {
		log.Printf("Write error: %v", err)
		return
	}
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

// parseCapturePath extracts id and kind ("full"|"thumb") from /captures/{id}/{kind}.jpg
func parseCapturePath(path string) (id, kind string, ok bool) {
	const prefix = "/captures/"
	if !strings.HasPrefix(path, prefix) {
		return "", "", false
	}
	rest := strings.TrimPrefix(path, prefix)
	parts := strings.Split(rest, "/")
	if len(parts) != 2 {
		return "", "", false
	}
	id = parts[0]
	file := parts[1]
	switch file {
	case "full.jpg":
		return id, "full", id != ""
	case "thumb.jpg":
		return id, "thumb", id != ""
	default:
		return "", "", false
	}
}
