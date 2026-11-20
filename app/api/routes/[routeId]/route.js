import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin,safeError } from "../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function PATCH(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {routeId}=await params;const body=await readJson(request);const name=String(body?.name||"").trim(),source=String(body?.source||"").trim(),destination=String(body?.destination||"").trim();
  if(!name||name.length>100||!source||source.length>80||!destination||destination.length>80||source===destination)return json({error:"Enter a valid route name and two different endpoints."},400);
  if((await db.get("SELECT 1 FROM trips WHERE route_id=?", [routeId])))return json({error:"Routes used by trips cannot be changed."},409);
  if(body.stops!==undefined&&(!Array.isArray(body.stops)||body.stops.length<2||body.stops.length>50||body.stops.some((stop)=>typeof stop?.name!=="string"||stop.name.trim().length<2||stop.name.length>100||!Number.isFinite(Number(stop.latitude))||Math.abs(Number(stop.latitude))>90||!Number.isFinite(Number(stop.longitude))||Math.abs(Number(stop.longitude))>180)))return json({error:"Every stop needs a name and valid coordinates."},400);
  try{const result=await db.transaction(async(tx)=>{const changed=await tx.run("UPDATE routes SET route_name=?,source=?,destination=? WHERE id=?",[name,source,destination,routeId]);if(!changed.changes)return 0;if(body.stops){await tx.run("DELETE FROM stops WHERE route_id=?",[routeId]);for(const [index,stop] of body.stops.entries())await tx.run("INSERT INTO stops(route_id,stop_name,latitude,longitude,stop_order) VALUES(?,?,?,?,?)",[routeId,stop.name.trim(),Number(stop.latitude),Number(stop.longitude),index+1]);}return changed.changes;});return result?json({ok:true}):json({error:"Route not found."},404);}catch(error){return json({error:safeError(error)},409);}
}
export async function DELETE(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {routeId}=await params;if((await db.get("SELECT 1 FROM trips WHERE route_id=?", [routeId])))return json({error:"Remove or reassign this route’s trips first."},409);
  const result=(await db.run("DELETE FROM routes WHERE id=?", [routeId]));return result.changes?json({ok:true}):json({error:"Route not found."},404);
}
