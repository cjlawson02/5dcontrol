# Demo mode

Demo mode runs the Go server with a **mock camera** so you can develop and test the mobile app without USB hardware or libgphoto2.

## Quick start (recommended)

From the repository root:

```bash
npm run dev:demo
```

This starts the server with `-demo` and the Expo mobile app via Turbo.

## Server only

```bash
cd apps/server
go run . -demo
# or
npm run dev -- -demo
```

Confirm in logs that the mock camera is active. Live view serves synthetic MJPEG frames (typically labeled for demo) on `:8080`, and WebSocket control on `:8888` accepts FOCUS / CAPTURE / QUERY_STATUS / settings commands against the mock. After CAPTURE, the mock caches a labeled still and broadcasts `IMAGE_READY`; the last capture replaces the gallery button artwork and populates gallery via `/captures/…`. On connect the client also queries exposure settings; the viewfinder shows an ISO / TV / AV readout pill along the bottom — tap a segment to expand its value rail and scrub to a value.

## Mobile

1. Start Expo (`npm run dev` in `apps/mobile` if not using `dev:demo`).
2. On the connection screen, enter the **host machine’s LAN IPv4** (not `127.0.0.1` from a physical device).
3. Simulator/emulator on the same machine may use the host loopback or LAN IP depending on platform; prefer the LAN IP for consistency with device testing.
4. On the viewfinder, quick-release the shutter control to capture; hold ~300ms to focus. After notify, the bottom-right gallery button shows the last capture.
5. Tap the **ISO**, **TV**, or **AV** segment of the bottom pill; scrub the value rail that expands above it (or tap a value directly). Tap the segment again, or anywhere on the frame, to collapse.

## What demo mode covers

| Feature | Behavior |
| --- | --- |
| Live view | Synthetic frames |
| Focus / capture commands | Accepted; no real shutter |
| Battery / connection status | Simulated |
| Capture → review | Mock still cached; WS `IMAGE_READY`; HTTP `/captures/{id}/full.jpg` + thumb |
| Gallery / image download | Auto-fetch on notify; manual fetch still supported (`photo.jpg` = live snapshot) |
| Camera exposure (ISO / Tv / Av) | Mock current + available lists over WS; bottom pill expands a snapping value rail |
| App grid settings | Local-only (`settings.tsx`); unrelated to camera exposure |
| Real gphoto2 choice enumeration | Not finished (real mode available lists still empty) |

## Related flags

| Flag | Purpose |
| --- | --- |
| `-demo` | Mock camera |
| `-bench-completion` | Capture completion-mode benchmarking (real camera tooling) |
| `-bench-iters` | Iteration count for completion bench |

Use real mode (no `-demo`) only when a supported camera is connected and libgphoto2 is installed.
