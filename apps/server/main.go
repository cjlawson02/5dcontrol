// main.go
package main

import (
	"log"
	"time"

	"github.com/cjlawson02/5dcontrol/server/camera"
	"github.com/cjlawson02/5dcontrol/server/discovery"
	"github.com/cjlawson02/5dcontrol/server/server"
)

func main() {
	// start mDNS discovery
	go discovery.RunMDNSDiscovery()

	// create initial camera manager and update channel
	camCh := make(chan *camera.CameraManager)
	cam := camera.NewCameraManager()

	// start HTTP MJPEG + snapshot server
	go server.RunHTTPServer(cam, camCh)

	// start WebSocket control server
	go server.RunWebSocketServer(cam, camCh)

	// handle camera connection in background
	go func() {
		for {
			if err := cam.Connect(); err != nil {
				log.Printf("USB init error: %v", err)
				log.Println("Retrying in 5 seconds...")
				time.Sleep(5 * time.Second)
				continue
			}
			log.Println("Camera connected!")

			go cam.RunCaptureLoop()
			camCh <- cam // notify servers of connected camera

			// wait for disconnection
			<-cam.DisconnectedCh()
			log.Println("Camera disconnected")
		}
	}()

	// block forever
	select {}
}
