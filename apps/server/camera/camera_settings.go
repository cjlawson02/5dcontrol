package camera

import (
	"fmt"
	"log"
)

// GetCurrentSettings reads current camera settings via the exclusive USB worker.
func (manager *RealCamera) GetCurrentSettings() (*CameraSettings, error) {
	res, err := manager.runExclusive(OperationSettings, func() (any, error) {
		settings := &CameraSettings{}

		shutterKeys := []string{"shutterspeed", "/main/capturesettings/shutterspeed"}
		for _, key := range shutterKeys {
			if value, err := manager.camera.GetConfigValueString(key, manager.ctx); err == nil {
				settings.ShutterSpeed = value
				break
			}
		}

		apertureKeys := []string{"aperture", "/main/capturesettings/aperture"}
		for _, key := range apertureKeys {
			if value, err := manager.camera.GetConfigValueString(key, manager.ctx); err == nil {
				settings.Aperture = value
				break
			}
		}

		isoKeys := []string{"iso", "/main/imgsettings/iso"}
		for _, key := range isoKeys {
			if value, err := manager.camera.GetConfigValueString(key, manager.ctx); err == nil {
				settings.ISO = value
				break
			}
		}

		evKeys := []string{"exposurecompensation", "/main/capturesettings/exposurecompensation"}
		for _, key := range evKeys {
			if value, err := manager.camera.GetConfigValueString(key, manager.ctx); err == nil {
				settings.ExposureCompensation = value
				break
			}
		}

		aeKeys := []string{"autoexposuremode", "/main/capturesettings/autoexposuremode"}
		for _, key := range aeKeys {
			if value, err := manager.camera.GetConfigValueString(key, manager.ctx); err == nil {
				settings.AutoExposureMode = value
				break
			}
		}

		return settings, nil
	})
	if err != nil {
		return nil, err
	}
	settings, _ := res.Data.(*CameraSettings)
	return settings, nil
}

// GetAvailableSettings returns available choices when supported.
// Note: gphoto2 choice enumeration is not wired yet; returns empty lists.
func (manager *RealCamera) GetAvailableSettings() (*AvailableSettings, error) {
	if !manager.isConnected.Load() {
		return nil, ErrNotConnected
	}
	return &AvailableSettings{}, nil
}

func (manager *RealCamera) setConfigValue(keys []string, value string, label string) error {
	_, err := manager.runExclusive(OperationSettings, func() (any, error) {
		for _, key := range keys {
			if err := manager.camera.SetConfigValueString(key, value, manager.ctx); err == nil {
				log.Printf("Set %s to %s using key %s", label, value, key)
				return nil, nil
			}
		}
		return nil, fmt.Errorf("failed to set %s to %s", label, value)
	})
	return err
}

// SetShutterSpeed sets camera shutter speed through the busy/worker path.
func (manager *RealCamera) SetShutterSpeed(value string) error {
	return manager.setConfigValue(
		[]string{"shutterspeed", "/main/capturesettings/shutterspeed"},
		value,
		"shutter speed",
	)
}

// SetAperture sets camera aperture through the busy/worker path.
func (manager *RealCamera) SetAperture(value string) error {
	return manager.setConfigValue(
		[]string{"aperture", "/main/capturesettings/aperture"},
		value,
		"aperture",
	)
}

// SetISO sets camera ISO through the busy/worker path.
func (manager *RealCamera) SetISO(value string) error {
	return manager.setConfigValue(
		[]string{"iso", "/main/imgsettings/iso"},
		value,
		"ISO",
	)
}

// SetExposureCompensation sets EV through the busy/worker path.
func (manager *RealCamera) SetExposureCompensation(value string) error {
	return manager.setConfigValue(
		[]string{"exposurecompensation", "/main/capturesettings/exposurecompensation"},
		value,
		"exposure compensation",
	)
}
