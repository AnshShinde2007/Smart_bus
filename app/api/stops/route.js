import db from "../../../lib/db.js";
import { requireUser } from "../../../lib/auth.js";
import { json } from "../../../lib/http.js";

export const dynamic="force-dynamic";
export function GET(request){const auth=requireUser(request);if(auth.error)return json({error:auth.error},auth.status);return json({stops:db.prepare("SELECT s.id,s.stop_name,s.latitude,s.longitude,s.stop_order,r.route_name FROM stops s JOIN routes r ON r.id=s.route_id ORDER BY r.id,s.stop_order").all()});}
