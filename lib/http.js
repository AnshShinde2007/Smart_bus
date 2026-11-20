import { NextResponse } from "next/server";

export const json = (body,status=200) => NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestUrl = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.host).split(",")[0].trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || requestUrl.protocol.slice(0, -1);
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
export function safeError(error) {
  if (error?.code === "SQLITE_CONSTRAINT_UNIQUE" || error?.code === "23505") return "That value is already in use.";
  return "The request could not be completed.";
}
