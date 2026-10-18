import Link from "next/link";
import { t } from "@/i18n";
import { Shishya } from "./_components/Shishya";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <Shishya mood="happy" size={180} />
      <h1 className="text-3xl font-extrabold">{t("home.title")}</h1>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
        <Link href="/s" className="btn btn-primary flex-1 text-2xl min-h-20">
          {t("home.student")}
        </Link>
        <Link href="/teacher" className="btn flex-1 text-2xl min-h-20">
          {t("home.teacher")}
        </Link>
      </div>
      <p className="text-gray-700">{t("app.isProgram")}</p>
    </div>
  );
}
