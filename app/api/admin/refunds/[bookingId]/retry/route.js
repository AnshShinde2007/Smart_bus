import db from "../../../../../../lib/db.js";
import { requireUser } from "../../../../../../lib/auth.js";
import { json,sameOrigin } from "../../../../../../lib/http.js";
import { refundLatePayment } from "../../../../../../lib/payments.js";

export const dynamic="force-dynamic";
export async function POST(request,{params}){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);const auth=requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const {bookingId}=await params;const payment=db.prepare("SELECT provider_order_id,status FROM payments WHERE booking_id=?").get(bookingId);
  if(!payment||payment.status!=="refund_pending")return json({error:"No pending refund was found."},404);
  try{await refundLatePayment(payment.provider_order_id,bookingId);return json({ok:true});}catch{return json({error:"Refund provider is still unavailable. Retry later."},502);}
}
