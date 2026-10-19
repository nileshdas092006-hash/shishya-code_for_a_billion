"use client";

import type { ButtonHTMLAttributes } from "react";
import { t } from "@/i18n";
import { useHydrated } from "../_lib/use-hydrated";

// A button that needs JavaScript. Until the page is ready it is disabled and says "Loading…", so a tap on a
// slow school PC or phone is never silently lost. (Submit buttons of server-action forms stay plain <button>s:
// they work before hydration too.)

export function ReadyButton({ disabled, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const ready = useHydrated();
  return (
    <button
      {...rest}
      className={ready ? className : `${className} flex-wrap`.trim()}
      disabled={!ready || disabled}
      aria-busy={ready ? undefined : true}
      data-ready={ready ? "yes" : "no"}
    >
      {children}
      {!ready && <span className="text-sm font-normal">{t("common.loading")}</span>}
    </button>
  );
}
