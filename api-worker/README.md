# LaunchPad API Worker

Express 5 runs in a Cloudflare Worker using `nodejs_compat`, D1, and a service-worker-compatible Node HTTP adapter. Workspace routes require a signed HS256 token. The public sample UI receives a short-lived `HttpOnly; SameSite=Lax` cookie from `POST /auth/demo`; it is issued only for the synthetic `usr_demo` member. The web Worker proxies allowed API paths on the same origin and rejects cross-origin writes. Bearer tokens remain supported for local API exploration. The API validates issuer, audience, algorithm, expiration, and subject, then looks up the subject's workspace membership before each request. Every record query is explicitly scoped by that membership's workspace ID.

## Local setup

1. Install Node.js, then run `npm install` in this directory.
2. Copy `.dev.vars.example` to `.dev.vars` and replace `JWT_SECRET` with at least 32 random bytes. Keep `.dev.vars` private and out of Git.
3. Replace the all-zero `database_id` in `wrangler.jsonc` only after creating the D1 database. Configure the returned ID and confirm migrations point at the LaunchPad root `migrations` folder.
4. Apply local schema and sample data with `npm run db:local`.
5. Start the worker with `npm run dev`.

Seed users are fictional (`@example.test`), including `usr_demo`, the shared public sample identity. Every demo visitor sees the same fictional workspace and writes are shared. For local authenticated API exploration, put a 32+ character random secret in `.dev.vars`, then run `npm run token:demo -- usr_maya` to print a 10-minute token for the synthetic owner. Use `usr_leo`, `usr_sam`, or `usr_ari` to inspect other role permissions. This local-only signer refuses `NODE_ENV=production`. The `/auth/demo` endpoint is only a demo-session grant for synthetic sample data; it is not production user authentication. Never use it for real accounts. Production user sign-in still requires a trusted identity provider; never deploy the local signing helper or commit the secret.

## API outline

- `GET /health` — runtime health.
- `GET /api/workspaces/:workspaceId` — workspace name and the authenticated member role.
- `GET /api/workspaces/:workspaceId/projects` — list projects for a member.
- `POST /api/workspaces/:workspaceId/projects` — create a project for an owner/admin.
- `GET /api/workspaces/:workspaceId/projects/:projectId/tasks` — list/filter tasks (`status`, `priority`).
- `POST /api/workspaces/:workspaceId/projects/:projectId/tasks` — create task and activity event.
- `PATCH /api/workspaces/:workspaceId/tasks/:taskId/status` — transition task and record activity.
- `GET/POST /api/workspaces/:workspaceId/tasks/:taskId/comments` — view/add comments.
- `GET /api/workspaces/:workspaceId/tasks/:taskId/activity` — view activity.

All protected read routes allow up to 120 requests per user/workspace per minute; write routes allow 30. The counter uses D1 so requests handled by separate Worker isolates share the limit. The web UI uses the API through its service binding and same-origin session proxy. The owner/admin settings panel and invitation acceptance page are present, but remain unavailable to the public demo member. The production identity provider and email delivery are not built. Invitation creation returns a one-time raw accept token to an authenticated manager; only its SHA-256 hash is stored in D1. Do not treat this as email delivery. The public demo identity is explicitly barred from workspace creation and invitation acceptance. Production requires a trusted identity provider that supplies verified email addresses and signs compatible tokens, plus an email provider before invitations can be delivered. Deployment still requires the production D1 ID, the API secret, remote migrations, and a Cloudflare preview review.
