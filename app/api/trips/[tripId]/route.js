import { json } from "../../../../lib/http.js";
import { getTrip } from "../../../../lib/trips.js";

export const dynamic = "force-dynamic";
export async function GET(_request,{params}) {
  const {tripId}=await params; const trip=await getTrip(tripId); if(!trip) return json({error:"Trip not found."},404);
  const {driver_id,driver_name,bus_id,...publicTrip}=trip;
  return json({trip:{...publicTrip,fare:trip.fare_paise/100}});
}
