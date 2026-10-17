import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import express, { type NextFunction, type Request, type Response } from "express";
import { jwtVerify, SignJWT } from "jose";

type CloudflareLaunchPadEnv = { DB: D1Database; JWT_SECRET: string; JWT_ISSUER: string; JWT_AUDIENCE: string };
const sessionCookie = "launchpad_session";
function cookieValue(req: Request, name: string) {
  return req.header("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
type Role = "owner" | "admin" | "member" | "viewer";
type AuthRequest = Request & { actor?: { id: string; role: Role; workspaceId: string } };
type IdentityRequest = Request & { identity?: { id: string; email: string; displayName: string; isDemo: boolean } };
type TaskStatus = "inbox" | "progress" | "review" | "done";
type TaskPriority = "urgent" | "high" | "normal" | "low";
const bindings = env as unknown as CloudflareLaunchPadEnv;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb", strict: true }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "launchpad-api" }));

// Public access is limited to synthetic sample data and a short-lived demo identity.
app.post("/auth/demo", async (req, res) => {
  if (!req.header("origin") || !req.header("sec-fetch-site")?.match(/^(same-origin|same-site)$/)) {
    return res.status(403).json({ error: "Start the demo from the LaunchPad website" });
  }
  if (!bindings.JWT_SECRET || bindings.JWT_SECRET.length < 32) return res.status(503).json({ error: "Authentication is not configured" });
  try {
    const member = await bindings.DB.prepare("SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ?")
      .bind("ws_northstar", "usr_demo").first();
    if (!member) return res.status(503).json({ error: "Demo account is not seeded" });
    const token = await new SignJWT({ demo: true })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("usr_demo")
      .setIssuer(bindings.JWT_ISSUER)
      .setAudience(bindings.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(new TextEncoder().encode(bindings.JWT_SECRET));
    const secure = req.header("origin")?.startsWith("https://") ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800${secure}`);
    return res.json({ demo: true, expiresIn: 1800 });
  } catch (error) { return fail(res, error); }
});
app.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res.status(204).end();
});

const allowedRoles: Record<string, Role[]> = {
  read: ["owner", "admin", "member", "viewer"],
  write: ["owner", "admin", "member"],
  manage: ["owner", "admin"],
};

async function readIdentity(req: Request) {
  const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || cookieValue(req, sessionCookie);
  if (!bindings.JWT_SECRET || bindings.JWT_SECRET.length < 32) throw new Error("AUTH_NOT_CONFIGURED");
  if (!token) throw new Error("AUTH_REQUIRED");
  const { payload } = await jwtVerify(token, new TextEncoder().encode(bindings.JWT_SECRET), {
    issuer: bindings.JWT_ISSUER, audience: bindings.JWT_AUDIENCE, algorithms: ["HS256"],
  });
  if (typeof payload.sub !== "string" || payload.sub.length > 100) throw new Error("AUTH_INVALID");
  const user = await bindings.DB.prepare("SELECT id, email, display_name FROM users WHERE id = ?")
    .bind(payload.sub).first<{ id: string; email: string; display_name: string }>();
  if (!user) throw new Error("AUTH_INVALID");
  return { id: user.id, email: user.email, displayName: user.display_name, isDemo: payload.demo === true };
}
async function authenticateIdentity(req: IdentityRequest, res: Response, next: NextFunction) {
  try {
    req.identity = await readIdentity(req);
    return next();
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "AUTH_NOT_CONFIGURED") return res.status(503).json({ error: "Authentication is not configured" });
    if (code === "AUTH_REQUIRED") return res.status(401).json({ error: "Authentication required" });
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}
function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const workspaceId = req.params.workspaceId;
  const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || cookieValue(req, sessionCookie);
  if (typeof workspaceId !== "string" || !workspaceId) return res.status(400).json({ error: "Invalid workspace id" });
  if (!bindings.JWT_SECRET || bindings.JWT_SECRET.length < 32) return res.status(503).json({ error: "Authentication is not configured" });
  if (!token) return res.status(401).json({ error: "Authentication required" });

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(bindings.JWT_SECRET), {
      issuer: bindings.JWT_ISSUER,
      audience: bindings.JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || payload.sub.length > 100) return res.status(401).json({ error: "Invalid identity token" });
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }

  try {
    const membership = await bindings.DB.prepare(
      "SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ?",
    ).bind(workspaceId, userId).first<{ role: Role }>();
    if (!membership) return res.status(404).json({ error: "Workspace not found" });
    req.actor = { id: userId, role: membership.role, workspaceId };
    return next();
  } catch (error) { return fail(res, error); }
}
function requireRole(capability: "read" | "write" | "manage") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.actor || !allowedRoles[capability].includes(req.actor.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    return next();
  };
}

function rateLimit(kind: "read" | "write") {
  const maximum = kind === "read" ? 120 : 30;
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.actor) return res.status(401).json({ error: "Authentication required" });
    const windowStart = Math.floor(Date.now() / 60_000);
    const scopeKey = `${req.actor.workspaceId}:${req.actor.id}:${kind}`;
    try {
      const counter = await bindings.DB.prepare(
        "INSERT INTO api_rate_limits (scope_key, window_start, request_count) VALUES (?, ?, 1) ON CONFLICT(scope_key, window_start) DO UPDATE SET request_count = request_count + 1 RETURNING request_count",
      ).bind(scopeKey, windowStart).first<{ request_count: number }>();
      if (!counter) return fail(res, new Error("Rate counter unavailable"));
      if (counter.request_count % 100 === 0) {
        await bindings.DB.prepare("DELETE FROM api_rate_limits WHERE window_start < ?").bind(windowStart - 10).run();
      }
      if (counter.request_count > maximum) {
        res.setHeader("Retry-After", String(60 - (Math.floor(Date.now() / 1000) % 60)));
        return res.status(429).json({ error: "Too many requests; retry after the current minute" });
      }
      return next();
    } catch (error) { return fail(res, error); }
  };
}
function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}
function validStatus(value: unknown): value is TaskStatus {
  return value === "inbox" || value === "progress" || value === "review" || value === "done";
}
function validPriority(value: unknown): value is TaskPriority {
  return value === "urgent" || value === "high" || value === "normal" || value === "low";
}
function fail(res: Response, error: unknown) {
  // Log only an opaque request-side error category; never send SQL or token details to callers.
  console.error("LaunchPad API request failed", error instanceof Error ? error.name : "UnknownError");
  return res.status(500).json({ error: "The request could not be completed" });
}

// Identity-scoped workspace endpoints allow an authenticated user to create a workspace;
// the owner membership is created atomically with its initial project.
app.get("/api/workspaces", authenticateIdentity, async (req: IdentityRequest, res) => {
  try {
    const result = await bindings.DB.prepare(
      "SELECT w.id, w.name, w.slug, m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ? ORDER BY w.created_at DESC",
    ).bind(req.identity!.id).all();
    return res.json({ workspaces: result.results });
  } catch (error) { return fail(res, error); }
});
app.post("/api/workspaces", authenticateIdentity, async (req: IdentityRequest, res) => {
  if (req.identity!.isDemo) return res.status(403).json({ error: "Workspace creation requires a verified account" });
  const ownedCount = await bindings.DB.prepare("SELECT COUNT(*) AS count FROM memberships WHERE user_id = ? AND role = 'owner'")
    .bind(req.identity!.id).first<{ count: number }>();
  if ((ownedCount?.count ?? 0) >= 10) return res.status(429).json({ error: "Workspace owner limit reached" });
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 80) return res.status(400).json({ error: "Workspace name must contain 1 to 80 characters" });
  const id = crypto.randomUUID();
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "workspace";
  const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
  const projectId = crypto.randomUUID();
  try {
    await bindings.DB.batch([
      bindings.DB.prepare("INSERT INTO workspaces (id, name, slug) VALUES (?, ?, ?)").bind(id, name, slug),
      bindings.DB.prepare("INSERT INTO memberships (workspace_id, user_id, role) VALUES (?, ?, 'owner')").bind(id, req.identity!.id),
      bindings.DB.prepare("INSERT INTO projects (id, workspace_id, name, key_prefix) VALUES (?, ?, 'General', 'GEN')").bind(projectId, id),
    ]);
    return res.status(201).json({ workspace: { id, name, slug, role: "owner" }, project: { id: projectId, name: "General", keyPrefix: "GEN" } });
  } catch (error) { return fail(res, error); }
});
app.post("/api/invitations/:token/accept", authenticateIdentity, async (req: IdentityRequest, res) => {
  if (req.identity!.isDemo) return res.status(403).json({ error: "Invitation acceptance requires a verified account" });
  const token = req.params.token;
  if (typeof token !== "string" || !/^[a-zA-Z0-9_-]{40,50}$/.test(token)) return res.status(400).json({ error: "Invalid invitation token" });
  try {
    const invitation = await bindings.DB.prepare(
      "SELECT id, workspace_id, email, role FROM workspace_invitations WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')",
    ).bind(await hashToken(token)).first<{ id: string; workspace_id: string; email: string; role: Role }>();
    if (!invitation) return res.status(404).json({ error: "Invitation is invalid or expired" });
    if (invitation.email.toLowerCase() !== req.identity!.email.toLowerCase()) return res.status(403).json({ error: "This invitation belongs to a different email address" });
    await bindings.DB.batch([
      bindings.DB.prepare("INSERT OR IGNORE INTO memberships (workspace_id, user_id, role) VALUES (?, ?, ?)").bind(invitation.workspace_id, req.identity!.id, invitation.role),
      bindings.DB.prepare("UPDATE workspace_invitations SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND accepted_at IS NULL").bind(invitation.id),
    ]);
    return res.json({ accepted: true, workspaceId: invitation.workspace_id, role: invitation.role });
  } catch (error) { return fail(res, error); }
});

app.get("/api/workspaces/:workspaceId", authenticate, requireRole("read"), rateLimit("read"), async (req: AuthRequest, res) => {
  try {
    const workspace = await bindings.DB.prepare(
      "SELECT id, name, slug, created_at FROM workspaces WHERE id = ?",
    ).bind(req.actor!.workspaceId).first();
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });
    return res.json({ workspace, role: req.actor!.role });
  } catch (error) { return fail(res, error); }
});
app.get("/api/workspaces/:workspaceId/members", authenticate, requireRole("manage"), rateLimit("read"), async (req: AuthRequest, res) => {
  try {
    const result = await bindings.DB.prepare(
      "SELECT u.id, u.display_name, u.email, m.role, m.joined_at FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.display_name",
    ).bind(req.actor!.workspaceId).all();
    return res.json({ members: result.results });
  } catch (error) { return fail(res, error); }
});
app.get("/api/workspaces/:workspaceId/invitations", authenticate, requireRole("manage"), rateLimit("read"), async (req: AuthRequest, res) => {
  try {
    const result = await bindings.DB.prepare(
      "SELECT id, email, role, expires_at, accepted_at, created_at FROM workspace_invitations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100",
    ).bind(req.actor!.workspaceId).all();
    return res.json({ invitations: result.results });
  } catch (error) { return fail(res, error); }
});
app.post("/api/workspaces/:workspaceId/invitations", authenticate, requireRole("manage"), rateLimit("write"), async (req: AuthRequest, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const role = req.body?.role;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (role !== "admin" && role !== "member" && role !== "viewer") return res.status(400).json({ error: "Invitation role must be admin, member, or viewer" });
  try {
    const existing = await bindings.DB.prepare("SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? AND lower(u.email) = ?")
      .bind(req.actor!.workspaceId, email).first();
    if (existing) return res.status(409).json({ error: "That email already belongs to this workspace" });
    const token = makeToken();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await bindings.DB.prepare("INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, req.actor!.workspaceId, email, role, await hashToken(token), req.actor!.id, expiresAt).run();
    // The raw token is returned once to the authenticated manager. No email is sent until an email provider is configured.
    return res.status(201).json({ invitation: { id, email, role, expiresAt, acceptToken: token }, delivery: "manual-demo-link" });
  } catch (error) { return fail(res, error); }
});
app.delete("/api/workspaces/:workspaceId/invitations/:invitationId", authenticate, requireRole("manage"), rateLimit("write"), async (req: AuthRequest, res) => {
  const { invitationId } = req.params;
  if (!validId(invitationId)) return res.status(400).json({ error: "Invalid invitation id" });
  try {
    const result = await bindings.DB.prepare("DELETE FROM workspace_invitations WHERE workspace_id = ? AND id = ? AND accepted_at IS NULL")
      .bind(req.actor!.workspaceId, invitationId).run();
    if (!result.meta.changes) return res.status(404).json({ error: "Pending invitation not found" });
    return res.status(204).end();
  } catch (error) { return fail(res, error); }
});

app.get("/api/workspaces/:workspaceId/projects", authenticate, requireRole("read"), rateLimit("read"), async (req: AuthRequest, res) => {
  try {
    const result = await bindings.DB.prepare(
      "SELECT id, name, key_prefix, created_at FROM projects WHERE workspace_id = ? ORDER BY created_at",
    ).bind(req.actor!.workspaceId).all();
    return res.json({ projects: result.results });
  } catch (error) { return fail(res, error); }
});

app.post("/api/workspaces/:workspaceId/projects", authenticate, requireRole("manage"), rateLimit("write"), async (req: AuthRequest, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const keyPrefix = typeof req.body?.keyPrefix === "string" ? req.body.keyPrefix.trim().toUpperCase() : "";
  if (!name || name.length > 100) return res.status(400).json({ error: "Project name must contain 1 to 100 characters" });
  if (!/^[A-Z0-9]{2,8}$/.test(keyPrefix)) return res.status(400).json({ error: "Project key must contain 2 to 8 letters or numbers" });
  try {
    const id = crypto.randomUUID();
    await bindings.DB.prepare("INSERT INTO projects (id, workspace_id, name, key_prefix) VALUES (?, ?, ?, ?)")
      .bind(id, req.actor!.workspaceId, name, keyPrefix).run();
    return res.status(201).json({ project: { id, name, keyPrefix } });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return res.status(409).json({ error: "That project key is already in use" });
    return fail(res, error);
  }
});
app.patch("/api/workspaces/:workspaceId/projects/:projectId", authenticate, requireRole("manage"), rateLimit("write"), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const keyPrefix = typeof req.body?.keyPrefix === "string" ? req.body.keyPrefix.trim().toUpperCase() : "";
  if (!validId(projectId)) return res.status(400).json({ error: "Invalid project id" });
  if (!name || name.length > 100) return res.status(400).json({ error: "Project name must contain 1 to 100 characters" });
  if (!/^[A-Z0-9]{2,8}$/.test(keyPrefix)) return res.status(400).json({ error: "Project key must contain 2 to 8 letters or numbers" });
  try {
    const result = await bindings.DB.prepare("UPDATE projects SET name = ?, key_prefix = ? WHERE workspace_id = ? AND id = ?")
      .bind(name, keyPrefix, req.actor!.workspaceId, projectId).run();
    if (!result.meta.changes) return res.status(404).json({ error: "Project not found" });
    return res.json({ project: { id: projectId, name, keyPrefix } });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return res.status(409).json({ error: "That project key is already in use" });
    return fail(res, error);
  }
});
app.delete("/api/workspaces/:workspaceId/projects/:projectId", authenticate, requireRole("manage"), rateLimit("write"), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  if (!validId(projectId)) return res.status(400).json({ error: "Invalid project id" });
  try {
    const result = await bindings.DB.prepare("DELETE FROM projects WHERE workspace_id = ? AND id = ?")
      .bind(req.actor!.workspaceId, projectId).run();
    if (!result.meta.changes) return res.status(404).json({ error: "Project not found" });
    return res.status(204).end();
  } catch (error) { return fail(res, error); }
});

app.get("/api/workspaces/:workspaceId/projects/:projectId/tasks", authenticate, requireRole("read"), rateLimit("read"), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  if (!validId(projectId)) return res.status(400).json({ error: "Invalid project id" });
  const status = req.query.status;
  const priority = req.query.priority;
  if (status !== undefined && !validStatus(status)) return res.status(400).json({ error: "Invalid status filter" });
  if (priority !== undefined && !validPriority(priority)) return res.status(400).json({ error: "Invalid priority filter" });
  try {
    const clauses = ["workspace_id = ?", "project_id = ?"];
    const values: (string | number)[] = [req.actor!.workspaceId, projectId];
    if (typeof status === "string") { clauses.push("status = ?"); values.push(status); }
    if (typeof priority === "string") { clauses.push("priority = ?"); values.push(priority); }
    const result = await bindings.DB.prepare(
      `SELECT t.id, t.project_id, t.sequence, t.title, t.description, t.status, t.priority, t.assignee_id, u.display_name AS assignee_name, t.due_date, t.created_at, t.updated_at FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE ${clauses.map((clause) => clause.replaceAll("workspace_id", "t.workspace_id").replaceAll("project_id", "t.project_id").replaceAll("status", "t.status").replaceAll("priority", "t.priority")).join(" AND ")} ORDER BY t.sequence DESC LIMIT 100`,
    ).bind(...values).all();
    return res.json({ tasks: result.results });
  } catch (error) { return fail(res, error); }
});

app.post("/api/workspaces/:workspaceId/projects/:projectId/tasks", authenticate, requireRole("write"), rateLimit("write"), async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const priority = req.body?.priority ?? "normal";
  if (!validId(projectId)) return res.status(400).json({ error: "Invalid project id" });
  if (!title || title.length > 160) return res.status(400).json({ error: "Title must contain 1 to 160 characters" });
  if (description.length > 5000) return res.status(400).json({ error: "Description is too long" });
  if (!validPriority(priority)) return res.status(400).json({ error: "Invalid priority" });
  try {
    const project = await bindings.DB.prepare(
      "SELECT id, key_prefix FROM projects WHERE workspace_id = ? AND id = ?",
    ).bind(req.actor!.workspaceId, projectId).first<{ id: string; key_prefix: string }>();
    if (!project) return res.status(404).json({ error: "Project not found" });
    const id = crypto.randomUUID();
    const statements = [
      bindings.DB.prepare("INSERT INTO tasks (id, workspace_id, project_id, sequence, title, description, priority, created_by) SELECT ?, ?, ?, COALESCE(MAX(sequence), 0) + 1, ?, ?, ?, ? FROM tasks WHERE workspace_id = ? AND project_id = ?")
        .bind(id, req.actor!.workspaceId, projectId, title, description, priority, req.actor!.id, req.actor!.workspaceId, projectId),
      bindings.DB.prepare("INSERT INTO activity_events (id, workspace_id, task_id, actor_id, event_type, payload_json) SELECT ?, ?, id, ?, 'created', '{}' FROM tasks WHERE workspace_id = ? AND project_id = ? AND id = ?")
        .bind(crypto.randomUUID(), req.actor!.workspaceId, req.actor!.id, req.actor!.workspaceId, projectId, id),
    ];
    await bindings.DB.batch(statements);
    const created = await bindings.DB.prepare("SELECT sequence FROM tasks WHERE workspace_id = ? AND project_id = ? AND id = ?")
      .bind(req.actor!.workspaceId, projectId, id).first<{ sequence: number }>();
    if (!created) return res.status(500).json({ error: "The task could not be created" });
    return res.status(201).json({ task: { id, projectId, sequence: created.sequence, title, description, status: "inbox", priority } });
  } catch (error) { return fail(res, error); }
});

app.patch("/api/workspaces/:workspaceId/tasks/:taskId/status", authenticate, requireRole("write"), rateLimit("write"), async (req: AuthRequest, res) => {
  const { taskId } = req.params;
  const status = req.body?.status;
  if (!validId(taskId)) return res.status(400).json({ error: "Invalid task id" });
  if (!validStatus(status)) return res.status(400).json({ error: "Invalid task status" });
  try {
    const task = await bindings.DB.prepare("SELECT status FROM tasks WHERE workspace_id = ? AND id = ?")
      .bind(req.actor!.workspaceId, taskId).first<{ status: TaskStatus }>();
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.status === status) return res.json({ status });
    await bindings.DB.batch([
      bindings.DB.prepare("UPDATE tasks SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE workspace_id = ? AND id = ?")
        .bind(status, req.actor!.workspaceId, taskId),
      bindings.DB.prepare("INSERT INTO activity_events (id, workspace_id, task_id, actor_id, event_type, payload_json) VALUES (?, ?, ?, ?, 'status_changed', ?)")
        .bind(crypto.randomUUID(), req.actor!.workspaceId, taskId, req.actor!.id, JSON.stringify({ from: task.status, to: status })),
    ]);
    return res.json({ status });
  } catch (error) { return fail(res, error); }
});

app.get("/api/workspaces/:workspaceId/tasks/:taskId/comments", authenticate, requireRole("read"), rateLimit("read"), async (req: AuthRequest, res) => {
  const { taskId } = req.params;
  if (!validId(taskId)) return res.status(400).json({ error: "Invalid task id" });
  try {
    const result = await bindings.DB.prepare(
      "SELECT c.id, c.body, c.created_at, u.display_name AS author FROM comments c JOIN tasks t ON t.workspace_id = c.workspace_id AND t.id = c.task_id JOIN users u ON u.id = c.author_id WHERE c.workspace_id = ? AND c.task_id = ? ORDER BY c.created_at LIMIT 100",
    ).bind(req.actor!.workspaceId, taskId).all();
    return res.json({ comments: result.results });
  } catch (error) { return fail(res, error); }
});

app.post("/api/workspaces/:workspaceId/tasks/:taskId/comments", authenticate, requireRole("write"), rateLimit("write"), async (req: AuthRequest, res) => {
  const { taskId } = req.params;
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!validId(taskId)) return res.status(400).json({ error: "Invalid task id" });
  if (!body || body.length > 3000) return res.status(400).json({ error: "Comment must contain 1 to 3000 characters" });
  try {
    const task = await bindings.DB.prepare("SELECT id FROM tasks WHERE workspace_id = ? AND id = ?")
      .bind(req.actor!.workspaceId, taskId).first();
    if (!task) return res.status(404).json({ error: "Task not found" });
    const id = crypto.randomUUID();
    await bindings.DB.batch([
      bindings.DB.prepare("INSERT INTO comments (id, workspace_id, task_id, author_id, body) VALUES (?, ?, ?, ?, ?)")
        .bind(id, req.actor!.workspaceId, taskId, req.actor!.id, body),
      bindings.DB.prepare("INSERT INTO activity_events (id, workspace_id, task_id, actor_id, event_type, payload_json) VALUES (?, ?, ?, ?, 'commented', '{}')")
        .bind(crypto.randomUUID(), req.actor!.workspaceId, taskId, req.actor!.id),
    ]);
    return res.status(201).json({ comment: { id, body } });
  } catch (error) { return fail(res, error); }
});

app.get("/api/workspaces/:workspaceId/tasks/:taskId/activity", authenticate, requireRole("read"), rateLimit("read"), async (req: AuthRequest, res) => {
  const { taskId } = req.params;
  if (!validId(taskId)) return res.status(400).json({ error: "Invalid task id" });
  try {
    const result = await bindings.DB.prepare(
      "SELECT a.id, a.event_type, a.payload_json, a.created_at, u.display_name AS actor FROM activity_events a JOIN tasks t ON t.workspace_id = a.workspace_id AND t.id = a.task_id JOIN users u ON u.id = a.actor_id WHERE a.workspace_id = ? AND a.task_id = ? ORDER BY a.created_at DESC LIMIT 100",
    ).bind(req.actor!.workspaceId, taskId).all();
    return res.json({ events: result.results });
  } catch (error) { return fail(res, error); }
});

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("LaunchPad API middleware failed", error instanceof Error ? error.name : "UnknownError");
  return res.status(400).json({ error: "Invalid request" });
});

app.listen(3000);
export default httpServerHandler({ port: 3000 });
