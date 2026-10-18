import { describe, expect, it } from "vitest";
import { equivalent, parseEquation, root, type Equation } from "../equation";
import { frac } from "../fraction";
import { createRng } from "../rng";
import { linearBothSides } from "../skills/linear-both-sides";

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);

function parse(text: string): Equation {
  const r = parseEquation(text);
  if (!r.ok) throw new Error(`could not parse "${text}": ${r.error}`);
  return r.equation;
}

describe("parseEquation", () => {
  it("reads 4x - 2x - 3 = 7 into terms and a simplified expression", () => {
    const e = parse("4x - 2x - 3 = 7");
    expect(e.left.terms).toEqual([
      { coef: frac(4), hasX: true },
      { coef: frac(-2), hasX: true },
      { coef: frac(-3), hasX: false },
    ]);
    expect(e.left.expr).toEqual({ xCoef: frac(2), constant: frac(-3) });
    expect(e.right.terms).toEqual([{ coef: frac(7), hasX: false }]);
    expect(e.right.expr).toEqual({ xCoef: frac(0), constant: frac(7) });
  });

  it("accepts Unicode minus and no spaces", () => {
    expect(parse("4x−2x−3=7")).toEqual(parse("4x - 2x - 3 = 7"));
  });

  it.each([
    ["2x = 10", { xCoef: 2, constant: 0 }, { xCoef: 0, constant: 10 }],
    ["x = 5", { xCoef: 1, constant: 0 }, { xCoef: 0, constant: 5 }],
    ["-x + 4 = 2x", { xCoef: -1, constant: 4 }, { xCoef: 2, constant: 0 }],
    ["10 = 2x", { xCoef: 0, constant: 10 }, { xCoef: 2, constant: 0 }],
    ["−x − 5 = 3x + 7", { xCoef: -1, constant: -5 }, { xCoef: 3, constant: 7 }],
    ["  4 x  +  −3  =  X ", { xCoef: 4, constant: -3 }, { xCoef: 1, constant: 0 }],
  ])("parses %s", (text, left, right) => {
    const e = parse(text);
    expect(e.left.expr).toEqual({ xCoef: frac(left.xCoef), constant: frac(left.constant) });
    expect(e.right.expr).toEqual({ xCoef: frac(right.xCoef), constant: frac(right.constant) });
  });

  it.each([
    "4x ==",
    "abc",
    "",
    "   ",
    "4x + 3",
    "= 7",
    "4x =",
    "4x - = 7",
    "4 3x = 7",
    "x2 = 4",
    "2xx = 4",
    "2.5x = 5",
    "x/2 = 3",
    "2(x + 1) = 4",
    "1 = 2 = 3",
    "99999999999999999999x = 1",
  ])("returns ok:false (no exception) for %j", (text) => {
    let result: ReturnType<typeof parseEquation> | undefined;
    expect(() => (result = parseEquation(text))).not.toThrow();
    expect(result?.ok).toBe(false);
    if (result && !result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("never throws on random junk", () => {
    const chars = "0123456789xX+-−= .()/*abc";
    const rng = createRng(99);
    for (let i = 0; i < 2000; i++) {
      const len = Math.floor(rng.next() * 12);
      let s = "";
      for (let j = 0; j < len; j++) s += chars[Math.floor(rng.next() * chars.length)];
      expect(() => parseEquation(s), s).not.toThrow();
    }
  });
});

describe("root and equivalent", () => {
  it("finds the single solution", () => {
    expect(root(parse("4x - 3 = 2x + 7"))).toEqual(frac(5));
    expect(root(parse("6x = 10"))).toEqual(frac(5, 3));
    expect(root(parse("10 = 2x"))).toEqual(frac(5));
  });

  it("reports none and all", () => {
    expect(root(parse("x + 1 = x + 2"))).toBe("none");
    expect(root(parse("2x + 1 = x + x + 1"))).toBe("all");
  });

  it("is equivalent only with the same single solution", () => {
    expect(equivalent(parse("4x - 3 = 2x + 7"), parse("2x = 10"))).toBe(true);
    expect(equivalent(parse("4x - 3 = 2x + 7"), parse("x = 5"))).toBe(true);
    expect(equivalent(parse("4x - 3 = 2x + 7"), parse("x = 4"))).toBe(false);
    expect(equivalent(parse("x = x"), parse("x = x"))).toBe(false);
    expect(equivalent(parse("x = x + 1"), parse("x = x + 1"))).toBe(false);
  });
});

describe("property over 1,000 seeds: traces and the checker", () => {
  it("every correct trace line parses and is equivalent to the original", () => {
    for (const seed of SEEDS) {
      const inst = linearBothSides.generate(createRng(seed));
      const original = parse(inst.text);
      for (const line of linearBothSides.solve(inst).trace) {
        expect(equivalent(parse(line.text), original), `seed ${seed}: ${line.text}`).toBe(true);
      }
    }
  });

  it("each authored mistake's first wrong line parses and is NOT equivalent", () => {
    for (const seed of SEEDS) {
      const inst = linearBothSides.generate(createRng(seed));
      const original = parse(inst.text);
      for (const m of linearBothSides.mistakes) {
        const out = m.apply(inst);
        const wrong = out.trace[out.firstWrongLine - 1].text;
        expect(equivalent(parse(wrong), original), `seed ${seed} ${m.id}: ${wrong}`).toBe(false);
      }
    }
  });
});
