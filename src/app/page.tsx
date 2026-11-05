import Link from "next/link";
import { t } from "@/i18n";
import { Shishya } from "./_components/Shishya";
import { StartTourForm } from "./tour/StartTourForm";

export default function Home() {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-10">
      {/* on a phone the Shishya comes first; from md it sits on the right, without changing the reading order */}
      <div className="hero-panel flex h-56 items-end justify-center overflow-hidden md:order-2 md:h-[20rem]">
        <Shishya mood="happy" size={180} />
      </div>
      <div className="flex min-w-0 flex-col gap-6 md:order-1">
        <h1 className="home-title">{t("home.title")}</h1>
        <div className="flex flex-col gap-4 md:flex-row">
          <Link href="/s" className="btn btn-primary flex-1 text-2xl md:text-xl">
            {t("home.student")}
          </Link>
          <Link href="/teacher" className="btn flex-1 text-2xl md:text-xl">
            {t("home.teacher")}
          </Link>
        </div>
        <StartTourForm />
        <p className="text-gray-700">{t("app.isProgram")}</p>
        <footer className="border-t-2 border-gray-300 pt-4">
          <Link href="/impact" className="underline text-lg">
            {t("home.impact")}
          </Link>
        </footer>
      </div>
    </div>
  );
}
