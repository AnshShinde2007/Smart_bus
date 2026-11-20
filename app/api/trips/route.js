import db from "../../../lib/db.js";
import { json } from "../../../lib/http.js";
import { listTrips } from "../../../lib/trips.js";
import { isDateOnly } from "../../../lib/dates.js";

export const dynamic = "force-dynamic";
export function GET(request) {
  const params=new URL(request.url).searchParams; const from=(params.get("from")||"").trim(); const to=(params.get("to")||"").trim(); const date=params.get("date")||"";
  if(from.length>80||to.length>80||date&&!isDateOnly(date)) return json({error:"Enter a valid route and journey date."},400);
  const trips=listTrips({from,to,date}).map((trip)=>{
    const stopCount=db.prepare("SELECT COUNT(*) AS n FROM stops WHERE route_id=?").get(trip.route_id).n;
    const booked=db.prepare("SELECT COUNT(*) AS n FROM booking_seats WHERE trip_id=?").get(trip.id).n;
    const held=db.prepare("SELECT COUNT(*) AS n FROM seat_holds WHERE trip_id=? AND expires_at>?").get(trip.id,Date.now()).n;
    const remaining=trip.capacity-booked-held;
    const location=db.prepare("SELECT latitude,longitude,accuracy,recorded_at FROM location_updates WHERE trip_id=? ORDER BY id DESC LIMIT 1").get(trip.id);
    return {...trip,fare:trip.fare_paise/100,remainingSeats:remaining,stopCount,location:location&&Date.now()-Date.parse(location.recorded_at)<=120000?location:null};
  });
  return json({trips:trips.map(({driver_id,driver_name,bus_id,...trip})=>trip)});
}
