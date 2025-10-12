// main.go
package main

import (
	"flag"
	"log"
	"time"

	"github.com/cjlawson02/5dcontrol/server/camera"
	"github.com/cjlawson02/5dcontrol/server/discovery"
	"github.com/cjlawson02/5dcontrol/server/server"
)

func main() {
	// Parse command line flags
	demoMode := flag.Bool("demo", false, "Run in demo mode with mock camera")
	flag.Parse()

	// start mDNS discovery
	go discovery.RunMDNSDiscovery()

	// create initial camera manager and update channel
	camCh := make(chan *camera.CameraManager)

	if *demoMode {
		log.Println("Starting in DEMO MODE with mock camera")
		mockCam := camera.NewMockCameraManager()

		// start HTTP MJPEG + snapshot server (no updates channel in demo mode)
		go server.RunHTTPServer(mockCam, nil)

		// start WebSocket control server (no updates channel in demo mode)
		go server.RunWebSocketServer(mockCam.CameraManager, nil)

		// Auto-connect mock camera
		go func() {
			if err := mockCam.Connect(); err != nil {
				log.Fatalf("Failed to start mock camera: %v", err)
			}
			log.Println("Mock camera connected!")

			// Mock camera runs forever (no need to send updates)
			select {}
		}()
	} else {
		log.Println("Starting with real camera")
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

				camCh <- cam // notify servers of connected camera

				// wait for disconnection
				<-cam.DisconnectedCh()
				log.Println("Camera disconnected")
			}
		}()
	}

	// block forever
	select {}
}
