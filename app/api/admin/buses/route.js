import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin,safeError } from "../../../../lib/http.js";

export const dynamic="force-dynamic";
export function GET(request){const auth=requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);return json({buses:db.prepare("SELECT * FROM buses ORDER BY registration_number").all()});}
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const registration=String(body?.registrationNumber||"").trim().toUpperCase(),name=String(body?.name||"").trim(),type=String(body?.type||"").trim(),capacity=Number(body?.capacity);
  if(!/^[A-Z0-9 -]{4,16}$/.test(registration)||name.length<2||name.length>80||type.length<2||type.length>50||!Number.isInteger(capacity)||capacity<1||capacity>100)return json({error:"Enter a valid registration, bus name, type, and capacity."},400);
  try{const result=db.prepare("INSERT INTO buses(registration_number,bus_name,capacity,bus_type) VALUES(?,?,?,?)").run(registration,name,capacity,type);return json({id:Number(result.lastInsertRowid)},201);}catch(error){return json({error:safeError(error)},409);}
}
