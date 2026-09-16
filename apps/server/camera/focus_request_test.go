package camera

import "testing"

func TestClampFocusPoint(t *testing.T) {
	x, y := ClampFocusPoint(-0.2, 1.5)
	if x != 0 || y != 1 {
		t.Fatalf("ClampFocusPoint(-0.2, 1.5) = (%v, %v), want (0, 1)", x, y)
	}
	x, y = ClampFocusPoint(0.25, 0.75)
	if x != 0.25 || y != 0.75 {
		t.Fatalf("ClampFocusPoint kept values, got (%v, %v)", x, y)
	}
}

func TestMockCamera_TriggerFocusAtPoint(t *testing.T) {
	mock := NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatal(err)
	}
	defer mock.Close()

	res, err := mock.TriggerFocus(FocusRequest{HasPoint: true, X: 0.25, Y: 0.75})
	if err != nil {
		t.Fatalf("TriggerFocus: %v", err)
	}
	if res == nil || res.Status != OperationStatusSuccess {
		t.Fatalf("expected success, got %+v", res)
	}
}
