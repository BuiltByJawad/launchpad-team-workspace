import { readFileSync } from "node:fs";
import { SignJWT } from "jose";

if (process.env.NODE_ENV === "production") throw new Error("The local demo token helper cannot run in production.");
const secretLine = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith("JWT_SECRET="));
const secret = secretLine?.slice("JWT_SECRET=".length).trim();
if (!secret || secret.length < 32) throw new Error("Set JWT_SECRET to 32+ random bytes in api-worker/.dev.vars first.");
const userId = process.argv[2] || "usr_maya";
if (!["usr_maya", "usr_leo", "usr_sam", "usr_ari"].includes(userId)) throw new Error("Use one seeded synthetic user ID: usr_maya, usr_leo, usr_sam, or usr_ari.");
const token = await new SignJWT({})
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(userId)
  .setIssuer("launchpad-auth")
  .setAudience("launchpad-api")
  .setIssuedAt()
  .setExpirationTime("10m")
  .sign(new TextEncoder().encode(secret));
process.stdout.write(`${token}\n`);
