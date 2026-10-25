import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { t } from "@/i18n";
import { IS_DEMO } from "@/server/instance";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shishya",
  description: "Teach the Shishya: find the exact algebra step, fix it, and prove it with no AI help inside the proof.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        {IS_DEMO && (
          <div role="status" className="bg-amber-300 text-black text-center font-bold py-1 px-3">
            {t("app.demo")}
          </div>
        )}
        <header className="no-print border-b-2 border-gray-300 px-4 py-2">
          <Link href="/" className="text-2xl font-extrabold text-blue-800 no-underline">
            {t("app.name")}
          </Link>
        </header>
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
