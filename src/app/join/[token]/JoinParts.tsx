import { t } from "@/i18n";
import { CHALLENGE_GRADES } from "@/server/services";

// The parts of the join page that differ by pack (F12). The form itself stays in page.tsx, a plain server-action form.

/** What happens to a student's answers, in English and Hindi. The college notice has no line about parents. */
export function JoinNotice({ college }: { college: boolean }) {
  const key = college ? "join.notice.college" : "join.notice";
  return (
    <section className="card flex flex-col gap-3">
      <p className="text-lg">{t(key)}</p>
      <p lang="hi" className="text-lg">
        {t(key, undefined, "hi")}
      </p>
    </section>
  );
}

/** "Which class are you in?": a school challenge only. */
export function GradeChoice() {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-2xl font-bold">
        {t("join.grade")}{" "}
        <span lang="hi" className="block text-lg font-semibold">
          {t("join.grade", undefined, "hi")}
        </span>
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {CHALLENGE_GRADES.map((g) => (
          <label key={g} className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-gray-400 px-3 py-2 text-xl font-semibold">
            <input type="radio" name="grade" value={g} required className="h-6 w-6 shrink-0" />
            {t("join.gradeOption", { n: g })}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
