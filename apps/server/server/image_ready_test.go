package server

import (
	"testing"

	"github.com/cjlawson02/5dcontrol/server/camera"
	Proto "github.com/cjlawson02/5dcontrol/packages/proto/dist"
)

func TestBuildImageReadyMessage(t *testing.T) {
	c := &camera.CachedCapture{
		ID:        "42",
		FullJPEG:  []byte{1},
		ThumbJPEG: []byte{2},
	}
	raw := buildImageReadyMessage(c)
	msg := Proto.GetRootAsMessage(raw, 0)
	if msg.MessageType() != Proto.MessageTypeIMAGE_READY {
		t.Fatalf("type = %v", msg.MessageType())
	}
	ir := new(Proto.ImageReady)
	if msg.ImageReady(ir) == nil {
		t.Fatal("missing image_ready")
	}
	if string(ir.ImageId()) != "42" {
		t.Errorf("id = %s", ir.ImageId())
	}
	if string(ir.ThumbPath()) != "/captures/42/thumb.jpg" {
		t.Errorf("thumb = %s", ir.ThumbPath())
	}
	if string(ir.FullPath()) != "/captures/42/full.jpg" {
		t.Errorf("full = %s", ir.FullPath())
	}
}
