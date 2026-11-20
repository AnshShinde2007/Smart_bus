import { randomBytes } from "node:crypto";
import db from "./db.js";

export function settlePayment(orderId,paymentId){
  return db.transaction(()=>{
    const payment=db.prepare("SELECT * FROM payments WHERE provider_order_id=?").get(orderId);
    if(!payment)return {error:"Payment order not found.",status:404};
    if(payment.status==="paid")return {ok:true,alreadyPaid:true,bookingId:payment.booking_id};
    const booking=db.prepare("SELECT * FROM bookings WHERE id=?").get(payment.booking_id);
    if(!booking||booking.status!=="pending")return {error:"Booking is no longer pending.",status:409};
    const items=db.prepare("SELECT seat_number FROM booking_items WHERE booking_id=? ORDER BY seat_number").all(booking.id).map((item)=>item.seat_number);
    const held=db.prepare("SELECT seat_number FROM seat_holds WHERE hold_token=? AND user_id=? AND trip_id=? AND expires_at>? ORDER BY seat_number").all(booking.hold_token,booking.user_id,booking.trip_id,Date.now()).map((item)=>item.seat_number);
    const booked=new Set(db.prepare("SELECT seat_number FROM booking_seats WHERE trip_id=?").all(booking.trip_id).map((item)=>item.seat_number));
    const otherHolds=new Set(db.prepare("SELECT seat_number FROM seat_holds WHERE trip_id=? AND user_id<>? AND expires_at>?").all(booking.trip_id,booking.user_id,Date.now()).map((item)=>item.seat_number));
    if(!items.length||items.length!==held.length||items.some((seat)=>booked.has(seat)||otherHolds.has(seat))) {
      db.prepare("UPDATE payments SET provider_payment_id=?,status='refund_pending',updated_at=? WHERE id=?").run(paymentId,new Date().toISOString(),payment.id);
      db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(booking.id);
      db.prepare("DELETE FROM seat_holds WHERE hold_token=?").run(booking.hold_token);
      return {refundRequired:true,bookingId:booking.id,paymentId,reference:booking.reference};
    }
    const insert=db.prepare("INSERT INTO booking_seats(trip_id,seat_number,booking_id) VALUES(?,?,?)");for(const seat of items)insert.run(booking.trip_id,seat,booking.id);
    db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(booking.id);
    db.prepare("UPDATE payments SET provider_payment_id=?,status='paid',updated_at=? WHERE id=?").run(paymentId,new Date().toISOString(),payment.id);
    db.prepare("DELETE FROM seat_holds WHERE hold_token=?").run(booking.hold_token);
    return {ok:true,bookingId:booking.id,reference:booking.reference};
  }).immediate();
}

export function refundLatePayment(orderId,bookingId){
  const payment=db.prepare("SELECT provider_order_id FROM payments WHERE booking_id=?").get(bookingId);
  if(!payment||payment.provider_order_id!==orderId)throw new Error("Payment order not found.");
  db.prepare("UPDATE payments SET status='refunded',updated_at=? WHERE booking_id=?").run(new Date().toISOString(),bookingId);
  return true;
}

export const makeDummyOrder=()=>`dummy_${randomBytes(16).toString("hex")}`;
