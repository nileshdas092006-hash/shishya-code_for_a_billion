// The Shishya: an original, simple character (a cheerful student holding a notebook), drawn as inline SVG
// so it costs almost nothing to load. Three moods: confused, thinking, happy.

export type Mood = "confused" | "thinking" | "happy";

const LABEL: Record<Mood, string> = {
  confused: "The Shishya looks confused",
  thinking: "The Shishya is thinking",
  happy: "The Shishya is happy",
};

export function Shishya({ mood = "thinking", size = 140 }: { mood?: Mood; size?: number }) {
  return (
    <svg
      viewBox="0 0 160 180"
      width={size}
      height={(size * 180) / 160}
      role="img"
      aria-label={LABEL[mood]}
      className="shrink-0"
    >
      {/* body: school shirt */}
      <path d="M40 178 Q42 122 80 118 Q118 122 120 178 Z" fill="#2f6fdb" />
      <path d="M68 120 L80 138 L92 120" fill="#ffffff" />
      {/* neck and head */}
      <rect x="72" y="104" width="16" height="16" rx="4" fill="#c98b5b" />
      <circle cx="80" cy="72" r="38" fill="#d9a06f" />
      {/* hair with a tuft */}
      <path d="M43 66 Q46 30 80 30 Q114 30 117 66 Q108 48 80 47 Q54 48 43 66 Z" fill="#2b2530" />
      <path d="M78 31 Q84 18 94 22 Q86 24 86 33 Z" fill="#2b2530" />
      {/* ears */}
      <circle cx="42" cy="76" r="7" fill="#c98b5b" />
      <circle cx="118" cy="76" r="7" fill="#c98b5b" />

      {mood === "happy" && (
        <g>
          <path d="M60 72 Q66 64 72 72" stroke="#1f1a24" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M88 72 Q94 64 100 72" stroke="#1f1a24" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="58" cy="86" r="5" fill="#f08a8a" opacity="0.7" />
          <circle cx="102" cy="86" r="5" fill="#f08a8a" opacity="0.7" />
          <path d="M64 88 Q80 106 96 88 Z" fill="#7a1f2b" />
          <path d="M70 94 Q80 100 90 94" fill="#f3a1a1" />
        </g>
      )}
      {mood === "thinking" && (
        <g>
          <circle cx="66" cy="72" r="5" fill="#1f1a24" />
          <circle cx="94" cy="72" r="5" fill="#1f1a24" />
          <circle cx="68" cy="70" r="1.6" fill="#ffffff" />
          <circle cx="96" cy="70" r="1.6" fill="#ffffff" />
          <path d="M58 61 L72 59" stroke="#1f1a24" strokeWidth="3" strokeLinecap="round" />
          <path d="M88 59 L102 61" stroke="#1f1a24" strokeWidth="3" strokeLinecap="round" />
          <path d="M72 94 L88 92" stroke="#1f1a24" strokeWidth="3.5" strokeLinecap="round" />
          {/* thought dots */}
          <circle cx="128" cy="40" r="4" fill="#9ca3af" />
          <circle cx="138" cy="28" r="6" fill="#9ca3af" />
          <circle cx="150" cy="12" r="8" fill="#9ca3af" />
        </g>
      )}
      {mood === "confused" && (
        <g>
          <circle cx="66" cy="74" r="5" fill="#1f1a24" />
          <circle cx="94" cy="74" r="5" fill="#1f1a24" />
          <path d="M57 64 L73 62" stroke="#1f1a24" strokeWidth="3" strokeLinecap="round" />
          <path d="M87 58 Q95 52 103 58" stroke="#1f1a24" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M66 94 Q72 89 78 94 Q84 99 90 94 Q94 91 96 93" stroke="#1f1a24" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <text x="124" y="44" fontSize="34" fontWeight="700" fill="#b45309" fontFamily="Arial, sans-serif">
            ?
          </text>
        </g>
      )}

      {/* the notebook, held in front */}
      <g transform="rotate(-6 80 150)">
        <rect x="48" y="132" width="64" height="44" rx="4" fill="#ffffff" stroke="#1f1a24" strokeWidth="2.5" />
        <line x1="80" y1="132" x2="80" y2="176" stroke="#1f1a24" strokeWidth="2" />
        <line x1="54" y1="144" x2="74" y2="144" stroke="#2f6fdb" strokeWidth="2" />
        <line x1="54" y1="152" x2="74" y2="152" stroke="#2f6fdb" strokeWidth="2" />
        <line x1="86" y1="144" x2="106" y2="144" stroke="#2f6fdb" strokeWidth="2" />
        <line x1="86" y1="152" x2="100" y2="152" stroke="#2f6fdb" strokeWidth="2" />
        <text x="56" y="170" fontSize="12" fontWeight="700" fill="#1f1a24" fontFamily="Arial, sans-serif">
          x = ?
        </text>
      </g>
      {/* hands on the notebook */}
      <circle cx="50" cy="150" r="7" fill="#d9a06f" />
      <circle cx="110" cy="146" r="7" fill="#d9a06f" />
    </svg>
  );
}
