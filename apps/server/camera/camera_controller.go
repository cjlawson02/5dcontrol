package camera

import "time"

// CameraController interface defines operations for controlling a camera
// This interface allows for different implementations (real hardware, mock, etc.)
type CameraController interface {
	// Connection and status
	IsConnected() bool
	GetBatteryLevel() uint8

	// Camera operations
	TriggerFocus() (*OperationResult, error)
	CaptureImage() (*OperationResult, error)

	// Client management for live preview streaming
	AddClient(id string)
	RemoveClient(id string)
	GetLatestFrame() *Frame

	// Last still cached after a successful CaptureImage (nil if none yet).
	GetLastCapture() *CachedCapture
}

// SettingsController is optional: settings that touch camera hardware.
// Real and mock cameras implement this; wire through the same busy/worker path.
type SettingsController interface {
	GetCurrentSettings() (*CameraSettings, error)
	GetAvailableSettings() (*AvailableSettings, error)
	SetShutterSpeed(value string) error
	SetAperture(value string) error
	SetISO(value string) error
	SetExposureCompensation(value string) error
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
