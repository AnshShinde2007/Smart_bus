import db from "../../../../../lib/db.js";
import { requireUser } from "../../../../../lib/auth.js";
import { json,sameOrigin } from "../../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function DELETE(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {driverId}=await params;if(db.prepare("SELECT 1 FROM trips WHERE driver_id=?").get(driverId))return json({error:"Reassign or remove this driver’s trips first."},409);
  const result=db.prepare("DELETE FROM users WHERE id=? AND role='driver'").run(driverId);return result.changes?json({ok:true}):json({error:"Driver not found."},404);
}
