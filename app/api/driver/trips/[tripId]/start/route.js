import db from "../../../../../../lib/db.js";
import { requireUser } from "../../../../../../lib/auth.js";
import { json, sameOrigin } from "../../../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function POST(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=await requireUser(request,["driver"]);if(auth.error)return json({error:auth.error},auth.status);
  const {tripId}=await params;
  let result;
  try{result=await db.transaction(async(tx)=>{
    const trip=await tx.get("SELECT status FROM trips WHERE id=? AND driver_id=?",[tripId,auth.user.id]);
    if(!trip)return {status:404,error:"This trip is not assigned to your account."};
    if(trip.status==="active")return {status:200,tripId};
    if(trip.status!=="scheduled")return {status:409,error:"This trip can no longer be started."};
    if(await tx.get("SELECT 1 FROM trips WHERE driver_id=? AND status='active'",[auth.user.id]))return {status:409,error:"End your active trip before starting another."};
    await tx.run("UPDATE trips SET status='active' WHERE id=?",[tripId]);return {status:200,tripId};
  });}catch(error){if(error?.code==="23505"||error?.code==="SQLITE_CONSTRAINT_UNIQUE")return json({error:"End your active trip before starting another."},409);throw error;}
  return result.error?json({error:result.error},result.status):json({ok:true,tripId});
}
