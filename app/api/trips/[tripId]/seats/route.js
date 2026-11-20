import { getSessionUser } from "../../../../../lib/auth.js";
import { json } from "../../../../../lib/http.js";
import { seatsForTrip } from "../../../../../lib/trips.js";

export const dynamic = "force-dynamic";
export async function GET(request,{params}) {
  const {tripId}=await params; const seats=seatsForTrip(tripId,getSessionUser(request)?.id); if(!seats) return json({error:"Trip not found."},404);
  return json({seats,holdMinutes:10});
}
