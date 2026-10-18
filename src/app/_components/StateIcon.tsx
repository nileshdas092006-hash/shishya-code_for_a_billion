import type { MasteryState } from "@/server/store";

// Simple icons for skill states (inline SVG; always shown next to words, never alone).

export function StateIcon({ state, size = 36 }: { state: MasteryState; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, className: "shrink-0" } as const;
  switch (state) {
    case "LOCKED":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="11" rx="2" fill="#6b7280" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#6b7280" strokeWidth="2.5" fill="none" />
        </svg>
      );
    case "OPEN":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="#1d4ed8" strokeWidth="3" fill="none" />
          <path d="M10 8l5 4-5 4z" fill="#1d4ed8" />
        </svg>
      );
    case "KEY1":
      return (
        <svg {...common}>
          <circle cx="8" cy="12" r="4.5" stroke="#b45309" strokeWidth="2.5" fill="#fde68a" />
          <path d="M12.5 12H21M18 12v3M21 12v2.5" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "NOT_YET":
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 1 0 2.3-5.6" stroke="#9a3412" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M3 4v5h5" stroke="#9a3412" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "MASTERED":
      return (
        <svg {...common}>
          <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#16a34a" />
        </svg>
      );
  }
}
