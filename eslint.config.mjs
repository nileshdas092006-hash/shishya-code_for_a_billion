import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // src/core is pure (see CLAUDE.md): no framework, I/O, network, AI or unseeded randomness.
  {
    files: ["src/core/**/*.ts"],
    ignores: ["src/core/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(react|react-dom|next|@anthropic-ai|openai|node:|fs|path|http|https|net|child_process)(/|$)",
              message: "src/core must stay pure TypeScript (see src/core/README.md).",
            },
            { regex: "^@/(?!core/)", message: "src/core may only import from src/core." },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded rng passed in (src/core/rng.ts)." },
        { object: "Date", property: "now", message: "src/core must be deterministic." },
      ],
      "no-restricted-globals": ["error", "fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage"],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // an old local clone of this repo kept inside app/ (git-ignored, not part of this project)
    "shishya-code_for_a_billion/**",
  ]),
]);

export default eslintConfig;
