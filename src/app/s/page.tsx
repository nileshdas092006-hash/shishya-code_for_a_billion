import { t } from "@/i18n";
import { Shishya } from "../_components/Shishya";
import { StudentLoginForm } from "./StudentLoginForm";

export default function StudentLogin() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Shishya mood="happy" size={130} />
      <h1 className="text-3xl font-extrabold">{t("login.title")}</h1>
      <StudentLoginForm />
    </div>
  );
}
