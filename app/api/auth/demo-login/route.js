import { NextResponse } from "next/server";
import db from "../../../../lib/db.js";
import { createSession,sessionCookie } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const role=String((await readJson(request))?.role||"");
  if(!["admin","driver","passenger"].includes(role))return json({error:"Choose a valid demo dashboard."},400);
  const email=`demo-${role}@smartbus.test`;
  let user=await db.get("SELECT id,name,email,phone,role FROM users WHERE email=?",[email]);
  if(!user){const name={admin:"Demo Admin",driver:"Demo Driver",passenger:"Demo Passenger"}[role];const result=await db.run("INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES(?,?, '', '', ?, ?) RETURNING id",[name,email,role,new Date().toISOString()]);user={id:result.lastInsertRowid,name,email,phone:"",role};}
  const {token,expiresAt}=await createSession(user.id);const response=NextResponse.json({user},{headers:{"Cache-Control":"no-store"}});response.cookies.set(sessionCookie(token,expiresAt));return response;
}
