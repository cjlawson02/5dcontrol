package server

import (
	"log"

	Proto "github.com/cjlawson02/5dcontrol/packages/proto/dist"
	"github.com/cjlawson02/5dcontrol/server/camera"
	flatbuffers "github.com/google/flatbuffers/go"
	"github.com/gorilla/websocket"
)

func asSettingsController(cam camera.CameraController) (camera.SettingsController, bool) {
	sc, ok := cam.(camera.SettingsController)
	return sc, ok
}

func createStringVector(builder *flatbuffers.Builder, values []string) flatbuffers.UOffsetT {
	n := len(values)
	offsets := make([]flatbuffers.UOffsetT, n)
	for i, v := range values {
		offsets[i] = builder.CreateString(v)
	}
	builder.StartVector(4, n, 4)
	for i := n - 1; i >= 0; i-- {
		builder.PrependUOffsetT(offsets[i])
	}
	return builder.EndVector(n)
}

func buildCurrentSettingsMessage(s *camera.CameraSettings) []byte {
	builder := flatbuffers.NewBuilder(256)

	shutterOff := builder.CreateString(s.ShutterSpeed)
	apertureOff := builder.CreateString(s.Aperture)
	isoOff := builder.CreateString(s.ISO)
	ecOff := builder.CreateString(s.ExposureCompensation)

	Proto.CurrentSettingsStart(builder)
	Proto.CurrentSettingsAddShutterSpeed(builder, shutterOff)
	Proto.CurrentSettingsAddAperture(builder, apertureOff)
	Proto.CurrentSettingsAddIso(builder, isoOff)
	Proto.CurrentSettingsAddExposureCompensation(builder, ecOff)
	settings := Proto.CurrentSettingsEnd(builder)

	Proto.MessageStart(builder)
	Proto.MessageAddMessageType(builder, Proto.MessageTypeCURRENT_SETTINGS)
	Proto.MessageAddCurrentSettings(builder, settings)
	msg := Proto.MessageEnd(builder)

	builder.Finish(msg)
	return builder.FinishedBytes()
}

func buildAvailableSettingsMessage(s *camera.AvailableSettings) []byte {
	builder := flatbuffers.NewBuilder(512)

	shutterVec := createStringVector(builder, s.ShutterSpeeds)
	apertureVec := createStringVector(builder, s.Apertures)
	isoVec := createStringVector(builder, s.ISOs)
	ecVec := createStringVector(builder, s.ExposureCompensations)

	Proto.AvailableSettingsStart(builder)
	Proto.AvailableSettingsAddShutterSpeeds(builder, shutterVec)
	Proto.AvailableSettingsAddApertures(builder, apertureVec)
	Proto.AvailableSettingsAddIsos(builder, isoVec)
	Proto.AvailableSettingsAddExposureCompensations(builder, ecVec)
	available := Proto.AvailableSettingsEnd(builder)

	Proto.MessageStart(builder)
	Proto.MessageAddMessageType(builder, Proto.MessageTypeAVAILABLE_SETTINGS)
	Proto.MessageAddAvailableSettings(builder, available)
	msg := Proto.MessageEnd(builder)

	builder.Finish(msg)
	return builder.FinishedBytes()
}

func sendCurrentSettings(conn *websocket.Conn, cam camera.CameraController) {
	sc, ok := asSettingsController(cam)
	if !ok {
		log.Println("QUERY_SETTINGS: camera does not support settings")
		return
	}
	settings, err := sc.GetCurrentSettings()
	if err != nil {
		log.Printf("GetCurrentSettings failed: %v", err)
		return
	}
	if err := conn.WriteMessage(websocket.BinaryMessage, buildCurrentSettingsMessage(settings)); err != nil {
		log.Println("Failed to send current settings:", err)
	}
}

func sendAvailableSettings(conn *websocket.Conn, cam camera.CameraController) {
	sc, ok := asSettingsController(cam)
	if !ok {
		log.Println("QUERY_AVAILABLE_SETTINGS: camera does not support settings")
		return
	}
	available, err := sc.GetAvailableSettings()
	if err != nil {
		log.Printf("GetAvailableSettings failed: %v", err)
		return
	}
	if err := conn.WriteMessage(websocket.BinaryMessage, buildAvailableSettingsMessage(available)); err != nil {
		log.Println("Failed to send available settings:", err)
	}
}

func broadcastCurrentSettings(cam camera.CameraController) {
	if hub == nil {
		return
	}
	sc, ok := asSettingsController(cam)
	if !ok {
		return
	}
	settings, err := sc.GetCurrentSettings()
	if err != nil {
		log.Printf("broadcastCurrentSettings: GetCurrentSettings failed: %v", err)
		return
	}
	hub.broadcast <- buildCurrentSettingsMessage(settings)
}

func applySetting(sc camera.SettingsController, field Proto.SettingField, value string) error {
	switch field {
	case Proto.SettingFieldISO:
		return sc.SetISO(value)
	case Proto.SettingFieldSHUTTER_SPEED:
		return sc.SetShutterSpeed(value)
	case Proto.SettingFieldAPERTURE:
		return sc.SetAperture(value)
	case Proto.SettingFieldEXPOSURE_COMPENSATION:
		return sc.SetExposureCompensation(value)
	default:
		log.Printf("SET_SETTING: unknown field %v", field)
		return nil
	}
}

func handleSetSetting(cam camera.CameraController, cmd *Proto.Command) {
	sc, ok := asSettingsController(cam)
	if !ok {
		log.Println("SET_SETTING: camera does not support settings")
		return
	}
	field := cmd.SettingField()
	value := string(cmd.SettingValue())
	if field == Proto.SettingFieldNONE || value == "" {
		log.Println("SET_SETTING: missing field or value")
		return
	}
	log.Printf("SET_SETTING %v = %q", field, value)
	if err := applySetting(sc, field, value); err != nil {
		log.Printf("SET_SETTING failed: %v", err)
		return
	}
	broadcastCurrentSettings(cam)
}
