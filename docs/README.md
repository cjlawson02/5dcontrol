# 5DControl documentation

Canonical product and engineering docs for the monorepo.

| Doc | Purpose |
| --- | --- |
| [PRODUCT.md](./PRODUCT.md) | Vision, personas, and CamRanger-class parity targets |
| [HLD.md](./HLD.md) | High-level design: components, data flows, boundaries |
| [ROADMAP.md](./ROADMAP.md) | Shipped timeline (from git) and planned phases |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, commands, protocol workflow, testing |
| [DEMO_MODE.md](./DEMO_MODE.md) | Running without a physical camera |

Agent-oriented working notes live in [`CLAUDE.md`](../CLAUDE.md) at the repo root and should stay aligned with these docs.

## Current documentation status

| Artifact | Status |
| --- | --- |
| Product README | Accurate quick-start (root `README.md`) |
| HLD / Roadmap / Product | Under `docs/`; M1 capture→review + M2 exposure (sim) reflected |
| Demo mode guide | `DEMO_MODE.md` (IMAGE_READY + exposure pill happy paths) |
| Development guide | Endpoints, protocol, capture→review + exposure pointers |
| User manuals / supported-camera matrices | Not started |
| API reference beyond FlatBuffers schema | Not started |
| ADR (architecture decision records) | Not started; recommend adding when protocol expands |
