import { requireUser } from "../../../../lib/auth.js";
import { json } from "../../../../lib/http.js";
import { getTrip } from "../../../../lib/trips.js";

export const dynamic = "force-dynamic";
export async function GET(request,{params}) {
  const auth=requireUser(request); if(auth.error) return json({error:auth.error},auth.status);
  const {tripId}=await params; const trip=getTrip(tripId); if(!trip) return json({error:"Trip not found."},404);
  const {driver_id,driver_name,bus_id,...publicTrip}=trip;
  return json({trip:{...publicTrip,fare:trip.fare_paise/100}});
}
