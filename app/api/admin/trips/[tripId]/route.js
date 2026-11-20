import db from "../../../../../lib/db.js";
import { requireUser } from "../../../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../../../lib/http.js";
import { hasScheduleConflict } from "../../../../../lib/trips.js";

export const dynamic="force-dynamic";
export async function PATCH(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {tripId}=await params,body=await readJson(request);const fare=Number(body?.fare),departure=String(body?.departure||""),arrival=String(body?.arrival||""),driverId=body?.driverId?Number(body.driverId):null;
  if(!Number.isInteger(fare)||fare<1||fare>50000||!/^([01]\d|2[0-3]):[0-5]\d$/.test(departure)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrival)||departure===arrival||driverId!==null&&!Number.isInteger(driverId)||driverId&&!(await db.get("SELECT 1 FROM users WHERE id=? AND role='driver'", [driverId])))return json({error:"Enter valid fare, times, and driver assignment."},400);
  if((await db.get("SELECT 1 FROM bookings WHERE trip_id=?", [tripId])))return json({error:"Trips with bookings cannot be changed."},409);
  const current=(await db.get("SELECT bus_id,journey_date FROM trips WHERE id=? AND status='scheduled'", [tripId]));
  if(!current)return json({error:"Only scheduled trips can be updated."},409);
  if(await hasScheduleConflict({date:current.journey_date,departure,arrival,busId:current.bus_id,driverId,excludeId:tripId}))return json({error:"That bus or driver already has an overlapping trip."},409);
  const result=(await db.run("UPDATE trips SET fare_paise=?,departure_time=?,arrival_time=?,driver_id=? WHERE id=? AND status='scheduled'", [fare*100, departure, arrival, driverId, tripId]));
  return result.changes?json({ok:true}):json({error:"Only scheduled trips can be updated."},409);
}
export async function DELETE(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {tripId}=await params;if((await db.get("SELECT 1 FROM bookings WHERE trip_id=?", [tripId])))return json({error:"Trips with bookings cannot be removed."},409);
  const result=(await db.run("DELETE FROM trips WHERE id=? AND status='scheduled'", [tripId]));return result.changes?json({ok:true}):json({error:"Only unbooked scheduled trips can be removed."},409);
}
