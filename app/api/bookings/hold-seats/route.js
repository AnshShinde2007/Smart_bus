import { randomBytes } from "node:crypto";
import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../../lib/http.js";
import { getTrip } from "../../../../lib/trips.js";
import { dateInAppZone } from "../../../../lib/dates.js";

export const dynamic="force-dynamic";
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=requireUser(request,["passenger"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const tripId=String(body?.tripId||"");const seats=Array.isArray(body?.seats)?body.seats:[];
  const passengerName=String(body?.passengerName||"").trim();const passengerPhone=String(body?.passengerPhone||"").trim();
  if(!tripId||seats.length<1||seats.length>6||new Set(seats).size!==seats.length||seats.some((seat)=>!/^A(?:0[1-9]|[1-9]\d)$/.test(seat))||passengerName.length<2||passengerName.length>80||!/^\+?[\d ()-]{8,24}$/.test(passengerPhone))return json({error:"Choose 1–6 valid seats and enter passenger name and phone."},400);
  const trip=getTrip(tripId);if(!trip||trip.status!=="scheduled"||trip.journey_date<dateInAppZone())return json({error:"This trip is not available for booking."},409);
  if(seats.some((seat)=>Number(seat.slice(1))>trip.capacity))return json({error:"One or more selected seats are outside this bus’s capacity."},400);
  const holdToken=randomBytes(32).toString("base64url");const expiresAt=Date.now()+10*60*1000;
  const hold=db.transaction(()=>{
    db.prepare("DELETE FROM seat_holds WHERE expires_at<=?").run(Date.now());
    const booked=new Set(db.prepare("SELECT seat_number FROM booking_seats WHERE trip_id=?").all(tripId).map((row)=>row.seat_number));
    const held=new Set(db.prepare("SELECT seat_number FROM seat_holds WHERE trip_id=? AND user_id<>?").all(tripId,auth.user.id).map((row)=>row.seat_number));
    if(seats.some((seat)=>booked.has(seat)||held.has(seat)))return false;
    const upsert=db.prepare("INSERT INTO seat_holds(trip_id,seat_number,user_id,hold_token,expires_at) VALUES(?,?,?,?,?) ON CONFLICT(trip_id,seat_number) DO UPDATE SET user_id=excluded.user_id,hold_token=excluded.hold_token,expires_at=excluded.expires_at WHERE seat_holds.user_id=excluded.user_id");
    for(const seat of seats){const result=upsert.run(tripId,seat,auth.user.id,holdToken,expiresAt);if(!result.changes)throw new Error("seat-conflict");}
    return true;
  }).immediate();
  if(!hold)return json({error:"One or more selected seats are no longer available."},409);
  return json({holdToken,expiresAt,tripId,seats,fare:trip.fare_paise/100,total:trip.fare_paise/100*seats.length,holdMinutes:10});
}
