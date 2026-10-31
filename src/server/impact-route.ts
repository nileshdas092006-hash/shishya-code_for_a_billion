import type { Services } from "./services";
import { logServerError } from "./setup";

/**
 * GET /api/impact: the same numbers as the /impact page, as JSON (for the hackathon submission). Real challenge
 * classes only, no student data. Cached publicly for a minute; 503 { ok: false } (cause in the server log only)
 * if the database cannot be read.
 */
export async function impactResponse(getServices: () => Promise<Services>): Promise<Response> {
  try {
    const body = await (await getServices()).impact();
    return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    logServerError("impact", e);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
