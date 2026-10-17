# LaunchPad product brief

## Product
LaunchPad is a small-team workspace for turning incoming requests into visible, owned work. Its first demo uses a fictional product studio and synthetic tasks. The MVP focuses on an issue board, task search and priority filters, task creation, status movement, task detail/comments, and a clear activity trail.

## People and permissions
- **Owner:** manages the workspace, members, projects, and all work.
- **Admin:** manages members and projects; can edit all tasks.
- **Member:** can view workspace work and create/update tasks and comments.
- **Viewer:** read-only access.

Every record belongs to a workspace. Every API query must derive workspace access from the authenticated membership and constrain reads/writes with `workspace_id`; never trust a workspace ID supplied by the browser as proof of access. Composite foreign keys include workspace identity to make cross-workspace references harder to create accidentally. Authentication and authorization are required before enabling write routes or deploying a persistent API.

## MVP boundaries
- Hosted architecture: vinext Next.js Worker + Express API Worker + D1, with a D1 service binding for same-origin browser requests.
- Local architecture may use PostgreSQL/Redis/Kubernetes labs later to demonstrate the user's broader stack, but those are separate proof environments. D1 is not PostgreSQL; Cloudflare KV is not Redis; Cloudflare Free does not provide a managed Kubernetes cluster.
- Current interface is a local demo. Browser-local sample changes are not yet synced to a server.
- No real customer, employee, or patient information. No unmeasured performance claims.

## Data model
`workspaces` contain `memberships` and `projects`; `tasks` belong to both a workspace and project; `comments` and `activity_events` belong to workspace/task and record the actor. Stable IDs are UUID-like text values. Timestamps are UTC ISO-8601 strings. Status and priority are constrained enums.

## Definition of done for the vertical slice
A visitor can inspect sample board data, search/filter it, create a task, move it between states, open its detail view, and add a comment. Persisted API routes enforce membership/role checks and tenant scoping before the hosted demo is exposed.
