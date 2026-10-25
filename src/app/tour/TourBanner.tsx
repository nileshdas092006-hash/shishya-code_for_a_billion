import Link from "next/link";
import { t, type MessageKey } from "@/i18n";
import { TOUR_JUDGE_CODE, TOUR_STOPS } from "@/server/tour";

// The small sticky banner on every Judge Tour stop: where you are, that the class is made up, Back / Next, and a
// switch between the child's and the teacher's side. Plain links, so it works before the page is ready.

const TEACHER_STOP = 5;

export function TourBanner({ stop }: { stop: number }) {
  const teacherSide = stop >= TEACHER_STOP;
  return (
    <nav
      aria-label={t("tour.banner", { n: stop })}
      className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-amber-100 border-b-2 border-amber-700 flex flex-col gap-2 no-print"
    >
      <p className="text-sm font-bold">{t("tour.banner", { n: stop })}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {stop > 1 && (
          <Link href={`/tour/${stop - 1}`} className="btn min-h-0 py-1 px-3">
            {t("tour.back")}
          </Link>
        )}
        {stop < TOUR_STOPS && (
          <Link href={`/tour/${stop + 1}`} className="btn btn-primary min-h-0 py-1 px-3">
            {t("tour.next")}
          </Link>
        )}
        <Link href={teacherSide ? "/tour/1" : `/tour/${TEACHER_STOP}`} className="underline">
          {t(teacherSide ? "tour.toChild" : "tour.toTeacher")}
        </Link>
      </div>
      <p className="text-sm">
        <strong>{t(`tour.stop.${stop}` as MessageKey)}:</strong> {t(`tour.tip.${stop}` as MessageKey, { code: TOUR_JUDGE_CODE })}
      </p>
    </nav>
  );
}
