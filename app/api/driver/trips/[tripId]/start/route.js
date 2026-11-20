import db from "../../../../../../lib/db.js";
import { requireUser } from "../../../../../../lib/auth.js";
import { json, sameOrigin } from "../../../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function POST(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=requireUser(request,["driver"]);if(auth.error)return json({error:auth.error},auth.status);
  const {tripId}=await params;
  const result=db.transaction(()=>{
    const trip=db.prepare("SELECT status FROM trips WHERE id=? AND driver_id=?").get(tripId,auth.user.id);
    if(!trip)return {status:404,error:"This trip is not assigned to your account."};
    if(trip.status==="active")return {status:200,tripId};
    if(trip.status!=="scheduled")return {status:409,error:"This trip can no longer be started."};
    if(db.prepare("SELECT 1 FROM trips WHERE driver_id=? AND status='active'").get(auth.user.id))return {status:409,error:"End your active trip before starting another."};
    db.prepare("UPDATE trips SET status='active' WHERE id=?").run(tripId);return {status:200,tripId};
  }).immediate();
  return result.error?json({error:result.error},result.status):json({ok:true,tripId});
}
