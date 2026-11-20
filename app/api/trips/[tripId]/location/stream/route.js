import db from "../../../../../../lib/db.js";
import { json } from "../../../../../../lib/http.js";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request,{params}) {
  const {tripId}=await params;
  if(!(await db.get("SELECT 1 FROM trips WHERE id=?", [tripId]))) return json({error:"Trip not found."},404);
  const encoder=new TextEncoder(); let timer;
  const stream=new ReadableStream({
    start(controller) {
      let lastId=0,sending=false;
      const send=async()=>{
        if(sending||request.signal.aborted)return;sending=true;
        try{
          const trip=await db.get("SELECT status FROM trips WHERE id=?",[tripId]);
          const location=trip?.status==="active"?await db.get("SELECT id,latitude,longitude,accuracy,recorded_at FROM location_updates WHERE trip_id=? AND id>? ORDER BY id DESC LIMIT 1",[tripId,lastId]):null;
          if(request.signal.aborted)return;
          if(location){lastId=location.id;controller.enqueue(encoder.encode(`data: ${JSON.stringify({location})}\n\n`));}
          else controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
          if(trip?.status!=="active")controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({status:trip?.status||"missing"})}\n\n`));
        }catch(error){clearInterval(timer);try{controller.error(error);}catch{}}
        finally{sending=false;}
      };
      void send(); timer=setInterval(()=>void send(),3000);
      request.signal.addEventListener("abort",()=>{clearInterval(timer);try{controller.close();}catch{}},{once:true});
    },
    cancel(){clearInterval(timer);}
  });
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"}});
}
