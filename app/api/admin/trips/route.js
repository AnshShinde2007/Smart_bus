import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../../lib/http.js";
import { TRIP_SELECT,hasScheduleConflict } from "../../../../lib/trips.js";
import { isDateOnly,dateInAppZone } from "../../../../lib/dates.js";

export const dynamic="force-dynamic";
export async function GET(request){const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);return json({trips:(await db.all(`${TRIP_SELECT} ORDER BY t.journey_date,t.departure_time`))});}
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=await requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const busId=Number(body?.busId),routeId=Number(body?.routeId),driverId=body?.driverId?Number(body.driverId):null,date=String(body?.date||""),departure=String(body?.departure||""),arrival=String(body?.arrival||""),fare=Number(body?.fare);
  if(!Number.isInteger(busId)||!Number.isInteger(routeId)||driverId!==null&&!Number.isInteger(driverId)||!isDateOnly(date)||date<dateInAppZone()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(departure)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrival)||departure===arrival||!Number.isInteger(fare)||fare<1||fare>50000)return json({error:"Enter valid bus, route, future date, times, and fare."},400);
  const bus=(await db.get("SELECT capacity FROM buses WHERE id=?", [busId])),route=(await db.get("SELECT id FROM routes WHERE id=?", [routeId])),driver=driverId?(await db.get("SELECT id FROM users WHERE id=? AND role='driver'", [driverId])):null;
  if(!bus||!route||driverId&&!driver)return json({error:"Choose an existing bus, route, and driver."},400);
  if(await hasScheduleConflict({date,departure,arrival,busId,driverId}))return json({error:"That bus or driver already has an overlapping trip."},409);
  const tripId=`SB-${crypto.randomUUID()}`;
  try{(await db.run("INSERT INTO trips(id,bus_id,driver_id,route_id,journey_date,departure_time,arrival_time,fare_paise,status) VALUES(?,?,?,?,?,?,?,?, 'scheduled')", [tripId, busId, driverId, routeId, date, departure, arrival, fare*100]));return json({tripId},201);}catch{return json({error:"Could not create the trip."},409);}
}
