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
4. After capture: FlatBuffers `IMAGE_READY` (`image_id`, `thumb_path`, `full_path`)
5. Live preview: `http://<ip>:8080/live.mjpeg`
6. Last stills: `http://<ip>:8080/captures/{id|latest}/{full|thumb}.jpg`
7. `/photo.jpg` is a **live-view snapshot**, not the last capture
8. Server drives camera via gphoto2 (or `-demo` mock)

Full design: [docs/HLD.md](docs/HLD.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md).

### Key paths

- `apps/server/camera` — real/mock camera, last-capture store, operation serialization, settings helpers (settings **not** on WS yet)
- `apps/server/server` — WS hub + HTTP MJPEG + `/captures/…`
- `apps/server/gphoto2` — CGO bindings (capture path + file download)
- `apps/server/discovery` — mDNS **advertise** only
- `apps/mobile/components/WebSocketContext.tsx` — client WS + `lastImageReady`
- `apps/mobile/components/CameraStream.tsx` — MJPEG WebView + native pinch/pan
- `apps/mobile/components/ViewfinderGlass.tsx` — glass HUD chrome
- `apps/mobile/app/(tabs)/index.tsx` — viewfinder + last-capture thumb
- `apps/mobile/app/gallery.tsx` — capture review (IMAGE_READY auto-fetch + HTTP stills)
- `apps/mobile/app/settings.tsx` — **app** grid settings (not camera exposure)

### Not implemented (do not invent in code comments as done)

- Reliable card download timing / under ~3s thumb on travel-router Wi‑Fi (needs live 5D III bench)
- Camera ISO/shutter/aperture over the wire
- Mobile mDNS browse
- Auth / TLS
- `CameraSettingsContext` / rich FlatBuffers image list as described in older drafts

**Capture loop note:** After CAPTURE, server caches JPEG + thumb, broadcasts FlatBuffers `IMAGE_READY` with HTTP paths (`/captures/{id}/full.jpg`, `.../thumb.jpg`). Demo mock generates a labeled still. Real mode downloads via gphoto2 when possible (falls back to preview frame). Gallery + viewfinder last-thumb auto-pull on notify.

## Protocol rule

`packages/proto/control.fbs` is the source of truth. Regenerate before relying on `dist/`. Do not restore image/settings enums from stale generated files without updating the schema and wiring both sides.

## Testing notes

- Mobile: Jest + Testing Library; integration folder currently empty
- Server: `go test ./...`; hardware tests skip without camera/network
- Prefer demo mode for UI work (covers capture → `IMAGE_READY` → gallery)

## Common pitfalls

- Capture/focus are largely **blocking** in gphoto2—respect the serialized camera worker; do not reintroduce fragile event-completion assumptions
- Physical devices need the host **LAN IP**, not `127.0.0.1`
- Do not treat `/photo.jpg` as the last capture — use `/captures/…` after `IMAGE_READY`
- README must not claim missing files (demo docs live under `docs/DEMO_MODE.md`)
