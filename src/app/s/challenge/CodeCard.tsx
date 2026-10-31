import { t } from "@/i18n";

/** "Your code is 8C-K7QM. Write it down: you need it to come back." with the class code, big enough for a phone. */
export function CodeCard({ code, classCode }: { code: string; classCode: string }) {
  return (
    <section className="card flex flex-col gap-2 border-blue-800" aria-label={t("challenge.yourCode")}>
      <p className="text-xl font-semibold">{t("challenge.yourCode")}</p>
      <p className="math text-5xl font-extrabold whitespace-nowrap">{code}</p>
      <p className="text-xl font-bold">{t("challenge.writeDown")}</p>
      <p className="text-lg">
        {t("challenge.classCode")} <strong className="math text-2xl whitespace-nowrap">{classCode}</strong>
      </p>
      <p className="text-base text-gray-700">{t("challenge.classCodeNote")}</p>
    </section>
  );
}
