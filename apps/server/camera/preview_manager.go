package camera

import (
	"log"
)

// PreviewManager coordinates the camera's preview stream with other operations.
type PreviewManager struct {
	pauseChannel  chan struct{}
	resumeChannel chan struct{}
}

// NewPreviewManager creates a new manager for the camera preview.
func NewPreviewManager() *PreviewManager {
	return &PreviewManager{
		pauseChannel:  make(chan struct{}, 1),
		resumeChannel: make(chan struct{}, 1),
	}
}

// pausePreview sends a signal to pause the preview loop.
func (pm *PreviewManager) pausePreview() {
	if pm == nil {
		return
	}
	log.Println("Pausing preview...")
	select {
	case pm.pauseChannel <- struct{}{}:
	default:
		// already paused / signal pending
	}
}

// resumePreview sends a signal to resume the preview loop.
func (pm *PreviewManager) resumePreview() {
	if pm == nil {
		return
	}
	log.Println("Resuming preview...")
	select {
	case pm.resumeChannel <- struct{}{}:
	default:
		// already resumed / signal pending
	}
}
