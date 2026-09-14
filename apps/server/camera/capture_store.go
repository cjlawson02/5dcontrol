package camera

import (
	"fmt"
	"sync"
	"time"
)

// CachedCapture is a still cached on the host after a successful capture.
type CachedCapture struct {
	ID        string
	FullJPEG  []byte
	ThumbJPEG []byte
	CreatedAt time.Time
}

// CaptureStore holds the most recent capture for HTTP serve + WS notify.
type CaptureStore struct {
	mu   sync.RWMutex
	last *CachedCapture
}

// NewCaptureStore creates an empty last-capture cache.
func NewCaptureStore() *CaptureStore {
	return &CaptureStore{}
}

// Set replaces the latest cached capture.
func (s *CaptureStore) Set(c *CachedCapture) {
	if s == nil || c == nil {
		return
	}
	s.mu.Lock()
	s.last = c
	s.mu.Unlock()
}

// Latest returns the most recent capture, or nil.
func (s *CaptureStore) Latest() *CachedCapture {
	if s == nil {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.last
}

// Get returns a capture by id, or nil if it is not the latest.
func (s *CaptureStore) Get(id string) *CachedCapture {
	if s == nil || id == "" {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.last == nil || s.last.ID != id {
		return nil
	}
	return s.last
}

// FullPath returns the HTTP path for the full JPEG.
func (c *CachedCapture) FullPath() string {
	if c == nil {
		return ""
	}
	return fmt.Sprintf("/captures/%s/full.jpg", c.ID)
}

// ThumbPath returns the HTTP path for the thumbnail JPEG.
func (c *CachedCapture) ThumbPath() string {
	if c == nil {
		return ""
	}
	return fmt.Sprintf("/captures/%s/thumb.jpg", c.ID)
}

// NewCaptureID returns a unique capture id based on unix millis.
func NewCaptureID() string {
	return fmt.Sprintf("%d", time.Now().UnixMilli())
}
