import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin,safeError } from "../../../../lib/http.js";
import { hashPassword } from "../../../../lib/password.js";

export const dynamic="force-dynamic";
export async function GET(request){const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);return json({drivers:(await db.all("SELECT id,name,email,phone FROM users WHERE role='driver' ORDER BY name"))});}
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const name=String(body?.name||"").trim(),email=String(body?.email||"").trim().toLowerCase(),phone=String(body?.phone||"").trim(),password=String(body?.password||"");
  if(name.length<2||name.length>80||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||phone.length>24||password.length<12||password.length>128)return json({error:"Enter a valid driver name, email, phone, and password of at least 12 characters."},400);
  try{const result=await db.run("INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES(?,?,?,?, 'driver',?) RETURNING id",[name,email,phone,hashPassword(password),new Date().toISOString()]);return json({id:result.lastInsertRowid},201);}catch(error){return json({error:safeError(error)},409);}
}
