package camera

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"time"

	"golang.org/x/image/draw"
)

const thumbMaxEdge = 480

// MakeThumbnailJPEG decodes a JPEG and returns a smaller JPEG (max edge 480).
func MakeThumbnailJPEG(full []byte) ([]byte, error) {
	if len(full) == 0 {
		return nil, fmt.Errorf("empty jpeg")
	}
	src, err := jpeg.Decode(bytes.NewReader(full))
	if err != nil {
		return nil, fmt.Errorf("decode jpeg: %w", err)
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= 0 || h <= 0 {
		return nil, fmt.Errorf("invalid image size")
	}

	scale := float64(thumbMaxEdge) / float64(w)
	if h > w {
		scale = float64(thumbMaxEdge) / float64(h)
	}
	if scale > 1 {
		scale = 1
	}
	tw := int(float64(w) * scale)
	th := int(float64(h) * scale)
	if tw < 1 {
		tw = 1
	}
	if th < 1 {
		th = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, tw, th))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 80}); err != nil {
		return nil, fmt.Errorf("encode thumb: %w", err)
	}
	return buf.Bytes(), nil
}

// StoreJPEGCapture builds thumb + full and stores them under a new id.
func StoreJPEGCapture(store *CaptureStore, full []byte) (*CachedCapture, error) {
	if store == nil {
		return nil, fmt.Errorf("nil capture store")
	}
	if len(full) == 0 {
		return nil, fmt.Errorf("empty jpeg")
	}
	thumb, err := MakeThumbnailJPEG(full)
	if err != nil {
		// Fall back to full bytes so HTTP still has something to serve.
		thumb = full
	}
	c := &CachedCapture{
		ID:        NewCaptureID(),
		FullJPEG:  append([]byte(nil), full...),
		ThumbJPEG: append([]byte(nil), thumb...),
		CreatedAt: timeNow(),
	}
	store.Set(c)
	return c, nil
}

// timeNow is overridable in tests.
var timeNow = func() time.Time {
	return time.Now()
}
