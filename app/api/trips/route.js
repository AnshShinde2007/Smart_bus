import db from "../../../lib/db.js";
import { json } from "../../../lib/http.js";
import { listTrips } from "../../../lib/trips.js";
import { isDateOnly } from "../../../lib/dates.js";

export const dynamic = "force-dynamic";
export async function GET(request) {
  const params=new URL(request.url).searchParams; const from=(params.get("from")||"").trim(); const to=(params.get("to")||"").trim(); const date=params.get("date")||"";
  if(from.length>80||to.length>80||date&&!isDateOnly(date)) return json({error:"Enter a valid route and journey date."},400);
  const trips=await listTrips({from,to,date});
  const results=await Promise.all(trips.map(async(trip)=>{
    const stopCount=(await db.get("SELECT COUNT(*) AS n FROM stops WHERE route_id=?", [trip.route_id])).n;
    const booked=(await db.get("SELECT COUNT(*) AS n FROM booking_seats WHERE trip_id=?", [trip.id])).n;
    const held=(await db.get("SELECT COUNT(*) AS n FROM seat_holds WHERE trip_id=? AND expires_at>?", [trip.id, Date.now()])).n;
    const remaining=trip.capacity-booked-held;
    const location=(await db.get("SELECT latitude,longitude,accuracy,recorded_at FROM location_updates WHERE trip_id=? ORDER BY id DESC LIMIT 1", [trip.id]));
    return {...trip,fare:trip.fare_paise/100,remainingSeats:remaining,stopCount,location:location&&Date.now()-Date.parse(location.recorded_at)<=120000?location:null};
  }));
  return json({trips:results.map(({driver_id,driver_name,bus_id,...trip})=>trip)});
}
