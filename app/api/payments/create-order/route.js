import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../../lib/http.js";
import { makeDummyOrder } from "../../../../lib/payments.js";

export const dynamic="force-dynamic";
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=await requireUser(request,["passenger"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const bookingId=String(body?.bookingId||"");
  const booking=(await db.get("SELECT * FROM bookings WHERE id=? AND user_id=? AND status='pending'", [bookingId, auth.user.id]));
  if(!booking)return json({error:"Pending booking not found."},404);
  const held=(await db.get("SELECT COUNT(*) AS n FROM seat_holds WHERE hold_token=? AND user_id=? AND expires_at>?", [booking.hold_token, auth.user.id, Date.now()])).n;
  const items=(await db.get("SELECT COUNT(*) AS n FROM booking_items WHERE booking_id=?", [booking.id])).n;
  if(held!==items||items===0)return json({error:"Your seat hold expired. Select seats again."},409);
  const existing=(await db.get("SELECT provider_order_id,status FROM payments WHERE booking_id=?", [booking.id]));
  if(existing?.status==="paid")return json({error:"This booking has already been paid."},409);
  const orderId=existing&&/^(dummy_|demo_)/.test(existing.provider_order_id)?existing.provider_order_id:makeDummyOrder();
  if(!existing)(await db.run("INSERT INTO payments(booking_id,provider_order_id,amount_paise,status,updated_at) VALUES(?,?,?,'created',?)", [booking.id, orderId, booking.total_paise, new Date().toISOString()]));
  else if(orderId!==existing.provider_order_id)(await db.run("UPDATE payments SET provider_order_id=?,provider_payment_id=NULL,status='created',updated_at=? WHERE booking_id=?", [orderId, new Date().toISOString(), booking.id]));
  return json({orderId,amount:booking.total_paise,currency:"INR",gateway:"dummy"});
}
