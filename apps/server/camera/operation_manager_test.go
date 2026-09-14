package camera

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStateMachine_StartOperation_Success(t *testing.T) {
	sm := &StateMachine{}
	pm := NewPreviewManager()

	err := sm.StartOperation(OperationFocus, pm)
	assert.NoError(t, err)
	assert.Equal(t, StateFocusing, sm.GetState())
	sm.CompleteOperation()
	assert.Equal(t, StateIdle, sm.GetState())

	err = sm.StartOperation(OperationCapture, pm)
	assert.NoError(t, err)
	assert.Equal(t, StateCapturing, sm.GetState())
	sm.CompleteOperation()

	err = sm.StartOperation(OperationSettings, pm)
	assert.NoError(t, err)
	assert.Equal(t, StateSettingsChange, sm.GetState())
}

func TestStateMachine_StartOperation_Busy(t *testing.T) {
	sm := &StateMachine{}
	pm := NewPreviewManager()
	err := sm.StartOperation(OperationFocus, pm)
	assert.NoError(t, err)

	err = sm.StartOperation(OperationCapture, pm)
	assert.Error(t, err)
	assert.Equal(t, ErrCameraBusy, err)
	assert.Equal(t, StateFocusing, sm.GetState())
}

func TestStateMachine_StartOperation_InvalidOperation(t *testing.T) {
	sm := &StateMachine{}
	pm := NewPreviewManager()
	err := sm.StartOperation(OperationType(99), pm)
	assert.Error(t, err)
	assert.Equal(t, ErrInvalidOperation, err)
	assert.Equal(t, StateIdle, sm.GetState())
}

func TestStateMachine_CompleteOperation(t *testing.T) {
	sm := &StateMachine{}
	pm := NewPreviewManager()
	err := sm.StartOperation(OperationCapture, pm)
	assert.NoError(t, err)
	assert.Equal(t, StateCapturing, sm.GetState())

	sm.CompleteOperation()
	assert.Equal(t, StateIdle, sm.GetState())
}
