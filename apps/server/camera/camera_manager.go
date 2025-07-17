package camera

import (
	"fmt"
	"log"
	_ "net/http/pprof"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cjlawson02/5dcontrol/server/gphoto2"
)

type Frame struct {
	Data      []byte
	Timestamp time.Time
}

type CameraManager struct {
	camera         *gphoto2.Camera
	ctx            *gphoto2.Context
	LatestFrame    atomic.Pointer[Frame]
	clients        sync.Map
	captureQuit    chan struct{}
	capturing      atomic.Bool
	isConnected    atomic.Bool
	disconnectedCh chan struct{}
	pausePreview   chan bool
}

var (
	framePool = sync.Pool{
		New: func() any {
			return new(Frame)
		},
	}
)

func NewCameraManager() *CameraManager {
	return &CameraManager{
		disconnectedCh: make(chan struct{}),
		isConnected:    atomic.Bool{},
		pausePreview:   make(chan bool),
	}
}

func (manager *CameraManager) Connect() error {
	if manager.isConnected.Load() {
		return nil
	}

	ctx := gphoto2.NewContext()
	if ctx == nil {
		return fmt.Errorf("failed to create camera context")
	}

	camera, err := gphoto2.NewCamera()
	if err != nil {
		ctx.Close()
		return fmt.Errorf("failed to create camera: %w", err)
	}

	if err := camera.Init(ctx); err != nil {
		camera.Close()
		ctx.Close()
		return fmt.Errorf("failed to initialize camera: %w", err)
	}

	_ = camera.SetConfigValueString("capturetarget", "Memory card", ctx)
	_ = camera.SetConfigValueString("reviewtime", "None", ctx)

	manager.camera = camera
	manager.ctx = ctx
	manager.captureQuit = make(chan struct{})
	manager.disconnectedCh = make(chan struct{}) // Create new channel for new connection
	manager.isConnected.Store(true)
	return nil
}

func (manager *CameraManager) AddClient(id string) {
	if !manager.isConnected.Load() {
		return // Don't start capture if camera is not connected
	}

	if _, loaded := manager.clients.LoadOrStore(id, struct{}{}); !loaded {
		// First client - start capture
		if !manager.capturing.Swap(true) {
			manager.captureQuit = make(chan struct{})
			go manager.RunCaptureLoop()
		}
	}
}

func (manager *CameraManager) RemoveClient(id string) {
	if _, loaded := manager.clients.LoadAndDelete(id); loaded {
		// Check if this was the last client
		empty := true
		manager.clients.Range(func(key, value any) bool {
			empty = false
			return false
		})

		if empty {
			// Last client disconnected - stop capture
			if manager.capturing.Swap(false) {
				close(manager.captureQuit)
			}
		}
	}
}

func (manager *CameraManager) CaptureImage() error {
	if !manager.isConnected.Load() {
		return fmt.Errorf("camera is not connected")
	}

	manager.pausePreview <- true // request pause

	err := manager.camera.Capture(manager.ctx)

	manager.pausePreview <- false
	return err
}

func (manager *CameraManager) RunCaptureLoop() {
	if !manager.isConnected.Load() {
		return // Don't run capture loop if camera is not connected
	}

	file, err := manager.camera.File()
	if err != nil {
		log.Fatal("failed to create CameraFile")
	}
	defer file.Close()

	var frameCount int
	var start = time.Now()

	for manager.capturing.Load() {
		select {
		case <-manager.captureQuit:
			return
		case pause := <-manager.pausePreview:
			if pause {
				<-manager.pausePreview // wait for resume
			}
		default:
			if err := manager.camera.CapturePreview(file, manager.ctx); err != nil {
				log.Printf("CapturePreview failed: %v", err)
				if err.Error() == "Could not find the requested device on the USB port" {
					manager.handleDisconnect()
					return
				}
				time.Sleep(1 * time.Second)
				continue
			}

			data, size, err := file.GetDataAndSize()
			if err != nil {
				log.Printf("Failed to get data: %v", err)
				if err.Error() == "Could not find the requested device on the USB port" {
					manager.handleDisconnect()
					return
				}
				time.Sleep(1 * time.Second)
				continue
			}

			frame := framePool.Get().(*Frame)

			// reuse buffer if capacity is enough
			if cap(frame.Data) < size {
				frame.Data = make([]byte, size)
			} else {
				frame.Data = frame.Data[:size]
			}
			copy(frame.Data, data)

			frame.Timestamp = time.Now()

			old := manager.LatestFrame.Swap(frame)
			if old != nil {
				framePool.Put(old)
			}

			frameCount++
			if time.Since(start) >= 3*time.Second {
				fps := float64(frameCount) / time.Since(start).Seconds()
				log.Printf("Average FPS: %.2f", fps)
				frameCount = 0
				start = time.Now()
			}
		}
	}
}

func (manager *CameraManager) DisconnectedCh() <-chan struct{} {
	return manager.disconnectedCh
}

func (manager *CameraManager) IsConnected() bool {
	return manager.isConnected.Load()
}

func (manager *CameraManager) handleDisconnect() {
	manager.isConnected.Store(false)
	if manager.camera != nil {
		manager.camera.Close()
		manager.ctx.Close()
		manager.camera = nil
		manager.ctx = nil
	}
	// Clear the latest frame to prevent showing stale frames
	if old := manager.LatestFrame.Swap(nil); old != nil {
		framePool.Put(old)
	}
	close(manager.disconnectedCh)
}

func (manager *CameraManager) Close() {
	if manager.camera != nil {
		log.Println("Releasing camera...")
		if err := manager.camera.Exit(manager.ctx); err != nil {
			log.Printf("Failed to exit camera: %v", err)
		}
		manager.handleDisconnect()
		time.Sleep(1 * time.Second) // allow USB flush
	}
}
