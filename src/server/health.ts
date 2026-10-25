import type { Services } from "./services";
import { logServerError } from "./setup";

// GET /api/health, for the keep-warm job and anyone checking the site is up: { ok: true, db: true } after one
// trivial database read (and the hourly sandbox clean-up). No secrets, no counts, no child data, never cached.
// If anything fails the answer is 503 { ok: false }: the cause goes to the server log only.

const NO_STORE = { "Cache-Control": "no-store" };

export async function healthResponse(getServices: () => Promise<Services>): Promise<Response> {
  try {
    await (await getServices()).health();
    return Response.json({ ok: true, db: true }, { headers: NO_STORE });
  } catch (e) {
    logServerError("health check", e);
    return Response.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
