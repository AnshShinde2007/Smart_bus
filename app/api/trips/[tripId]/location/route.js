import db from "../../../../../lib/db.js";
import { requireUser } from "../../../../../lib/auth.js";
import { json } from "../../../../../lib/http.js";

export const dynamic = "force-dynamic";
export async function GET(request,{params}) {
  const auth=requireUser(request); if(auth.error) return json({error:auth.error},auth.status);
  const {tripId}=await params; const trip=db.prepare("SELECT status FROM trips WHERE id=?").get(tripId);
  if(!trip) return json({error:"Trip not found."},404);
  if(trip.status!=="active") return json({location:null,stale:true});
  const location=db.prepare("SELECT latitude,longitude,accuracy,recorded_at FROM location_updates WHERE trip_id=? ORDER BY id DESC LIMIT 1").get(tripId);
  const stale=!location||Date.now()-Date.parse(location.recorded_at)>120000;
  return json({location:stale?null:location,stale});
}
