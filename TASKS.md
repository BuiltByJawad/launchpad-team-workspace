# LaunchPad — active project checklist

Status: IN PROGRESS. Resume from the first unchecked item under Next. Latest completed work: owner/admin settings and invite acceptance UI (2026-10-17); API type-check, D1 migration, Wrangler dry run, and web production build pass; no deployment was made.

## Completed
- [x] Initialize Git on `main`; add root ignore rules for secrets/generated output; verify staged files exclude `.dev.vars`, dependencies, and builds. Initial commit and GitHub remote await the user's privacy-safe Git author email and repository URL.
- [x] Create separate project folder on E: and preserve the master/project continuation checklists.
- [x] Generate the Cloudflare-ready Next.js/vinext app and install locked, exact frontend package versions.
- [x] Inspect the generated package, app, and Wrangler configuration.
- [x] Write product brief, roles, tenant-isolation rules, MVP boundaries, and D1-compatible model.
- [x] Add initial D1 schema and fictional demo seed for workspaces, users, memberships, projects, tasks, comments, and activity; include tenant-scoped foreign keys/indexes.
- [x] Add D1-backed per-user/workspace read/write rate-limit counters; apply migrations through 0004 locally.
- [x] Build responsive board UI with search, priority filtering, task creation, status movement, task details, comments, and activity history; connect it to the D1 API in the session integration below.
- [x] Label fictional sample data and shared demo edits clearly; remove fabricated progress/performance claims.
- [x] Implement Express API Worker with workspace detail, project list/create, task list/create/status, comment, and activity routes.
- [x] Add HS256 JWT verification, role checks, workspace membership lookup, workspace-scoped D1 queries, validation, and generic errors.
- [x] Runtime-check auth and tenant isolation: no-token 401, owner list/create 200/201, viewer write 403, unknown workspace 404, comment/activity persistence, duplicate project key 409, rate limit 429. Remove temporary test records after checks.
- [x] Add short-lived synthetic local token helper, `.dev.vars.example`, API setup guide, architecture diagram, and security notes.
- [x] Frontend production build and production dependency audit passed on 2026-10-12; `npm audit --omit=dev` reports zero advisories.
- [x] API type-check and Wrangler deploy dry-run passed on 2026-10-12 (dry-run only; not deployed).
- [x] Document full audit's remaining seven high dev-tool findings from `braces@3.0.3`; no patched upstream release was available on review date. Avoided forced vinext downgrade.

## Next
- [x] Add a public demo-only session grant for the synthetic account; issue a short-lived HttpOnly SameSite cookie and keep secrets out of the browser. Production user sign-in still needs a trusted identity provider.
- [x] Connect the board through an allowlisted same-origin API proxy and Cloudflare service binding; add session/loading/error/empty states and label shared fictional sample data.
- [x] Implement API workspace creation/listing, owner/admin member and invitation routes, hashed seven-day invitation tokens with email match on acceptance, and project update/delete; proxy allowlist only these routes. Public demo identity cannot create workspaces or accept invitations. Local migration, API type-check, and frontend build pass. No admin settings UI, identity provider, or email delivery yet.
- [x] Build responsive owner/admin settings UI for members, invitations, and project CRUD; add an invitation acceptance page and hide mutations from non-admin roles. Invite tokens are removed from the URL before acceptance.
- [ ] Integrate a trusted identity provider and verified-email sign-in, add invitation email delivery, and exercise member acceptance end to end.
- [ ] Review D1 rate-limit query cost and tune against Cloudflare Free quotas; add retention cleanup that does not run on every request.
- [x] Review desktop (1280px) and mobile (390px) layouts in the browser: neither page overflows; mobile board has a visible horizontal-scroll hint. Check Tab order, Ctrl/Cmd+K and `/` search focus, modal initial focus, Tab trapping, Escape close, focus return, and browser console (no errors).
- [ ] Add integration/contract tests and CI after UI/API integration is stable.
- [ ] Replace zero D1 ID with an actual Cloudflare D1 resource ID when ready; production identity secrets must never be committed.
- [ ] Recheck the upstream braces advisory and remove the dev-tool risk when a safe compatible release is available.
- [x] Build and locally preview the integrated frontend; verify API session cookie, workspace/project/task reads, create/status/comment writes, cross-origin rejection (403), and remove temporary test data.
- [ ] Review the built demo visually in a browser at desktop and mobile widths; check keyboard and focus behavior.
- [ ] Configure the production D1 ID and JWT secret; apply remote migrations including 0004 only when deployment is ready.
- [ ] Build and preview the current Cloudflare Worker bundle, check D1/service bindings, then deploy only when explicitly requested; record URL and current free-plan limits.

## Honest-demo rules
Use fictional data only. Do not claim production traffic, millions of requests, customer outcomes, or performance without evidence. D1 is not PostgreSQL; KV is not Redis; Workers Free does not provide managed Kubernetes. Describe local Redis/kind/Grafana labs as local.
