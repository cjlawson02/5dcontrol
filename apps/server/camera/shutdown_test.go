package camera

import (
	"testing"
	"time"
)

func TestMockCamera_CloseStopsPreviewCleanly(t *testing.T) {
	mock := NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatal(err)
	}
	mock.AddClient("test")
	time.Sleep(100 * time.Millisecond)

	done := make(chan struct{})
	go func() {
		mock.Close()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Close hung; preview likely blocked on pause/resume")
	}

	if mock.IsConnected() {
		t.Fatal("expected disconnected after Close")
	}
	if mock.capturing.Load() {
		t.Fatal("expected preview stopped after Close")
	}
}

func TestHandleDisconnectFromPreviewDoesNotDeadlock(t *testing.T) {
	mock := NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatal(err)
	}
	mock.AddClient("preview")
	time.Sleep(50 * time.Millisecond)

	// Simulate USB-error path: disconnect signaled from the preview goroutine.
	done := make(chan struct{})
	go func() {
		defer close(done)
		mock.handleDisconnect()
		select {
		case <-mock.DisconnectedCh():
		case <-time.After(2 * time.Second):
			t.Error("disconnectedCh not closed")
		}
	}()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("handleDisconnect path deadlocked")
	}
}

func TestConnectResetsCloseOnce(t *testing.T) {
	mock := NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatal(err)
	}
	mock.Close()

	if err := mock.Connect(); err != nil {
		t.Fatal(err)
	}
	mock.AddClient("again")
	time.Sleep(50 * time.Millisecond)

	done := make(chan struct{})
	go func() {
		mock.Close()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("second Close hung; closeOnce likely not reset on Connect")
	}
}
