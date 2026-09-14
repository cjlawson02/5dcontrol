# 5DControl

CamRanger-like **remote for a Canon EOS 5D Mark III**: Go server on a **travel router** (USB to camera, Wi‑Fi AP to phone) + **iOS** Expo client. FlatBuffers over WebSocket; HTTP for MJPEG and stills.

See [docs/PRODUCT.md](docs/PRODUCT.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## What works today

- Manual IP connect, live MJPEG preview, focus + capture commands
- Camera connected / battery status
- Local grid overlays (rule of thirds, golden ratio)
- Thin gallery: download latest `photo.jpg` into on-device cache
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
4. Join the same LAN/AP and enter the server’s IP on the connection screen.

| Endpoint | Default |
| --- | --- |
| Control WebSocket | `ws://<ip>:8888/ws` |
| Live view | `http://<ip>:8080/live.mjpeg` |

## Documentation

| Doc | Description |
| --- | --- |
| [docs/README.md](docs/README.md) | Doc index |
| [docs/HLD.md](docs/HLD.md) | High-level design |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Shipped timeline + planned phases |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Vision & competitive parity |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Commands, protocol, testing |
| [CLAUDE.md](CLAUDE.md) | Agent-oriented repo guidance |

## Repository

```
apps/mobile      React Native (Expo) client — iOS first
apps/server      Go + gphoto2 (runs on travel router / host)
packages/proto   FlatBuffers schema
```
