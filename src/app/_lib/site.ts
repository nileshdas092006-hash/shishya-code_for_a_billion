import { headers } from "next/headers";

// The address this request came to, for links people share (a challenge's join link). Server-side only.

/** e.g. https://shishya-codeforabillion.vercel.app (http only for a laptop on localhost). */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https");
  return `${proto === "http" && !local ? "https" : proto}://${host}`;
}

export const joinLink = (origin: string, token: string) => `${origin}/join/${token}`;
