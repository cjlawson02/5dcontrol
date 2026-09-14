# CLAUDE.md

Guidance for AI assistants working in this repository. **Product and architecture truth lives in [`docs/`](docs/).** Keep this file short and aligned with those docs—do not reintroduce aspirational features as if they shipped.

## Overview

5DControl is a travel-router camera remote for a **Canon EOS 5D Mark III**:

- **Mobile**: React Native (Expo), **iOS first**
- **Server**: Go on travel router / host, WebSocket control + HTTP MJPEG/stills
- **Protocol**: FlatBuffers (`packages/proto/control.fbs`)
- **Monorepo**: Turborepo + npm workspaces + Go workspace (`go.work`)

## Commands

```bash
npm run dev:demo          # mock camera + mobile
npm run dev               # turbo both apps
cd apps/server && npm run dev
cd apps/mobile && npm run dev

npm test
cd apps/mobile && npm run test:unit
cd apps/server && npm test

npm run build
npm run lint
cd packages/proto && npm run proto
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and [docs/DEMO_MODE.md](docs/DEMO_MODE.md).

## Architecture (actual)

1. Mobile connects to `ws://<ip>:8888/ws`
2. Commands: FlatBuffers `FOCUS` / `CAPTURE` / `QUERY_STATUS`
3. Status: `camera_connected`, `battery_level`
4. Live preview: `http://<ip>:8080/live.mjpeg`
5. Server drives camera via gphoto2 (or `-demo` mock)

Full design: [docs/HLD.md](docs/HLD.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md).

### Key paths

- `apps/server/camera` — real/mock camera, operation serialization, settings helpers (settings **not** on WS yet)
- `apps/server/server` — WS + HTTP MJPEG
- `apps/server/gphoto2` — CGO bindings
- `apps/server/discovery` — mDNS **advertise** only
- `apps/mobile/components/WebSocketContext.tsx` — client WS
- `apps/mobile/components/CameraStream.tsx` — MJPEG WebView + native pinch/pan
- `apps/mobile/components/ViewfinderGlass.tsx` — glass HUD chrome
- `apps/mobile/app/(tabs)/index.tsx` — viewfinder
- `apps/mobile/app/gallery.tsx` — thin HTTP `photo.jpg` cache review
- `apps/mobile/app/settings.tsx` — **app** grid settings (not camera exposure)

### Not implemented (do not invent in code comments as done)

- Full capture→review loop (WS image-ready notify + last-capture cache on the router)
- Camera ISO/shutter/aperture over the wire
- Mobile mDNS browse
- Auth / TLS
- `CameraSettingsContext` / rich FlatBuffers image list as described in older drafts

**Thin gallery note:** `app/gallery.tsx` can download `http://{ip}:8080/photo.jpg` into local cache via `expo-file-system` + `expo-image` seeding — not CamRanger-class review yet.

## Protocol rule

`packages/proto/control.fbs` is the source of truth. Regenerate before relying on `dist/`. Do not restore image/settings enums from stale generated files without updating the schema and wiring both sides.

## Testing notes

- Mobile: Jest + Testing Library; integration folder currently empty
- Server: `go test ./...`; hardware tests skip without camera/network
- Prefer demo mode for UI work

## Common pitfalls

- Capture/focus are largely **blocking** in gphoto2—respect the serialized camera worker; do not reintroduce fragile event-completion assumptions
- Physical devices need the host **LAN IP**, not `127.0.0.1`
- README must not claim missing files (demo docs live under `docs/DEMO_MODE.md`)
