import db from "../../../../../lib/db.js";
import { requireUser } from "../../../../../lib/auth.js";
import { json,readJson,sameOrigin,safeError } from "../../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function PATCH(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {busId}=await params,body=await readJson(request);const registration=String(body?.registrationNumber||"").trim().toUpperCase(),name=String(body?.name||"").trim(),type=String(body?.type||"").trim(),capacity=Number(body?.capacity);
  if(!/^[A-Z0-9 -]{4,16}$/.test(registration)||name.length<2||name.length>80||type.length<2||type.length>50||!Number.isInteger(capacity)||capacity<1||capacity>100)return json({error:"Enter valid bus details."},400);
  const used=(await db.get("SELECT MAX(CAST(SUBSTR(seat_number,2) AS INTEGER)) AS max_seat FROM (SELECT bs.seat_number FROM booking_seats bs JOIN trips t ON t.id=bs.trip_id WHERE t.bus_id=? UNION ALL SELECT h.seat_number FROM seat_holds h JOIN trips t ON t.id=h.trip_id WHERE t.bus_id=? AND h.expires_at>?)", [busId, busId, Date.now()])).max_seat||0;
  if(capacity<used)return json({error:"Capacity cannot be reduced below seats already booked."},409);
  try{const result=(await db.run("UPDATE buses SET registration_number=?,bus_name=?,capacity=?,bus_type=? WHERE id=?", [registration, name, capacity, type, busId]));return result.changes?json({ok:true}):json({error:"Bus not found."},404);}catch(error){return json({error:safeError(error)},409);}
}
export async function DELETE(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {busId}=await params;if((await db.get("SELECT 1 FROM trips WHERE bus_id=?", [busId])))return json({error:"Reassign or remove this bus’s trips first."},409);
  const result=(await db.run("DELETE FROM buses WHERE id=?", [busId]));return result.changes?json({ok:true}):json({error:"Bus not found."},404);
}
