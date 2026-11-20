import { createHash, randomBytes } from "node:crypto";
import db from "./db.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const publicUser = ({ id,name,email,phone,role }) => ({ id,name,email,phone,role });

export async function createSession(userId) {
  await clearExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + 7*24*60*60*1000;
  await db.run("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",[hashToken(token),userId,expiresAt]);
  return { token, expiresAt };
}

export async function getSessionUser(request) {
  const token = request.cookies.get("smartbus_session")?.value;
  if (!token) return null;
  const row = await db.get("SELECT u.id,u.name,u.email,u.phone,u.role,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?",[hashToken(token)]);
  if (!row || row.expires_at <= Date.now()) {
    if(row)await db.run("DELETE FROM sessions WHERE token_hash=?",[hashToken(token)]);
    return null;
  }
  return publicUser(row);
}

export async function requireUser(request, roles = []) {
  const user = await getSessionUser(request);
  if (!user) return { error: "Sign in to continue.", status: 401 };
  if (roles.length && !roles.includes(user.role)) return { error: "You don’t have access to this action.", status: 403 };
  return { user };
}

export function sessionCookie(token, expiresAt) {
  return { name: "smartbus_session", value: token, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expiresAt) };
}

export async function clearExpiredSessions() {
  await db.run("DELETE FROM sessions WHERE expires_at<=?",[Date.now()]);
}
