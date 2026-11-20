import db from "../../../../../../lib/db.js";
import { json } from "../../../../../../lib/http.js";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request,{params}) {
  const {tripId}=await params;
  if(!db.prepare("SELECT 1 FROM trips WHERE id=?").get(tripId)) return json({error:"Trip not found."},404);
  const encoder=new TextEncoder(); let timer;
  const stream=new ReadableStream({
    start(controller) {
      let lastId=0;
      const send=()=>{
        if(request.signal.aborted) return;
        const trip=db.prepare("SELECT status FROM trips WHERE id=?").get(tripId);
        const location=trip?.status==="active"?db.prepare("SELECT id,latitude,longitude,accuracy,recorded_at FROM location_updates WHERE trip_id=? AND id>? ORDER BY id DESC LIMIT 1").get(tripId,lastId):null;
        if(location){lastId=location.id;controller.enqueue(encoder.encode(`data: ${JSON.stringify({location})}\n\n`));}
        else controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        if(trip?.status!=="active") controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({status:trip?.status||"missing"})}\n\n`));
      };
      send(); timer=setInterval(send,3000);
      request.signal.addEventListener("abort",()=>{clearInterval(timer);try{controller.close();}catch{}},{once:true});
    },
    cancel(){clearInterval(timer);}
  });
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"}});
}
