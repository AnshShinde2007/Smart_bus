import { createHash, randomBytes } from "node:crypto";
import db from "./db.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const publicUser = ({ id,name,email,phone,role }) => ({ id,name,email,phone,role });

export function createSession(userId) {
  clearExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + 7*24*60*60*1000;
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(hashToken(token),userId,expiresAt);
  return { token, expiresAt };
}

export function getSessionUser(request) {
  const token = request.cookies.get("smartbus_session")?.value;
  if (!token) return null;
  const row = db.prepare("SELECT u.id,u.name,u.email,u.phone,u.role,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?").get(hashToken(token));
  if (!row || row.expires_at <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
    return null;
  }
  return publicUser(row);
}

export function requireUser(request, roles = []) {
  const user = getSessionUser(request);
  if (!user) return { error: "Sign in to continue.", status: 401 };
  if (roles.length && !roles.includes(user.role)) return { error: "You don’t have access to this action.", status: 403 };
  return { user };
}

export function sessionCookie(token, expiresAt) {
  return { name: "smartbus_session", value: token, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expiresAt) };
}

export function clearExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
}
