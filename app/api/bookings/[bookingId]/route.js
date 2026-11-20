import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json } from "../../../../lib/http.js";

export const dynamic="force-dynamic";
export async function GET(request,{params}){
  const auth=requireUser(request);if(auth.error)return json({error:auth.error},auth.status);
  const {bookingId}=await params;
  const row=db.prepare("SELECT b.*,t.journey_date,t.departure_time,t.arrival_time,r.source,r.destination,bu.registration_number AS bus FROM bookings b JOIN trips t ON t.id=b.trip_id JOIN routes r ON r.id=t.route_id JOIN buses bu ON bu.id=t.bus_id WHERE b.id=?").get(bookingId);
  if(!row||row.user_id!==auth.user.id&&auth.user.role!=="admin")return json({error:"Booking not found."},404);
  const seats=db.prepare("SELECT seat_number FROM booking_seats WHERE booking_id=? ORDER BY seat_number").all(bookingId).map((item)=>item.seat_number);
  const payment=db.prepare("SELECT status FROM payments WHERE booking_id=?").get(bookingId);
  const {hold_token,...safeBooking}=row;
  return json({booking:{...safeBooking,seats,paymentStatus:payment?.status||"pending"}});
}
