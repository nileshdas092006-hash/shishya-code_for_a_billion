import { connection } from "next/server";
import { impactResponse } from "@/server/impact-route";
import { getServices } from "@/server/instance";

// GET /api/impact: the Shishya Challenge's numbers as JSON (the same as the /impact page; real challenge classes
// only, no student data). Cached publicly for a minute.

export async function GET() {
  await connection(); // read at request time, never prerendered at build
  return impactResponse(getServices);
}
