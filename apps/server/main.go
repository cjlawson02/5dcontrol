// main.go
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/cjlawson02/5dcontrol/server/camera"
	"github.com/cjlawson02/5dcontrol/server/discovery"
	"github.com/cjlawson02/5dcontrol/server/server"
)

func main() {
	demoMode := flag.Bool("demo", false, "Run in demo mode with mock camera")
	benchCompletion := flag.Bool("bench-completion", false, "Compare capture completion modes (A/B/hybrid) then exit")
	benchIters := flag.Int("bench-iters", 3, "Iterations per completion mode")
	flag.Parse()

	if *benchCompletion {
		runCompletionBench(*demoMode, *benchIters)
		return
	}

	go discovery.RunMDNSDiscovery()

	camCh := make(chan camera.CameraController)

	if *demoMode {
		log.Println("Starting in DEMO MODE with mock camera")
		mockCam := camera.NewMockCamera()

		go server.RunHTTPServer(mockCam, nil)
		go server.RunWebSocketServer(mockCam, nil)

		go func() {
			if err := mockCam.Connect(); err != nil {
				log.Fatalf("Failed to start mock camera: %v", err)
			}
			log.Println("Mock camera connected!")
			select {}
		}()
	} else {
		log.Println("Starting with real camera")
		cam := camera.NewRealCamera()

		go server.RunHTTPServer(cam, camCh)
		go server.RunWebSocketServer(cam, camCh)

		go func() {
			for {
				if err := cam.Connect(); err != nil {
					log.Printf("USB init error: %v", err)
					log.Println("Retrying in 5 seconds...")
					time.Sleep(5 * time.Second)
					continue
				}
				log.Println("Camera connected!")

				camCh <- cam

				<-cam.DisconnectedCh()
				log.Println("Camera disconnected")
			}
		}()
	}

	select {}
}

func runCompletionBench(demo bool, iters int) {
	cfg := camera.DefaultBenchConfig()
	cfg.Iterations = iters

	var report camera.BenchReport
	var err error

	if demo {
		log.Println("Running completion bench against MOCK camera (simulated event lag)")
		mock := camera.NewMockCamera()
		report, err = camera.RunCompletionBench(mock, cfg)
		mock.Close()
	} else {
		log.Println("Running completion bench against REAL camera")
		cam := camera.NewRealCamera()
		report, err = camera.RunCompletionBench(cam, cfg)
		cam.Close()
	}

	if err != nil {
		log.Fatalf("bench failed: %v", err)
	}

	fmt.Fprint(os.Stdout, report.Format())
}
