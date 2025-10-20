package camera

import "time"

// CameraController interface defines operations for controlling a camera
// This interface allows for different implementations (real hardware, mock, etc.)
type CameraController interface {
	// Connection and status
	IsConnected() bool
	GetBatteryLevel() uint8

	// Camera operations
	TriggerFocus() error
	CaptureImage() error

	// Client management for live preview streaming
	AddClient(id string)
	RemoveClient(id string)
	GetLatestFrame() *Frame
}

// Frame represents a single preview frame from the camera
type Frame struct {
	Data      []byte
	Timestamp time.Time
}

// ImageInfo represents information about an image on the camera
type ImageInfo struct {
	Filename  string
	Folder    string
	Size      uint64
	Timestamp uint64
}

// CameraSettings represents current camera settings
type CameraSettings struct {
	ShutterSpeed         string
	Aperture             string
	ISO                  string
	ExposureCompensation string
	AutoExposureMode     string
}

// AvailableSettings represents available camera setting values
type AvailableSettings struct {
	ShutterSpeeds         []string
	Apertures             []string
	ISOs                  []string
	ExposureCompensations []string
	AutoExposureModes     []string
}
