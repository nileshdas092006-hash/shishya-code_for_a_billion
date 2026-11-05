import { connection } from "next/server";
import { Suspense } from "react";
import { getServices } from "@/server/instance";
import { guardPage } from "../_lib/page-guard";
import { Loading } from "../_lib/student-pages";
import { ImpactView } from "./ImpactView";

// /impact: the Shishya Challenge's public numbers (F11), worked out at request time by the pure, tested
// computeImpact from REAL challenge classes only, with the school and college packs in separate blocks (F12). No
// student data: no codes, no names, no single student's result (any average over fewer than 5 students is not
// shown). The same numbers are at /api/impact as JSON.

export default function ImpactPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ImpactNumbers />
    </Suspense>
  );
}

function ImpactNumbers() {
  return guardPage("student", async () => {
    await connection(); // always at request time: the numbers change as students take part
    return <ImpactView impact={await (await getServices()).impact()} />;
  });
}
