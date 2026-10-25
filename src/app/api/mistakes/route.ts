import { connection } from "next/server";
import { getServices } from "@/server/instance";
import { mistakesResponse } from "@/server/open-mistakes";

// GET /api/mistakes: the open mistake library (authored and teacher-approved mined mistakes, as specs; MIT;
// see docs/SKILL_SPEC.md). No child data. Cached for 5 minutes.

export async function GET() {
  await connection(); // read at request time (approved mistakes change), never prerendered at build
  return mistakesResponse(getServices);
}
