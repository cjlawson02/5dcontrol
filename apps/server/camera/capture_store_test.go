package camera

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func TestCaptureStore_SetGet(t *testing.T) {
	store := NewCaptureStore()
	if store.Latest() != nil {
		t.Fatal("expected empty store")
	}
	c := &CachedCapture{ID: "1", FullJPEG: []byte{1}, ThumbJPEG: []byte{2}}
	store.Set(c)
	if got := store.Latest(); got == nil || got.ID != "1" {
		t.Fatalf("Latest = %v", got)
	}
	if store.Get("1") == nil {
		t.Fatal("Get(1) nil")
	}
	if store.Get("2") != nil {
		t.Fatal("Get(2) should be nil")
	}
	if c.FullPath() != "/captures/1/full.jpg" {
		t.Errorf("FullPath = %s", c.FullPath())
	}
	if c.ThumbPath() != "/captures/1/thumb.jpg" {
		t.Errorf("ThumbPath = %s", c.ThumbPath())
	}
}

func TestStoreJPEGCapture_MakesThumb(t *testing.T) {
	store := NewCaptureStore()
	full := solidJPEG(t, 800, 600, color.RGBA{200, 100, 50, 255})
	c, err := StoreJPEGCapture(store, full)
	if err != nil {
		t.Fatal(err)
	}
	if c.ID == "" {
		t.Fatal("empty id")
	}
	if len(c.FullJPEG) == 0 || len(c.ThumbJPEG) == 0 {
		t.Fatal("missing jpeg bytes")
	}
	if len(c.ThumbJPEG) >= len(c.FullJPEG) {
		t.Errorf("thumb (%d) should usually be smaller than full (%d)", len(c.ThumbJPEG), len(c.FullJPEG))
	}
	if store.Latest() != c {
		t.Fatal("store not updated")
	}
}

func solidJPEG(t *testing.T, w, h int, c color.RGBA) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
