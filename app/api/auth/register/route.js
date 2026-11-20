import { NextResponse } from "next/server";
import db from "../../../../lib/db.js";
import { createSession, sessionCookie } from "../../../../lib/auth.js";
import { json, readJson, safeError, sameOrigin } from "../../../../lib/http.js";
import { hashPassword } from "../../../../lib/password.js";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export async function POST(request) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  const body=await readJson(request);
  const name=String(body?.name||"").trim(); const email=String(body?.email||"").trim().toLowerCase(); const phone=String(body?.phone||"").trim(); const password=String(body?.password||"");
  if(name.length<2||name.length>80||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||phone.length>24||password.length<12||password.length>128) return json({error:"Enter a valid name, email, phone, and password of at least 12 characters."},400);
  const ipKey="ip:"+createHash("sha256").update(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"local").digest("hex"),emailKey="email:"+createHash("sha256").update(email).digest("hex"),now=Date.now();
  (await db.run("DELETE FROM auth_attempts WHERE attempted_at<?", [now-15*60*1000]));
  const recent=(await db.get("SELECT COUNT(*) AS n FROM auth_attempts WHERE attempt_key IN (?,?) AND attempted_at>=?", [ipKey, emailKey, now-15*60*1000])).n;
  if(recent>=20)return json({error:"Too many account requests. Try again later."},429);
  await db.run("INSERT INTO auth_attempts(attempt_key,attempted_at) VALUES(?,?)",[ipKey,now]);await db.run("INSERT INTO auth_attempts(attempt_key,attempted_at) VALUES(?,?)",[emailKey,now]);
  try {
    const result=await db.run("INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES(?,?,?,?, 'passenger',?) RETURNING id",[name,email,phone,hashPassword(password),new Date().toISOString()]);
    const {token,expiresAt}=await createSession(result.lastInsertRowid); const response=NextResponse.json({user:{id:result.lastInsertRowid,name,email,phone,role:"passenger"}},{status:201,headers:{"Cache-Control":"no-store"}});
    response.cookies.set(sessionCookie(token,expiresAt)); return response;
  } catch(error) { return json({error:safeError(error)},409); }
}
