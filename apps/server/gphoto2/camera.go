package gphoto2

/*
#cgo pkg-config: libgphoto2
#include <gphoto2/gphoto2.h>
#include <string.h>

CameraFile *new_camera_file() {
    CameraFile *file;
    if (gp_file_new(&file) != GP_OK) {
        return NULL;
    }
    return file;
}
*/
import "C"

type Camera C.Camera
type CameraCaptureType int

func NewCamera() (*Camera, error) {
	var _cam *C.Camera

	if r := C.gp_camera_new(&_cam); r < C.GP_OK {
		return nil, e(r)
	}

	return (*Camera)(_cam), nil
}

func (camera *Camera) Init(ctx *Context) error {
	if r := C.gp_camera_init(camera.c(), ctx.c()); r < C.GP_OK {
		return e(r)
	}

	return nil
}

func (camera *Camera) CapturePreview(file *CameraFile, ctx *Context) error {
	if r := C.gp_camera_capture_preview(camera.c(), file.c(), ctx.c()); r < C.GP_OK {
		return e(r)
	}

	return nil
}

func (camera *Camera) File() (*CameraFile, error) {
	file := C.new_camera_file()
	if file == nil {
		return nil, e(C.GP_ERROR_NO_MEMORY)
	}
	return (*CameraFile)(file), nil
}

func (camera *Camera) Exit(ctx *Context) error {
	if r := C.gp_camera_exit(camera.c(), ctx.c()); r < C.GP_OK {
		return e(r)
	}
	return nil
}

func (camera *Camera) Close() error {
	if r := C.gp_camera_free(camera.c()); r < C.GP_OK {
		return e(r)
	}
	return nil
}

func (camera *Camera) c() *C.Camera {
	return (*C.Camera)(camera)
}
