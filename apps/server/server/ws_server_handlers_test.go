package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	Proto "github.com/cjlawson02/5dcontrol/packages/proto/dist"
	flatbuffers "github.com/google/flatbuffers/go"
	"github.com/gorilla/websocket"
)

func TestWebSocketHandlers(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("Failed to upgrade connection: %v", err)
		}
		defer conn.Close()

		response := []byte("test response")
		_ = conn.WriteMessage(websocket.TextMessage, response)
		time.Sleep(50 * time.Millisecond)
	}))
	defer server.Close()

	conn, _, err := websocket.DefaultDialer.Dial("ws"+server.URL[4:], nil)
	if err != nil {
		t.Fatalf("Failed to connect to test server: %v", err)
	}
	defer conn.Close()

	command := buildTestCommand(Proto.ControlTypeQUERY_STATUS)
	err = conn.WriteMessage(websocket.BinaryMessage, command)
	if err != nil {
		t.Fatalf("Failed to send command: %v", err)
	}

	_, response, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read response: %v", err)
	}
	if len(response) == 0 {
		t.Error("Expected response, got empty")
	}
}

func buildTestCommand(controlType Proto.ControlType) []byte {
	builder := flatbuffers.NewBuilder(64)
	Proto.CommandStart(builder)
	Proto.CommandAddType(builder, controlType)
	cmd := Proto.CommandEnd(builder)

	Proto.MessageStart(builder)
	Proto.MessageAddMessageType(builder, Proto.MessageTypeCOMMAND)
	Proto.MessageAddCommand(builder, cmd)
	msg := Proto.MessageEnd(builder)
	builder.Finish(msg)
	return builder.FinishedBytes()
}
