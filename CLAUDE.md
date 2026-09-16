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
2. Commands: FlatBuffers `FOCUS` / `CAPTURE` / `QUERY_STATUS` / `QUERY_SETTINGS` / `QUERY_AVAILABLE_SETTINGS` / `SET_SETTING`
3. Status: `camera_connected`, `battery_level`
4. After capture: FlatBuffers `IMAGE_READY` (`image_id`, `thumb_path`, `full_path`)
5. Exposure: `CURRENT_SETTINGS` / `AVAILABLE_SETTINGS` over WS; viewfinder ISO/TV/AV pill + value rail
6. Live preview: `http://<ip>:8080/live.mjpeg`
7. Last stills: `http://<ip>:8080/captures/{id|latest}/{full|thumb}.jpg`
8. `/photo.jpg` is a **live-view snapshot**, not the last capture
9. Server drives camera via gphoto2 (or `-demo` mock)

Full design: [docs/HLD.md](docs/HLD.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md).

### Key paths

- `apps/server/camera` — real/mock camera, last-capture store, operation serialization, `SettingsController`
- `apps/server/server` — WS hub + HTTP MJPEG + `/captures/…` + settings routing (`ws_settings.go`)
- `apps/server/gphoto2` — CGO bindings (capture path + file download)
- `apps/server/discovery` — mDNS **advertise** only
- `apps/mobile/components/WebSocketContext.tsx` — client WS + `lastImageReady` + exposure state
- `apps/mobile/components/ExposureControls.tsx` — viewfinder ISO / TV / AV pill + expanding value rail
- `apps/mobile/components/CameraStream.tsx` — MJPEG WebView + native pinch/pan
- `apps/mobile/components/ViewfinderGlass.tsx` — glass HUD chrome
- `apps/mobile/app/(tabs)/index.tsx` — viewfinder + gallery-button last-capture thumb + exposure
- `apps/mobile/app/gallery.tsx` — capture review (IMAGE_READY auto-fetch + HTTP stills)
- `apps/mobile/app/settings.tsx` — **app** grid settings (not camera exposure)

### Not implemented (do not invent in code comments as done)

- Reliable card download timing / under ~3s thumb on travel-router Wi‑Fi (needs live 5D III bench)
- Real gphoto2 available-choice enumeration (live get/set exists; choice lists empty on real camera)
- Mobile mDNS browse
- Auth / TLS
- Rich FlatBuffers image list as described in older drafts

**Capture loop note:** After CAPTURE, server caches JPEG + thumb, broadcasts FlatBuffers `IMAGE_READY` with HTTP paths (`/captures/{id}/full.jpg`, `.../thumb.jpg`). Demo mock generates a labeled still. Real mode downloads via gphoto2 when possible (falls back to preview frame). Gallery and the viewfinder's gallery button auto-pull the new still on notify.

**Exposure note:** Demo path is the acceptance path for M2. Mock returns realistic available lists and mutates current settings on the exclusive worker. Do not conflate camera exposure with app grid `SettingsContext`. The viewfinder control is deliberately **non-modal** — a bottom glass pill that expands a snapping value rail — because exposure values are enumerated choice lists and the live frame must stay visible.

## Protocol rule

`packages/proto/control.fbs` is the source of truth. Regenerate before relying on `dist/`. Do not restore image/settings enums from stale generated files without updating the schema and wiring both sides.

## Testing notes

- Mobile: Jest + Testing Library; integration folder currently empty
- Server: `go test ./...`; hardware tests skip without camera/network
- Prefer demo mode for UI work (covers capture → `IMAGE_READY` → gallery, and the exposure pill)

## Common pitfalls

- Capture/focus/settings are largely **blocking** in gphoto2—respect the serialized camera worker; do not reintroduce fragile event-completion assumptions
- Physical devices need the host **LAN IP**, not `127.0.0.1`
- Do not treat `/photo.jpg` as the last capture — use `/captures/…` after `IMAGE_READY`
- README must not claim missing files (demo docs live under `docs/DEMO_MODE.md`)
- Expo UI suits the connection and app-settings forms, but not floating viewfinder HUD. Its sheets present full-screen on iPhone and crash when dismissed from a button inside them; use `ViewfinderGlass` + React Native for viewfinder chrome
- A `ScrollView` re-applies `contentOffset` whenever the prop changes — never derive it from state you update mid-drag, or the scroll jumps ahead under the user's finger
