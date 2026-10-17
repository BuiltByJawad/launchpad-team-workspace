# LaunchPad

A sample team issue/request workspace. The responsive board uses a same-origin API proxy, a short-lived HttpOnly demo session, an Express API Worker, and local/Cloudflare D1. Its sample team and work items are fictional; public demo edits are shared.

## Project structure

- `launchpad-web/` — Next.js-style App Router with TypeScript, React, and vinext for Cloudflare Workers.
- `api-worker/` — Express API Worker with signed demo sessions, membership/role checks, and D1 task/comment/activity endpoints.
- `migrations/` — D1-compatible schema and fictional sample workspace data.
- `launchpad-web/docs/` — product brief, architecture, and security notes.

See [`launchpad-web/README.md`](launchpad-web/README.md) for local two-Worker setup and [`api-worker/README.md`](api-worker/README.md) for API configuration.

The latest integration is local and has not been deployed. Do not add real customer/patient data, claim production traffic/performance without evidence, or describe Cloudflare D1 as PostgreSQL, KV as Redis, or Workers Free as managed Kubernetes.
