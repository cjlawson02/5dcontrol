package gphoto2

// #cgo pkg-config: libgphoto2
// #include <gphoto2/gphoto2.h>
// #include <string.h>
import "C"
import "unsafe"

const (
	FILE_TYPE_PREVIEW  = C.GP_FILE_TYPE_PREVIEW
	FILE_TYPE_NORMAL   = C.GP_FILE_TYPE_NORMAL
	FILE_TYPE_RAW      = C.GP_FILE_TYPE_RAW
	FILE_TYPE_AUDIO    = C.GP_FILE_TYPE_AUDIO
	FILE_TYPE_EXIF     = C.GP_FILE_TYPE_EXIF
	FILE_TYPE_METADATA = C.GP_FILE_TYPE_METADATA
)

type CameraFile C.CameraFile
type CameraFileType int

type CameraFilePath struct {
	Name   string
	Folder string
}

func (file *CameraFile) Close() error {
	if ret := C.gp_file_unref(file.c()); ret != 0 {
		return e(ret)
	}
	return nil
}

func (file *CameraFile) GetDataAndSize() ([]byte, int, error) {
	var cdata *C.char
	var csize C.ulong
	r := C.gp_file_get_data_and_size(file.c(), &cdata, &csize)
	if r < C.GP_OK {
		return nil, 0, e(r)
	}

	return unsafe.Slice((*byte)(unsafe.Pointer(cdata)), csize), int(csize), nil
}

func (file *CameraFile) c() *C.CameraFile {
	return (*C.CameraFile)(unsafe.Pointer(file))
}
