import { randomBytes } from "node:crypto";
import db from "../../../lib/db.js";
import { requireUser } from "../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../lib/http.js";

export const dynamic="force-dynamic";
export async function GET(request){
  const auth=requireUser(request,["passenger","admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const query="SELECT b.*,p.status AS payment_status,t.journey_date,t.departure_time,r.source,r.destination,bu.registration_number AS bus FROM bookings b LEFT JOIN payments p ON p.booking_id=b.id JOIN trips t ON t.id=b.trip_id JOIN routes r ON r.id=t.route_id JOIN buses bu ON bu.id=t.bus_id";
  const rows=auth.user.role==="admin"?db.prepare(`${query} ORDER BY b.created_at DESC`).all():db.prepare(`${query} WHERE b.user_id=? ORDER BY b.created_at DESC`).all(auth.user.id);
  const bookings=rows.map(({hold_token,...row})=>({...row,seats:row.status==="confirmed"?db.prepare("SELECT seat_number FROM booking_seats WHERE booking_id=? ORDER BY seat_number").all(row.id).map((seat)=>seat.seat_number):db.prepare("SELECT seat_number FROM seat_holds WHERE hold_token=? AND expires_at>? ORDER BY seat_number").all(hold_token,Date.now()).map((seat)=>seat.seat_number)}));
  return json({bookings});
}
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=requireUser(request,["passenger"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const holdToken=String(body?.holdToken||"");if(holdToken.length<32||holdToken.length>64)return json({error:"Your seat hold expired. Select seats again."},400);
  const passengerName=String(body?.passengerName||"").trim(),passengerPhone=String(body?.passengerPhone||"").trim();
  if(passengerName.length<2||passengerName.length>80||!/^\+?[\d ()-]{8,24}$/.test(passengerPhone))return json({error:"Enter a valid passenger name and phone."},400);
  const result=db.transaction(()=>{
    const holds=db.prepare("SELECT h.trip_id,h.seat_number,t.fare_paise,t.journey_date FROM seat_holds h JOIN trips t ON t.id=h.trip_id WHERE h.hold_token=? AND h.user_id=? AND h.expires_at>? ORDER BY h.seat_number").all(holdToken,auth.user.id,Date.now());
    if(!holds.length)return null;
    const tripId=holds[0].trip_id;if(holds.some((hold)=>hold.trip_id!==tripId))return null;
    const pending=db.prepare("SELECT id FROM bookings WHERE user_id=? AND trip_id=? AND hold_token=? AND status='pending' LIMIT 1").get(auth.user.id,tripId,holdToken);
    if(pending)return {id:pending.id};
    const id=randomBytes(16).toString("hex");const reference=`SB${randomBytes(5).toString("hex").toUpperCase()}`;const total=holds[0].fare_paise*holds.length;
    db.prepare("INSERT INTO bookings(id,user_id,trip_id,reference,passenger_name,passenger_phone,hold_token,total_paise,status,created_at) VALUES(?,?,?,?,?,?,?,?,'pending',?)").run(id,auth.user.id,tripId,reference,passengerName,passengerPhone,holdToken,total,new Date().toISOString());
    const insertItem=db.prepare("INSERT INTO booking_items(booking_id,trip_id,seat_number) VALUES(?,?,?)");for(const hold of holds)insertItem.run(id,tripId,hold.seat_number);
    return {id,reference,totalPaise:total};
  }).immediate();
  if(!result)return json({error:"Your seat hold expired. Select seats again."},409);
  return json({booking:result},201);
}
