import db from "../../../../lib/db.js";
import { requireUser } from "../../../../lib/auth.js";
import { json,readJson,sameOrigin } from "../../../../lib/http.js";
import { refundLatePayment,settlePayment } from "../../../../lib/payments.js";

export const dynamic="force-dynamic";
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=requireUser(request,["passenger"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const orderId=String(body?.orderId||"");
  const row=db.prepare("SELECT p.*,b.user_id FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE p.provider_order_id=?").get(orderId);
  if(!row||row.user_id!==auth.user.id||!/^(dummy_|demo_)/.test(orderId))return json({error:"Dummy payment order not found."},404);
  if(row.status==="paid")return json({ok:true,bookingId:row.booking_id});
  const paymentId=`dummy_${row.booking_id}`;
  if(row.status==="refund_pending"&&row.provider_payment_id===paymentId){
    refundLatePayment(orderId,row.booking_id);return json({ok:false,refundPending:false,message:"Dummy refund completed."},202);
  }
  const result=settlePayment(orderId,paymentId);
  if(result.refundRequired){refundLatePayment(orderId,result.bookingId);return json({error:"Your seat hold expired after payment. The dummy payment was refunded.",refund:true},409);}
  if(result.error)return json({error:result.error},result.status);
  return json({ok:true,bookingId:result.bookingId,reference:result.reference});
}
