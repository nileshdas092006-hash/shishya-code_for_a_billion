"use client";

import { useEffect, useRef, type RefObject } from "react";
import { t, type MessageKey } from "@/i18n";
import { applyKey, KEYPAD_KEYS, type KeypadKey } from "../_lib/keypad";
import { ReadyButton } from "./ReadyButton";

// On-screen maths keypad under an answer box, for worn lab keyboards and phones. Each tap types at the cursor
// of the linked input and keeps the focus there; the physical keyboard keeps working as before. Keys are
// ReadyButtons, so a tap before the page is ready is never lost.

const FACES: Partial<Record<KeypadKey, string>> = { minus: "−", plus: "+", equals: "=", divide: "/", delete: "⌫" };
const LABELS: Partial<Record<KeypadKey, MessageKey>> = {
  minus: "keypad.minus",
  plus: "keypad.plus",
  equals: "keypad.equals",
  divide: "keypad.divide",
  delete: "keypad.delete",
  clear: "keypad.clear",
};

export function MathKeypad({
  value,
  onChange,
  inputRef,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
}) {
  const cursor = useRef<number | null>(null);

  // after a tap, put the cursor back where the tap typed
  useEffect(() => {
    const input = inputRef?.current;
    if (!input || cursor.current === null) return;
    input.focus();
    input.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  }, [value, inputRef]);

  const tap = (key: KeypadKey) => {
    const input = inputRef?.current;
    const from = input?.selectionStart ?? value.length;
    const to = input?.selectionEnd ?? from;
    const next = applyKey(value, from, to, key);
    cursor.current = next.cursor;
    if (next.value === value) {
      input?.focus();
      input?.setSelectionRange(next.cursor, next.cursor);
      cursor.current = null;
    } else onChange(next.value);
  };

  return (
    <div role="group" aria-label={t("keypad.label")} className="grid grid-cols-3 gap-2 w-full max-w-xs">
      {KEYPAD_KEYS.map((key) => {
        const label = LABELS[key];
        return (
          <ReadyButton
            key={key}
            type="button"
            aria-label={label ? t(label) : key}
            disabled={disabled}
            // keep the focus (and the cursor) in the answer box
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => tap(key)}
            className={`btn min-h-12 min-w-12 px-2 text-2xl font-bold math justify-center${key === "clear" ? " col-span-2" : ""}`}
          >
            {key === "clear" ? t("keypad.clear") : (FACES[key] ?? key)}
          </ReadyButton>
        );
      })}
    </div>
  );
}
