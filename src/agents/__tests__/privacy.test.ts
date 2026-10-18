import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Privacy rule: the AI client and agents must never be given student codes, names or anything a child typed in
// free text. So code in src/agents may not import the server (students, sessions, the database), the app, or
// Next.js, and may not even mention student or class identifiers. The database is reached only through the
// narrow, anonymous functions the caller hands in (src/server/miner-ports.ts).

const AGENTS = join(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

describe("src/agents never sees student data", () => {
  const sources = files(AGENTS).map((p) => ({ path: relative(AGENTS, p), text: readFileSync(p, "utf8") }));

  it("has agent files to check", () => {
    expect(sources.map((s) => s.path).sort()).toEqual(expect.arrayContaining(["llm.ts", "loop.ts", "miner.ts"]));
  });

  it("imports nothing from the server, the app, sessions or Next.js", () => {
    for (const { path, text } of sources) {
      const imports = [...text.matchAll(/(?:import|export)[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);
      for (const spec of imports) {
        expect(spec, `${path} imports ${spec}`).not.toMatch(/(^|\/)(server|app)(\/|$)|session|auth|cookie|^next(\/|$)|^@\/(server|app)/);
      }
    }
  });

  it("never mentions student or class identifiers or typed lines", () => {
    for (const { path, text } of sources) {
      expect(text, path).not.toMatch(/\b(studentId|studentCode|student_code|classId|classCode|typedLine|getStudent)\b/);
    }
  });
});
