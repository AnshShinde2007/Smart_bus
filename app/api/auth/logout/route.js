import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import db from "../../../../lib/db.js";
import { json, sameOrigin } from "../../../../lib/http.js";

export const dynamic = "force-dynamic";
export function POST(request) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  const token=request.cookies.get("smartbus_session")?.value;
  if(token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(createHash("sha256").update(token).digest("hex"));
  const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}}); response.cookies.set("smartbus_session","",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:0}); return response;
}
