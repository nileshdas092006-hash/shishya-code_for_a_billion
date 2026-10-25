import Link from "next/link";
import { t } from "@/i18n";
import { RecoverPinForm } from "./RecoverPinForm";

// Teacher page "Forgot the PIN?". Wrong recovery codes are counted in the database, like wrong PINs.

export default function RecoverPinPage() {
  return (
    <section className="card flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("recover.title")}</h1>
      <p>{t("recover.intro")}</p>
      <RecoverPinForm />
      <Link href="/teacher" className="underline self-start">
        {t("delete.done.back")}
      </Link>
    </section>
  );
}
