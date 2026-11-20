import { getSessionUser } from "../../../../lib/auth.js";
import { json } from "../../../../lib/http.js";

export const dynamic = "force-dynamic";
export function GET(request) { return json({ user: getSessionUser(request) }); }
