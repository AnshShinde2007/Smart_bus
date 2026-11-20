import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import db from "../../../../lib/db.js";
import { createSession, sessionCookie } from "../../../../lib/auth.js";
import { json, readJson, sameOrigin } from "../../../../lib/http.js";
import { verifyPassword } from "../../../../lib/password.js";

export const dynamic = "force-dynamic";
export async function POST(request) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  const body=await readJson(request);
  const email=String(body?.email||"").trim().toLowerCase(); const password=String(body?.password||"");
  if(email.length>254||password.length>128||!email||!password) return json({error:"Enter your email and password."},400);
  const ipKey="ip:"+createHash("sha256").update(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"local").digest("hex");const emailKey="email:"+createHash("sha256").update(email).digest("hex");
  const now=Date.now(); (await db.run("DELETE FROM auth_attempts WHERE attempted_at<?", [now-15*60*1000]));
  const failures=(await db.get("SELECT COUNT(*) AS n FROM auth_attempts WHERE attempt_key IN (?,?) AND attempted_at>=?", [ipKey, emailKey, now-15*60*1000])).n;
  if(failures>=20) return json({error:"Too many sign-in attempts. Try again in 15 minutes."},429);
  const user=(await db.get("SELECT id,name,email,phone,role,password_hash FROM users WHERE email=?", [email]));
  if(!user||!verifyPassword(password,user.password_hash)) {
    await db.run("INSERT INTO auth_attempts(attempt_key,attempted_at) VALUES(?,?)",[ipKey,now]);await db.run("INSERT INTO auth_attempts(attempt_key,attempted_at) VALUES(?,?)",[emailKey,now]);
    return json({error:"Email or password is incorrect."},401);
  }
  (await db.run("DELETE FROM auth_attempts WHERE attempt_key IN (?,?)", [ipKey, emailKey]));
  const {token,expiresAt}=await createSession(user.id); const response=NextResponse.json({user:{id:user.id,name:user.name,email:user.email,phone:user.phone,role:user.role}},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(sessionCookie(token,expiresAt)); return response;
}
