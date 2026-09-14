package gphoto2

/*
#cgo pkg-config: libgphoto2
#include <gphoto2/gphoto2.h>
#include <string.h>
#include <stdlib.h>

CameraFile *new_camera_file() {
    CameraFile *file;
    if (gp_file_new(&file) != GP_OK) {
        return NULL;
    }
    return file;
}
*/
import "C"
import (
	"fmt"
	"unsafe"
)

type Camera C.Camera
type CameraCaptureType int
type CameraEventType int

const (
	EventUnknown         CameraEventType = C.GP_EVENT_UNKNOWN
	EventTimeout         CameraEventType = C.GP_EVENT_TIMEOUT
	EventFileAdded       CameraEventType = C.GP_EVENT_FILE_ADDED
	EventFolderAdded     CameraEventType = C.GP_EVENT_FOLDER_ADDED
	EventCaptureComplete CameraEventType = C.GP_EVENT_CAPTURE_COMPLETE
	EventFileChanged     CameraEventType = C.GP_EVENT_FILE_CHANGED
)

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

func (camera *Camera) Capture(ctx *Context) error {
	var path C.CameraFilePath

	if r := C.gp_camera_capture(camera.c(), C.GP_CAPTURE_IMAGE, &path, ctx.c()); r < C.GP_OK {
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

// SetConfigValueString sets a configuration value by key using a string value.
func (camera *Camera) SetConfigValueString(key, value string, ctx *Context) error {
	var config *C.CameraWidget
	if r := C.gp_camera_get_config(camera.c(), &config, ctx.c()); r < C.GP_OK {
		return e(r)
	}

	ckey := C.CString(key)
	defer C.free(unsafe.Pointer(ckey))

	var child *C.CameraWidget
	if r := C.gp_widget_get_child_by_name(config, ckey, &child); r < C.GP_OK {
		C.gp_widget_free(config)
		return e(r)
	}

	cvalue := C.CString(value)
	defer C.free(unsafe.Pointer(cvalue))

	if r := C.gp_widget_set_value(child, unsafe.Pointer(cvalue)); r < C.GP_OK {
		C.gp_widget_free(config)
		return e(r)
	}

	if r := C.gp_camera_set_config(camera.c(), config, ctx.c()); r < C.GP_OK {
		C.gp_widget_free(config)
		return e(r)
	}

	C.gp_widget_free(config)
	return nil
}

// GetConfigValueString gets a configuration value by key and returns it as a string.
func (camera *Camera) GetConfigValueString(key string, ctx *Context) (string, error) {
	var config *C.CameraWidget
	if r := C.gp_camera_get_config(camera.c(), &config, ctx.c()); r < C.GP_OK {
		return "", e(r)
	}
	defer C.gp_widget_free(config)

	ckey := C.CString(key)
	defer C.free(unsafe.Pointer(ckey))

	var child *C.CameraWidget
	if r := C.gp_widget_get_child_by_name(config, ckey, &child); r < C.GP_OK {
		return "", e(r)
	}

	// Try to get as string first
	var value *C.char
	if r := C.gp_widget_get_value(child, unsafe.Pointer(&value)); r == C.GP_OK {
		return C.GoString(value), nil
	}

	return "", fmt.Errorf("unable to get widget value")
}

// WaitEvent waits for a camera event with timeout in milliseconds
// Returns the event type and event data (can be nil)
func (camera *Camera) WaitEvent(timeoutMs int, ctx *Context) (CameraEventType, any, error) {
	var eventType C.CameraEventType
	var eventData unsafe.Pointer

	if r := C.gp_camera_wait_for_event(camera.c(), C.int(timeoutMs), &eventType, &eventData, ctx.c()); r < C.GP_OK {
		return C.GP_EVENT_UNKNOWN, nil, e(r)
	}

	// Convert C event type to Go event type
	goEventType := CameraEventType(eventType)

	// Parse event data based on type
	var goEventData any
	switch goEventType {
	case C.GP_EVENT_FILE_ADDED, C.GP_EVENT_FOLDER_ADDED, C.GP_EVENT_FILE_CHANGED:
		// Event data is a CameraFilePath pointer
		if eventData != nil {
			path := (*C.CameraFilePath)(eventData)
			goEventData = map[string]string{
				"folder": C.GoString(&path.folder[0]),
				"name":   C.GoString(&path.name[0]),
			}
			// Free the event data allocated by libgphoto2
			C.free(eventData)
		}
	case C.GP_EVENT_UNKNOWN:
		// Event data might be a string
		if eventData != nil {
			goEventData = C.GoString((*C.char)(eventData))
			C.free(eventData)
		}
	case C.GP_EVENT_TIMEOUT, C.GP_EVENT_CAPTURE_COMPLETE:
		// No event data for these types
		goEventData = nil
	}

	return goEventType, goEventData, nil
}

// Helper method to make WaitEvent easier to use in loops
func (camera *Camera) WaitEventTimeout(timeoutMs int, ctx *Context) (CameraEventType, error) {
	eventType, _, err := camera.WaitEvent(timeoutMs, ctx)
	return eventType, err
}
