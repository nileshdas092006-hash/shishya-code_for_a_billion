import Link from "next/link";
import { t } from "@/i18n";

// After "Delete this class and all its data": nothing about the class is left to show.

export default function ClassDeletedPage() {
  return (
    <section className="card flex flex-col gap-4" role="status">
      <h1 className="text-3xl font-extrabold">{t("delete.done.title")}</h1>
      <p className="text-xl">{t("delete.done.body")}</p>
      <Link href="/teacher" className="btn self-start">
        {t("delete.done.back")}
      </Link>
    </section>
  );
}
