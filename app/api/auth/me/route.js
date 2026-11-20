import { getSessionUser } from "../../../../lib/auth.js";
import { json } from "../../../../lib/http.js";

export const dynamic = "force-dynamic";
export async function GET(request) { return json({ user: await getSessionUser(request) }); }
