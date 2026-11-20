import db from "../../../lib/db.js";
import { requireUser } from "../../../lib/auth.js";
import { json,readJson,sameOrigin,safeError } from "../../../lib/http.js";

export const dynamic="force-dynamic";
export function GET(request){
  const routes=db.prepare("SELECT r.id,r.route_name,r.source,r.destination,COUNT(s.id) AS stop_count FROM routes r LEFT JOIN stops s ON s.route_id=r.id GROUP BY r.id ORDER BY r.source,r.destination").all();
  const stops=db.prepare("SELECT stop_name,latitude,longitude,stop_order FROM stops WHERE route_id=? ORDER BY stop_order");
  return json({routes:routes.map((route)=>({...route,stops:stops.all(route.id)}))});
}
export async function POST(request){
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  const auth=requireUser(request,["admin"]);if(auth.error)return json({error:auth.error},auth.status);
  const body=await readJson(request);const name=String(body?.name||"").trim(),source=String(body?.source||"").trim(),destination=String(body?.destination||"").trim(),stops=body?.stops;
  if(name.length<2||name.length>100||source.length<2||source.length>80||destination.length<2||destination.length>80||source===destination||!Array.isArray(stops)||stops.length<2||stops.length>50)return json({error:"Enter a route name, different endpoints, and at least two stops."},400);
  if(stops.some((stop)=>typeof stop?.name!=="string"||stop.name.trim().length<2||stop.name.length>100||!Number.isFinite(Number(stop.latitude))||Math.abs(Number(stop.latitude))>90||!Number.isFinite(Number(stop.longitude))||Math.abs(Number(stop.longitude))>180))return json({error:"Every stop needs a name and valid coordinates."},400);
  try{
    const id=db.transaction(()=>{
      const result=db.prepare("INSERT INTO routes(route_name,source,destination) VALUES(?,?,?)").run(name,source,destination);const insert=db.prepare("INSERT INTO stops(route_id,stop_name,latitude,longitude,stop_order) VALUES(?,?,?,?,?)");
      stops.forEach((stop,index)=>insert.run(result.lastInsertRowid,stop.name.trim(),Number(stop.latitude),Number(stop.longitude),index+1));return Number(result.lastInsertRowid);
    }).immediate();
    return json({id},201);
  }catch(error){return json({error:safeError(error)},409);}
}
