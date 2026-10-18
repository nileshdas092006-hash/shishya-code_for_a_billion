import { t } from "@/i18n";

// Every student screen says plainly that the Shishya is a computer program.

export default function StudentLayout({ children }: LayoutProps<"/s">) {
  return (
    <div className="flex flex-col gap-6">
      <p role="note" className="msg-note text-center font-semibold no-print">
        {t("app.isProgram")}
      </p>
      {children}
    </div>
  );
}
