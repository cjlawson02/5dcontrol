# 5DControl

CamRanger-like **remote for a Canon EOS 5D Mark III**: Go server on a **travel router** (USB to camera, Wi‑Fi AP to phone) + **iOS** Expo client. FlatBuffers over WebSocket; HTTP for MJPEG and stills.

See [docs/PRODUCT.md](docs/PRODUCT.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## What works today

- mDNS connect on the same LAN (iOS Bonjour; manual IP fallback)
- Live MJPEG preview, tap-to-focus reticle + focus/capture commands
- Camera connected / battery status; viewfinder disconnect / reconnect
- Local grid overlays (rule of thirds, golden ratio)
- Capture → review: WS `IMAGE_READY` + HTTP `/captures/{id}/…` (demo + real download path)
- Gallery auto-fetch; the last capture becomes the viewfinder's gallery button
- Remote exposure (ISO / Tv / Av) over WS + a non-modal viewfinder pill with a snapping value rail (demo/sim; live available-lists TBD)
- Demo mode with a mock camera (no hardware)

## Quick start

### Demo (no camera)

```bash
npm install
npm run dev:demo
```

Details: [docs/DEMO_MODE.md](docs/DEMO_MODE.md).

### Real camera (dev host or travel router)

1. Install libgphoto2; connect a **5D Mark III** over USB to the machine running the server.
2. Start the server: `cd apps/server && npm run dev`
3. Start the iOS app: `cd apps/mobile && npm run dev`
4. Join the same LAN/AP. On iOS (dev client), tap a discovered 5DControl host, or enter the server’s IP.

| Endpoint | Default |
| --- | --- |
| Control WebSocket | `ws://<ip>:8888/ws` |
| Live view | `http://<ip>:8080/live.mjpeg` |
| Last capture | `http://<ip>:8080/captures/latest/full.jpg` |
| Preview snapshot | `http://<ip>:8080/photo.jpg` |

## Documentation

| Doc | Description |
| --- | --- |
| [docs/README.md](docs/README.md) | Doc index |
| [docs/HLD.md](docs/HLD.md) | High-level design |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Shipped timeline + planned phases |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Vision & competitive parity |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Commands, protocol, testing |
| [AGENTS.md](AGENTS.md) | Agent-oriented repo guidance |

## Repository

```
apps/mobile      React Native (Expo) client — iOS first
apps/server      Go + gphoto2 (runs on travel router / host)
packages/proto   FlatBuffers schema
```
