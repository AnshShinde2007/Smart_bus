import db from "../../../../../../lib/db.js";
import { requireUser } from "../../../../../../lib/auth.js";
import { json,sameOrigin } from "../../../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function POST(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=requireUser(request,["driver"]);if(auth.error)return json({error:auth.error},auth.status);
  const {tripId}=await params;
  const result=db.prepare("UPDATE trips SET status='completed' WHERE id=? AND driver_id=? AND status='active'").run(tripId,auth.user.id);
  return result.changes?json({ok:true}):json({error:"No active assigned trip was found."},404);
}
