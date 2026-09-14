package camera

import (
	"strings"
	"testing"
	"time"
)

func TestCompletionBench_MockShowsModeDifferences(t *testing.T) {
	mock := NewMockCamera()
	mock.simulatedEventLag = 150 * time.Millisecond

	cfg := BenchConfig{
		Iterations:  2,
		SettlePause: 20 * time.Millisecond,
		WithPreview: true,
		Modes: []CompletionMode{
			CompletionCommandReturn,
			CompletionWaitEvent,
			CompletionHybrid,
		},
	}

	report, err := RunCompletionBench(mock, cfg)
	if err != nil {
		t.Fatalf("RunCompletionBench: %v", err)
	}

	a := report.ByMode[CompletionCommandReturn]
	b := report.ByMode[CompletionWaitEvent]
	if len(a) != 2 || len(b) != 2 {
		t.Fatalf("expected 2 timings per mode, got A=%d B=%d", len(a), len(b))
	}
	if !a[0].Success || !b[0].Success {
		t.Fatalf("expected successful timings")
	}
	// A should finish near command return (~100ms); B waits for simulated event lag.
	if a[0].DoneAt >= b[0].DoneAt {
		t.Fatalf("expected command-return done (%v) < wait-event done (%v)", a[0].DoneAt, b[0].DoneAt)
	}
	if b[0].FirstUsefulEvent != "file-added" {
		t.Fatalf("expected file-added event in B, got %q", b[0].FirstUsefulEvent)
	}

	out := report.Format()
	if !strings.Contains(out, "command-return") || !strings.Contains(out, "wait-event") {
		t.Fatalf("report missing mode labels:\n%s", out)
	}
}

func TestMockSettingsGoThroughBusyPath(t *testing.T) {
	mock := NewMockCamera()
	if err := mock.Connect(); err != nil {
		t.Fatal(err)
	}

	if err := mock.SetISO("800"); err != nil {
		t.Fatalf("SetISO: %v", err)
	}
	settings, err := mock.GetCurrentSettings()
	if err != nil {
		t.Fatalf("GetCurrentSettings: %v", err)
	}
	if settings.ISO != "800" {
		t.Fatalf("expected ISO 800, got %s", settings.ISO)
	}

	// Busy: start focus in background-ish by holding state
	if err := mock.stateMachine.StartOperation(OperationFocus, mock.previewManager); err != nil {
		t.Fatal(err)
	}
	err = mock.SetAperture("f/8")
	if err != ErrCameraBusy {
		t.Fatalf("expected ErrCameraBusy, got %v", err)
	}
	mock.stateMachine.CompleteOperation()
	mock.previewManager.resumePreview()
}
