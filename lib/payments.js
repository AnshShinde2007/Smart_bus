import { randomBytes } from "node:crypto";
import db from "./db.js";

export async function settlePayment(orderId,paymentId){
  return db.transaction(async(tx)=>{
    const payment=await tx.get("SELECT * FROM payments WHERE provider_order_id=? FOR UPDATE",[orderId]);
    if(!payment)return {error:"Payment order not found.",status:404};
    if(payment.status==="paid")return {ok:true,alreadyPaid:true,bookingId:payment.booking_id};
    const booking=await tx.get("SELECT * FROM bookings WHERE id=?",[payment.booking_id]);
    if(!booking||booking.status!=="pending")return {error:"Booking is no longer pending.",status:409};
    const items=(await tx.all("SELECT seat_number FROM booking_items WHERE booking_id=? ORDER BY seat_number",[booking.id])).map((item)=>item.seat_number);
    const held=(await tx.all("SELECT seat_number FROM seat_holds WHERE hold_token=? AND user_id=? AND trip_id=? AND expires_at>? ORDER BY seat_number",[booking.hold_token,booking.user_id,booking.trip_id,Date.now()])).map((item)=>item.seat_number);
    const booked=new Set((await tx.all("SELECT seat_number FROM booking_seats WHERE trip_id=?",[booking.trip_id])).map((item)=>item.seat_number));
    const otherHolds=new Set((await tx.all("SELECT seat_number FROM seat_holds WHERE trip_id=? AND user_id<>? AND expires_at>?",[booking.trip_id,booking.user_id,Date.now()])).map((item)=>item.seat_number));
    if(!items.length||items.length!==held.length||items.some((seat)=>booked.has(seat)||otherHolds.has(seat))) {
      await tx.run("UPDATE payments SET provider_payment_id=?,status='refund_pending',updated_at=? WHERE id=?",[paymentId,new Date().toISOString(),payment.id]);
      await tx.run("UPDATE bookings SET status='cancelled' WHERE id=?",[booking.id]);
      await tx.run("DELETE FROM seat_holds WHERE hold_token=?",[booking.hold_token]);
      return {refundRequired:true,bookingId:booking.id,paymentId,reference:booking.reference};
    }
    for(const seat of items)await tx.run("INSERT INTO booking_seats(trip_id,seat_number,booking_id) VALUES(?,?,?)",[booking.trip_id,seat,booking.id]);
    await tx.run("UPDATE bookings SET status='confirmed' WHERE id=?",[booking.id]);
    await tx.run("UPDATE payments SET provider_payment_id=?,status='paid',updated_at=? WHERE id=?",[paymentId,new Date().toISOString(),payment.id]);
    await tx.run("DELETE FROM seat_holds WHERE hold_token=?",[booking.hold_token]);
    return {ok:true,bookingId:booking.id,reference:booking.reference};
  });
}

export async function refundLatePayment(orderId,bookingId){
  const payment=await db.get("SELECT provider_order_id FROM payments WHERE booking_id=?",[bookingId]);
  if(!payment||payment.provider_order_id!==orderId)throw new Error("Payment order not found.");
  await db.run("UPDATE payments SET status='refunded',updated_at=? WHERE booking_id=?",[new Date().toISOString(),bookingId]);
  return true;
}

export const makeDummyOrder=()=>`dummy_${randomBytes(16).toString("hex")}`;
