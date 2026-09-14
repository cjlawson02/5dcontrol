package camera

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var (
	ErrCameraBusy       = errors.New("camera is busy")
	ErrInvalidOperation = errors.New("invalid operation")
	ErrNotConnected     = errors.New("camera not connected")
)

// OperationType defines the type of camera operation
type OperationType int

const (
	OperationFocus OperationType = iota
	OperationCapture
	OperationSettings // get or set config (interrupts camera I/O)
)

func (o OperationType) String() string {
	switch o {
	case OperationFocus:
		return "focus"
	case OperationCapture:
		return "capture"
	case OperationSettings:
		return "settings"
	default:
		return fmt.Sprintf("op(%d)", int(o))
	}
}

// OperationStatus defines the status of a camera operation
type OperationStatus int

const (
	OperationStatusSuccess OperationStatus = iota
	OperationStatusFailed
	OperationStatusCancelled
)

// CompletionMode controls how capture is considered "done".
// Use -bench-completion to compare modes on real hardware.
type CompletionMode int

const (
	// CompletionCommandReturn (A): done when Capture() returns.
	CompletionCommandReturn CompletionMode = iota
	// CompletionWaitEvent (B): after Capture(), wait for FileAdded or CaptureComplete.
	CompletionWaitEvent
	// CompletionHybrid: Capture() return, then briefly drain events (best of both signals).
	CompletionHybrid
)

func (m CompletionMode) String() string {
	switch m {
	case CompletionCommandReturn:
		return "command-return"
	case CompletionWaitEvent:
		return "wait-event"
	case CompletionHybrid:
		return "hybrid"
	default:
		return fmt.Sprintf("mode(%d)", int(m))
	}
}

// OperationResult holds the outcome of a camera operation
type OperationResult struct {
	OperationID string
	Type        OperationType
	Status      OperationStatus
	Error       error
	Duration    time.Duration
	Data        any
	Timing      *CaptureTiming // set for capture when instrumented
}

// CaptureTiming is used to compare completion strategies.
type CaptureTiming struct {
	Mode              CompletionMode
	CommandReturnAt   time.Duration // time until Capture() returned (0 if N/A)
	FirstUsefulEventAt time.Duration // 0 if none
	FirstUsefulEvent  string
	EventsSeen        []string
	DoneAt            time.Duration
	Success           bool
	Error             string
}

// ActiveOperation represents an operation currently in progress
type ActiveOperation struct {
	ID        string
	Type      OperationType
	StartTime time.Time
	Context   context.Context
	Cancel    context.CancelFunc
}

// OperationManager coordinates all camera operations
type OperationManager interface {
	TriggerFocus() (*OperationResult, error)
	CaptureImage() (*OperationResult, error)
}

// CameraState defines the operational state of the camera
type CameraState int

const (
	StateIdle CameraState = iota
	StateFocusing
	StateCapturing
	StateSettingsChange
	StateError
	StateDisconnected
)

func (s CameraState) String() string {
	switch s {
	case StateIdle:
		return "idle"
	case StateFocusing:
		return "focusing"
	case StateCapturing:
		return "capturing"
	case StateSettingsChange:
		return "settings"
	case StateError:
		return "error"
	case StateDisconnected:
		return "disconnected"
	default:
		return fmt.Sprintf("state(%d)", int(s))
	}
}

// StateMachine manages camera state transitions
type StateMachine struct {
	current  CameraState
	activeOp *ActiveOperation
	mutex    sync.RWMutex
	opSeq    atomic.Uint64
}

// StartOperation attempts to transition the state machine to a new operation state.
// It returns ErrCameraBusy if an operation is already in progress.
// Preview is paused only after the transition is accepted.
func (sm *StateMachine) StartOperation(opType OperationType, pm *PreviewManager) error {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	if sm.current != StateIdle {
		return ErrCameraBusy
	}

	var next CameraState
	switch opType {
	case OperationFocus:
		next = StateFocusing
	case OperationCapture:
		next = StateCapturing
	case OperationSettings:
		next = StateSettingsChange
	default:
		return ErrInvalidOperation
	}

	if pm != nil {
		pm.pausePreview()
	}

	id := fmt.Sprintf("%s-%d", opType.String(), sm.opSeq.Add(1))
	sm.current = next
	sm.activeOp = &ActiveOperation{
		ID:        id,
		Type:      opType,
		StartTime: time.Now(),
	}
	return nil
}

// CompleteOperation transitions the state machine back to Idle.
func (sm *StateMachine) CompleteOperation() {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	sm.current = StateIdle
	sm.activeOp = nil
}

// GetState returns the current state of the camera.
func (sm *StateMachine) GetState() CameraState {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	return sm.current
}

// ActiveOpID returns the current operation id, or empty if idle.
func (sm *StateMachine) ActiveOpID() string {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	if sm.activeOp == nil {
		return ""
	}
	return sm.activeOp.ID
}
