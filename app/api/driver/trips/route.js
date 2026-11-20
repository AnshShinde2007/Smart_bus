import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json } from "../../../../lib/http.js";
import { TRIP_SELECT } from "../../../../lib/trips.js";

export const dynamic="force-dynamic";
export function GET(request){
  const auth=requireUser(request,["driver"]);if(auth.error)return json({error:auth.error},auth.status);
  const trips=db.prepare(`${TRIP_SELECT} WHERE t.driver_id=? AND t.status IN ('scheduled','active') ORDER BY t.journey_date,t.departure_time`).all(auth.user.id);
  return json({trips:trips.map((trip)=>({...trip,fare:trip.fare_paise/100}))});
}
