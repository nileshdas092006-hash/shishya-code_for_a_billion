import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { t } from "@/i18n";
import { currentStudent } from "../_lib/auth";

// Every student screen says plainly that the Shishya is a computer program.
// A judge who follows a link out of the Judge Tour gets a way back to it.

export default function StudentLayout({ children }: LayoutProps<"/s">) {
  return (
    <div className="flex flex-col gap-6">
      <p role="note" className="msg-note text-center font-semibold no-print">
        {t("app.isProgram")}
      </p>
      <Suspense fallback={null}>
        <BackToTour />
      </Suspense>
      {children}
    </div>
  );
}

async function BackToTour() {
  try {
    const student = await currentStudent();
    if (student?.classKind !== "sandbox") return null;
  } catch (e) {
    unstable_rethrow(e); // Next.js's own signals (e.g. while prerendering) must go through
    return null; // a missing setting is shown by the page itself
  }
  return (
    <Link href="/tour/1" className="btn self-start no-print">
      {t("tour.return")}
    </Link>
  );
}
