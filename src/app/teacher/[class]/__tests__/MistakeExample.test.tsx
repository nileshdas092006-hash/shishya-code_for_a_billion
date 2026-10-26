import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseAnswerFor, sameAnswer } from "@/core/answer";
import { frac } from "@/core/fraction";
import { SKILLS } from "@/core/skills";
import { applies } from "@/core/types";
import { boardExample, minedExample, MistakeExampleLines } from "../MistakeExample";

// The example working on the stuck board and on the review card of a Miner draft: a question where the mistake
// APPLIES, worked through with that mistake, so the last line is the mistake's own answer.

/** The text of each working line in the markup, in order (L1, L2, …). */
const shownLines = (html: string) => [...html.matchAll(/<span class="eq math[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);

describe("the stuck board's example of a mistake", () => {
  it("for every skill and every authored mistake: the mistake applies, and the shown working is its own trace", () => {
    for (const { spec } of SKILLS) {
      for (const m of spec.mistakes) {
        const ex = boardExample(spec.id, m.id);
        expect(ex, `${spec.id} ${m.id}`).not.toBeNull();
        expect(applies(m, ex!.instance), `${spec.id} ${m.id}: ${ex!.instance.text}`).toBe(true);
        const out = m.apply(ex!.instance);
        const lines = shownLines(renderToStaticMarkup(<MistakeExampleLines example={ex!} />));
        expect(lines).toEqual(out.trace.map((l) => l.text));
        const last = parseAnswerFor(spec.answerKind, lines.at(-1)!.replace(/^x\s*=\s*/, ""));
        expect(last.ok && sameAnswer(last.value, out.answer), `${spec.id} ${m.id}: ${lines.at(-1)}`).toBe(true);
      }
    }
  });

  it("'divided the wrong way round' is shown on a question where it applies, not x + 5 = −1", () => {
    const html = renderToStaticMarkup(<MistakeExampleLines example={boardExample("alg.linear.one-step", "divided-wrong-way")!} />);
    expect(html).not.toContain("x + 5 = −1");
    expect(html).toContain("← first wrong line");
  });

  it("an unknown skill or mistake (e.g. the 'unknown' group) has no example", () => {
    expect(boardExample("alg.linear.one-step", "unknown")).toBeNull();
    expect(boardExample("no.such.skill", "divided-wrong-way")).toBeNull();
  });
});

describe("the review card's example of a mined draft", () => {
  it("works the draft's own formula through a question, ending on its answer", () => {
    const spec = {
      id: "divide-by-original-a",
      label: "Divided by the number in front of x in the question",
      childLabel: "c",
      stepType: "divide" as const,
      firstWrongLine: 5,
      lines: { "5": "x = {(d - b) / a}" },
      answerFormula: "(d - b) / a",
    };
    const ex = minedExample("alg.linear.both-sides", spec)!;
    const { a, b, d } = ex.instance.params;
    const lines = shownLines(renderToStaticMarkup(<MistakeExampleLines example={ex} />));
    expect(lines[0]).toBe(ex.instance.text);
    const last = parseAnswerFor("number", lines.at(-1)!.replace(/^x\s*=\s*/, ""));
    expect(last.ok && sameAnswer(last.value, frac(d - b, a))).toBe(true);
  });
});
