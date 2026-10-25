import { connection } from "next/server";
import { healthResponse } from "@/server/health";
import { getServices } from "@/server/instance";

// GET /api/health → { ok: true, db: true }, or 503 { ok: false }. Pinged every 10 minutes by
// .github/workflows/keep-warm.yml so the first child of the day does not wait for a cold start.

export async function GET() {
  await connection(); // always at request time, never prerendered at build
  return healthResponse(getServices);
}
