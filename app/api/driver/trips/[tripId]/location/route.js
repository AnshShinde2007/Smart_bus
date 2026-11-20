import db from "../../../../../../lib/db.js";
import { requireUser } from "../../../../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function POST(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=requireUser(request,["driver"]);if(auth.error)return json({error:auth.error},auth.status);
  const {tripId}=await params;const body=await readJson(request);
  const latitude=Number(body?.latitude),longitude=Number(body?.longitude),accuracy=Number(body?.accuracy);
  if(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180||!Number.isFinite(accuracy)||accuracy<0||accuracy>1000)return json({error:"Location coordinates or accuracy are invalid."},400);
  if(accuracy>250)return json({error:"GPS accuracy is too low. Move to a clearer location and try again."},422);
  const trip=db.prepare("SELECT 1 FROM trips WHERE id=? AND driver_id=? AND status='active'").get(tripId,auth.user.id);
  if(!trip)return json({error:"Location updates are accepted only for your active assigned trip."},403);
  const recordedAt=new Date().toISOString();
  db.prepare("INSERT INTO location_updates(trip_id,latitude,longitude,accuracy,recorded_at) VALUES(?,?,?,?,?)").run(tripId,latitude,longitude,accuracy,recordedAt);
  db.prepare("DELETE FROM location_updates WHERE recorded_at<?").run(new Date(Date.now()-30*24*60*60*1000).toISOString());
  return json({ok:true,recordedAt});
}
