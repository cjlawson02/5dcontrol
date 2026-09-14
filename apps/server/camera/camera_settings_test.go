package camera

import (
	"testing"
)

func TestCameraSettings_TypesExist(t *testing.T) {
	settings := CameraSettings{
		ShutterSpeed:         "1/125",
		Aperture:             "f/5.6",
		ISO:                  "400",
		ExposureCompensation: "0",
		AutoExposureMode:     "Manual",
	}
	if settings.ISO != "400" {
		t.Fatalf("unexpected settings")
	}

	available := AvailableSettings{
		ISOs: []string{"100", "200", "400"},
	}
	if len(available.ISOs) != 3 {
		t.Fatalf("unexpected available settings")
	}
}
