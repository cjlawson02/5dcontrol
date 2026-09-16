package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	Proto "github.com/cjlawson02/5dcontrol/packages/proto/dist"
	"github.com/cjlawson02/5dcontrol/server/camera"
	flatbuffers "github.com/google/flatbuffers/go"
	"github.com/gorilla/websocket"
)

func startMockSettingsWSServer(t *testing.T, cam camera.CameraController) (*httptest.Server, *clientHub) {
	t.Helper()

	testHub := newClientHub()
	go testHub.run()
	prev := hub
	hub = testHub
	t.Cleanup(func() {
		hub = prev
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		testHub.register <- conn
		defer func() { testHub.unregister <- conn }()

		sendStatus(conn, cam)

		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			msg := Proto.GetRootAsMessage(data, 0)
			if msg.MessageType() != Proto.MessageTypeCOMMAND {
				continue
			}
			cmd := new(Proto.Command)
			if msg.Command(cmd) == nil {
				continue
			}
			switch cmd.Type() {
			case Proto.ControlTypeQUERY_STATUS:
				sendStatus(conn, cam)
			case Proto.ControlTypeQUERY_SETTINGS:
				sendCurrentSettings(conn, cam)
			case Proto.ControlTypeQUERY_AVAILABLE_SETTINGS:
				sendAvailableSettings(conn, cam)
			case Proto.ControlTypeSET_SETTING:
				handleSetSetting(cam, cmd)
			}
		}
	}))
	t.Cleanup(server.Close)
	return server, testHub
}

func dialWS(t *testing.T, server *httptest.Server) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial("ws"+server.URL[4:], nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func readMessageOfType(t *testing.T, conn *websocket.Conn, want Proto.MessageType) *Proto.Message {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	_ = conn.SetReadDeadline(deadline)
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("read message (want %v): %v", want, err)
		}
		msg := Proto.GetRootAsMessage(data, 0)
		if msg.MessageType() == want {
			return msg
		}
	}
}

func buildSetSettingCommand(field Proto.SettingField, value string) []byte {
	builder := flatbuffers.NewBuilder(64)
	valueOff := builder.CreateString(value)
	Proto.CommandStart(builder)
	Proto.CommandAddType(builder, Proto.ControlTypeSET_SETTING)
	Proto.CommandAddSettingField(builder, field)
	Proto.CommandAddSettingValue(builder, valueOff)
	cmd := Proto.CommandEnd(builder)

	Proto.MessageStart(builder)
	Proto.MessageAddMessageType(builder, Proto.MessageTypeCOMMAND)
	Proto.MessageAddCommand(builder, cmd)
	msg := Proto.MessageEnd(builder)
	builder.Finish(msg)
	return builder.FinishedBytes()
}

func TestSettings_QueryCurrent(t *testing.T) {
	mock := camera.NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { mock.Close() })

	server, _ := startMockSettingsWSServer(t, mock)
	conn := dialWS(t, server)

	// Drain initial STATUS
	_ = readMessageOfType(t, conn, Proto.MessageTypeSTATUS)

	if err := conn.WriteMessage(websocket.BinaryMessage, buildTestCommand(Proto.ControlTypeQUERY_SETTINGS)); err != nil {
		t.Fatalf("write QUERY_SETTINGS: %v", err)
	}

	msg := readMessageOfType(t, conn, Proto.MessageTypeCURRENT_SETTINGS)
	cs := new(Proto.CurrentSettings)
	if msg.CurrentSettings(cs) == nil {
		t.Fatal("expected current_settings payload")
	}
	if string(cs.Iso()) != "400" {
		t.Errorf("iso = %q, want 400", cs.Iso())
	}
	if string(cs.ShutterSpeed()) != "1/125" {
		t.Errorf("shutter = %q, want 1/125", cs.ShutterSpeed())
	}
	if string(cs.Aperture()) != "f/5.6" {
		t.Errorf("aperture = %q, want f/5.6", cs.Aperture())
	}
}

func TestSettings_QueryAvailable(t *testing.T) {
	mock := camera.NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { mock.Close() })

	server, _ := startMockSettingsWSServer(t, mock)
	conn := dialWS(t, server)
	_ = readMessageOfType(t, conn, Proto.MessageTypeSTATUS)

	if err := conn.WriteMessage(websocket.BinaryMessage, buildTestCommand(Proto.ControlTypeQUERY_AVAILABLE_SETTINGS)); err != nil {
		t.Fatalf("write QUERY_AVAILABLE_SETTINGS: %v", err)
	}

	msg := readMessageOfType(t, conn, Proto.MessageTypeAVAILABLE_SETTINGS)
	as := new(Proto.AvailableSettings)
	if msg.AvailableSettings(as) == nil {
		t.Fatal("expected available_settings payload")
	}
	if as.IsosLength() < 1 {
		t.Fatal("expected non-empty ISO list from mock")
	}
	if as.ShutterSpeedsLength() < 1 {
		t.Fatal("expected non-empty shutter list from mock")
	}
	if as.AperturesLength() < 1 {
		t.Fatal("expected non-empty aperture list from mock")
	}
}

func TestSettings_SetISO_BroadcastsCurrent(t *testing.T) {
	mock := camera.NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { mock.Close() })

	server, _ := startMockSettingsWSServer(t, mock)
	conn := dialWS(t, server)
	_ = readMessageOfType(t, conn, Proto.MessageTypeSTATUS)

	if err := conn.WriteMessage(websocket.BinaryMessage, buildSetSettingCommand(Proto.SettingFieldISO, "800")); err != nil {
		t.Fatalf("write SET_SETTING: %v", err)
	}

	msg := readMessageOfType(t, conn, Proto.MessageTypeCURRENT_SETTINGS)
	cs := new(Proto.CurrentSettings)
	if msg.CurrentSettings(cs) == nil {
		t.Fatal("expected current_settings after set")
	}
	if string(cs.Iso()) != "800" {
		t.Errorf("iso after set = %q, want 800", cs.Iso())
	}

	got, err := mock.GetCurrentSettings()
	if err != nil {
		t.Fatalf("GetCurrentSettings: %v", err)
	}
	if got.ISO != "800" {
		t.Errorf("mock ISO = %q, want 800", got.ISO)
	}
}

func TestSettings_SetShutterAndAperture(t *testing.T) {
	mock := camera.NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { mock.Close() })

	server, _ := startMockSettingsWSServer(t, mock)
	conn := dialWS(t, server)
	_ = readMessageOfType(t, conn, Proto.MessageTypeSTATUS)

	cases := []struct {
		field Proto.SettingField
		value string
		check func(*camera.CameraSettings) string
	}{
		{Proto.SettingFieldSHUTTER_SPEED, "1/500", func(s *camera.CameraSettings) string { return s.ShutterSpeed }},
		{Proto.SettingFieldAPERTURE, "f/8", func(s *camera.CameraSettings) string { return s.Aperture }},
		{Proto.SettingFieldEXPOSURE_COMPENSATION, "+1", func(s *camera.CameraSettings) string { return s.ExposureCompensation }},
	}

	for _, tc := range cases {
		if err := conn.WriteMessage(websocket.BinaryMessage, buildSetSettingCommand(tc.field, tc.value)); err != nil {
			t.Fatalf("write SET_SETTING %v: %v", tc.field, err)
		}
		msg := readMessageOfType(t, conn, Proto.MessageTypeCURRENT_SETTINGS)
		cs := new(Proto.CurrentSettings)
		if msg.CurrentSettings(cs) == nil {
			t.Fatalf("missing current_settings for %v", tc.field)
		}
		got, err := mock.GetCurrentSettings()
		if err != nil {
			t.Fatalf("GetCurrentSettings: %v", err)
		}
		if tc.check(got) != tc.value {
			t.Errorf("%v = %q, want %q", tc.field, tc.check(got), tc.value)
		}
	}
}

func TestBuildCurrentSettingsMessage_RoundTrip(t *testing.T) {
	raw := buildCurrentSettingsMessage(&camera.CameraSettings{
		ShutterSpeed:         "1/250",
		Aperture:             "f/4",
		ISO:                  "200",
		ExposureCompensation: "-1",
	})
	msg := Proto.GetRootAsMessage(raw, 0)
	if msg.MessageType() != Proto.MessageTypeCURRENT_SETTINGS {
		t.Fatalf("type = %v", msg.MessageType())
	}
	cs := new(Proto.CurrentSettings)
	if msg.CurrentSettings(cs) == nil {
		t.Fatal("nil current settings")
	}
	if string(cs.Iso()) != "200" || string(cs.Aperture()) != "f/4" {
		t.Fatalf("unexpected payload iso=%q aperture=%q", cs.Iso(), cs.Aperture())
	}
}

func TestApplySetting_UnknownFieldNoOp(t *testing.T) {
	mock := camera.NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { mock.Close() })

	if err := applySetting(mock, Proto.SettingFieldNONE, "x"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
