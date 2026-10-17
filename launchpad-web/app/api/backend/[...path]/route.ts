import { env } from "cloudflare:workers";

const allowedPath = /^(?:auth\/(?:demo|logout)|api\/workspaces(?:\/[a-zA-Z0-9_-]{1,80}(?:\/(?:projects(?:\/[a-zA-Z0-9_-]{1,80}(?:\/tasks)?)?|members|invitations(?:\/[a-zA-Z0-9_-]{1,80})?|tasks\/[a-zA-Z0-9_-]{1,80}(?:\/(?:status|comments|activity))?))?)?|api\/invitations\/[a-zA-Z0-9_-]{40,50}\/accept)$/;
type ApiBinding = { fetch(request: Request): Promise<Response> };

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathString = path.join("/");
  if (!allowedPath.test(pathString)) return Response.json({ error: "Route not found" }, { status: 404 });
  const incoming = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== incoming.origin) return Response.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const target = new URL(`https://launchpad-api/${pathString}${incoming.search}`);
  const headers = new Headers(request.headers);
  headers.delete("host");
  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.arrayBuffer();
  return (env as unknown as { LAUNCHPAD_API: ApiBinding }).LAUNCHPAD_API.fetch(new Request(target, init));
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
