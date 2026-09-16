package camera

import (
	"fmt"
	"log"
	"strings"
	"time"
)

// BenchConfig controls a completion-mode comparison run.
type BenchConfig struct {
	Iterations   int
	SettlePause  time.Duration
	WithPreview  bool
	Modes        []CompletionMode
}

// DefaultBenchConfig returns sensible defaults for a hardware/demo comparison.
func DefaultBenchConfig() BenchConfig {
	return BenchConfig{
		Iterations:  3,
		SettlePause: 750 * time.Millisecond,
		WithPreview: true,
		Modes: []CompletionMode{
			CompletionCommandReturn,
			CompletionWaitEvent,
			CompletionHybrid,
		},
	}
}

// BenchReport summarizes A/B/hybrid capture timings.
type BenchReport struct {
	ByMode map[CompletionMode][]CaptureTiming
}

// Format returns a human-readable comparison table.
func (r BenchReport) Format() string {
	var b strings.Builder
	b.WriteString("\n=== Capture completion bench ===\n")
	b.WriteString("Compare command-return (A) vs wait-event (B) vs hybrid.\n")
	b.WriteString("Decision: prefer the mode with high success, low DoneAt,\n")
	b.WriteString("and FirstUsefulEventAt that lines up with when the file is actually ready.\n\n")

	for _, mode := range []CompletionMode{CompletionCommandReturn, CompletionWaitEvent, CompletionHybrid} {
		timings, ok := r.ByMode[mode]
		if !ok || len(timings) == 0 {
			continue
		}
		fmt.Fprintf(&b, "-- mode: %s (%d runs) --\n", mode, len(timings))
		var sumDone, sumCmd, sumEvt time.Duration
		okCount := 0
		evtCount := 0
		for i, t := range timings {
			status := "ok"
			if !t.Success {
				status = "FAIL: " + t.Error
			} else {
				okCount++
				sumDone += t.DoneAt
				sumCmd += t.CommandReturnAt
				if t.FirstUsefulEvent != "" {
					sumEvt += t.FirstUsefulEventAt
					evtCount++
				}
			}
			fmt.Fprintf(
				&b,
				"  #%d %s  done=%s  cmdReturn=%s  firstEvent=%s@%s  events=%v\n",
				i+1,
				status,
				t.DoneAt.Round(time.Millisecond),
				t.CommandReturnAt.Round(time.Millisecond),
				t.FirstUsefulEvent,
				t.FirstUsefulEventAt.Round(time.Millisecond),
				t.EventsSeen,
			)
		}
		if okCount > 0 {
			fmt.Fprintf(
				&b,
				"  avg done=%s  avg cmdReturn=%s",
				(sumDone / time.Duration(okCount)).Round(time.Millisecond),
				(sumCmd / time.Duration(okCount)).Round(time.Millisecond),
			)
			if evtCount > 0 {
				fmt.Fprintf(
					&b,
					"  avg firstEvent=%s",
					(sumEvt / time.Duration(evtCount)).Round(time.Millisecond),
				)
			}
			fmt.Fprintf(&b, "  success=%d/%d\n", okCount, len(timings))
		}
		b.WriteString("\n")
	}

	b.WriteString("How to read:\n")
	b.WriteString("  • If cmdReturn ≈ done and events arrive at/before cmdReturn → A is enough.\n")
	b.WriteString("  • If useful events arrive after cmdReturn and A races later ops → prefer B/hybrid.\n")
	b.WriteString("  • If B waits full timeout with no events → events aren't reliable; stick with A.\n")
	return b.String()
}

// CaptureWithTiming runs one capture and returns timing (nil Timing on hard failure before capture).
func CaptureWithTiming(cam interface {
	CaptureImage() (*OperationResult, error)
}, modeSetter interface {
	SetCompletionMode(CompletionMode)
}, mode CompletionMode) (*CaptureTiming, error) {
	modeSetter.SetCompletionMode(mode)
	res, err := cam.CaptureImage()
	if res != nil && res.Timing != nil {
		return res.Timing, err
	}
	if err != nil {
		return &CaptureTiming{Mode: mode, Success: false, Error: err.Error()}, err
	}
	return &CaptureTiming{Mode: mode, Success: true, DoneAt: res.Duration}, nil
}

// completionBenchCamera is satisfied by RealCamera and MockCamera.
type completionBenchCamera interface {
	IsConnected() bool
	Connect() error
	AddClient(id string)
	RemoveClient(id string)
	SetCompletionMode(CompletionMode)
	CaptureImage() (*OperationResult, error)
}

// RunCompletionBench compares completion modes (works with real or mock camera).
func RunCompletionBench(cam completionBenchCamera, cfg BenchConfig) (BenchReport, error) {
	if cfg.Iterations <= 0 {
		cfg.Iterations = 3
	}
	if len(cfg.Modes) == 0 {
		cfg.Modes = DefaultBenchConfig().Modes
	}

	report := BenchReport{ByMode: make(map[CompletionMode][]CaptureTiming)}

	if !cam.IsConnected() {
		if err := cam.Connect(); err != nil {
			return report, fmt.Errorf("connect: %w", err)
		}
	}

	if cfg.WithPreview {
		cam.AddClient("bench-preview")
		defer cam.RemoveClient("bench-preview")
		time.Sleep(200 * time.Millisecond)
	}

	for _, mode := range cfg.Modes {
		log.Printf("Bench: starting mode %s (%d iterations)", mode, cfg.Iterations)
		for i := 0; i < cfg.Iterations; i++ {
			cam.SetCompletionMode(mode)
			res, err := cam.CaptureImage()
			var timing CaptureTiming
			if res != nil && res.Timing != nil {
				timing = *res.Timing
			} else {
				timing = CaptureTiming{Mode: mode, Success: err == nil}
				if err != nil {
					timing.Error = err.Error()
				}
				if res != nil {
					timing.DoneAt = res.Duration
				}
			}
			if err != nil && timing.Error == "" {
				timing.Success = false
				timing.Error = err.Error()
			}
			report.ByMode[mode] = append(report.ByMode[mode], timing)
			log.Printf("Bench: mode=%s iter=%d done=%s success=%v", mode, i+1, timing.DoneAt, timing.Success)
			time.Sleep(cfg.SettlePause)
		}
	}

	return report, nil
}
