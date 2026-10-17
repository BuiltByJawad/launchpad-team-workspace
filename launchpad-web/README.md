# LaunchPad web

A responsive sample issue board built with TypeScript, React, the Next.js-style App Router, and vinext for Cloudflare Workers. The board signs into a synthetic demo account through the same-origin `/api/backend` proxy and reads/writes fictional workspace data from the Express API Worker and D1. The session cookie is HttpOnly and short-lived. Demo changes are shared with visitors of the sample workspace. `/settings` provides role-gated project, member, and invitation management; the public sample member can view the page but cannot make administrative changes. `/invite` accepts a one-time invitation token only for a matching signed-in identity.

## Run locally

The local web Worker uses a Wrangler service binding to the API Worker, so start both Workers in separate terminals.

1. In `api-worker`, create `.dev.vars` from `.dev.vars.example`, set a random `JWT_SECRET` of at least 32 characters, then run `npm run db:local` and `npm run dev -- --local --port 8787`.
2. In `launchpad-web`, run `npm install`, `npm run build`, and `npm run start -- --port 8788`.
3. Open `http://localhost:8788` and choose **Try the live demo**.

Wrangler connects the local `LAUNCHPAD_API` service binding to the API Worker when both development processes are running. Local D1 state remains under Wrangler's local project state. No remote resource is changed by these commands.

## Production deployment notes

The frontend service binding expects a Worker named `launchpad-api`. Before deploying, configure the real D1 ID and API signing secret, apply migrations through `0005_workspace_management.sql`, run the project checklist, then deploy the API and web Workers. Never commit signing secrets or `.dev.vars`.
