# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

5DControl is a professional camera remote control system for Canon DSLRs using:
- **Mobile App**: React Native (Expo) with file-based routing
- **Server**: Go backend with WebSocket control and HTTP MJPEG streaming
- **Protocol**: FlatBuffers for efficient binary communication
- **Monorepo**: Turborepo with npm workspaces

## Development Commands

### Starting the Application

```bash
# Demo mode (no physical camera required)
npm run dev:demo

# Production mode (individual apps)
cd apps/server && npm run dev    # Go server (uses air for hot reload)
cd apps/mobile && npm run dev    # Expo mobile app

# Production mode (both apps via Turbo)
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Mobile app tests
cd apps/mobile
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage

# Server tests
cd apps/server
npm test                   # Equivalent to: go test ./...
```

### Building and Linting

```bash
# Build all apps (runs proto generation first)
npm run build

# Server build
cd apps/server && npm run build  # Creates bin/server

# Lint all apps
npm run lint

# Server lint
cd apps/server && npm run lint   # Uses golangci-lint
```

### Protocol Development

When modifying the FlatBuffers schema:

```bash
cd packages/proto
npm run proto  # Regenerates Go and TypeScript code from control.fbs
```

This creates:
- `dist/Control/*.go` - Go types
- `dist/control/*.ts` - TypeScript types

## Architecture

### Communication Flow

1. **Mobile App** connects to server via WebSocket (`ws://<ip>:8888/ws`)
2. **Commands** are sent from mobile as FlatBuffers messages
3. **Server** controls camera via GPhoto2 library
4. **Status updates** flow back via WebSocket (camera state, settings, images)
5. **Live preview** streams via HTTP MJPEG (`http://<ip>:8888/mjpeg`)

### Key Go Packages

- `apps/server/camera`: Camera management and image handling
  - `CameraManager`: Manages camera connection, preview capture, battery monitoring
  - `ImageManager`: Handles image storage and retrieval
  - `MockCameraManager`: Demo mode implementation
- `apps/server/server`: Network services
  - `ws_server.go`: WebSocket server for camera control
  - `http_server.go`: HTTP server for MJPEG streaming and snapshots
- `apps/server/gphoto2`: Low-level GPhoto2 bindings (CGO wrapper)
- `apps/server/discovery`: mDNS service discovery

### Key Mobile Components

- `components/WebSocketContext.tsx`: WebSocket connection management
  - Handles FlatBuffers message encoding/decoding
  - Manages connection state and IP persistence
  - **Note**: Currently has merge conflict markers that need resolution
- `contexts/CameraSettingsContext.tsx`: Camera settings state (ISO, shutter, aperture)
- `contexts/GalleryContext.tsx`: Image gallery state management
- `app/(tabs)/index.tsx`: Main camera viewfinder screen
- `app/gallery.tsx`: Image gallery screen

### FlatBuffers Protocol

The protocol is defined in `packages/proto/control.fbs` and includes:

- **Command types**: Focus, capture, settings changes, image operations
- **Status messages**: Camera state, battery, current/available settings
- **Image data**: Thumbnails and full images as byte arrays

Messages use a tagged union pattern with `MessageType` (COMMAND or STATUS) determining which field is populated.

## Repository Structure

```
apps/
  mobile/         React Native Expo app
    app/          File-based routes (index, settings, gallery)
    components/   Reusable UI components
    contexts/     React contexts for state management
  server/         Go backend
    camera/       Camera management logic
    gphoto2/      GPhoto2 C library bindings
    server/       HTTP and WebSocket servers
    discovery/    mDNS service discovery
packages/
  proto/          FlatBuffers schema and generated code
```

## Go Workspace

This project uses Go workspaces (`go.work`):
- `apps/server` - main server application
- `packages/proto` - shared protocol definitions

When working with Go code, be aware that the proto package is a workspace dependency.

## Testing Notes

- Mobile tests use `@testing-library/react-native` and Jest
- Go tests follow standard `_test.go` conventions
- Integration tests in mobile use `jest.integration.config.js`
- Mock camera available via `-demo` flag for testing without hardware

## Common Issues

### Server Development

- The server uses `air` for hot reload during development (configured in `.air.toml`)
- Camera operations require the GPhoto2 C library to be installed
- Demo mode (`-demo` flag) bypasses hardware requirements
- Binary files (`bin/`) are gitignored - rebuild after pulling changes

### WebSocket Context Integration

Components that need to receive data from the server (settings, images) should:
1. Call `setOnImageListReceived`, `setOnImageDataReceived`, `setOnCurrentSettingsReceived`, or `setOnAvailableSettingsReceived` from the WebSocket context
2. These callbacks will be invoked when the server sends corresponding data
3. The context handles FlatBuffers parsing automatically
