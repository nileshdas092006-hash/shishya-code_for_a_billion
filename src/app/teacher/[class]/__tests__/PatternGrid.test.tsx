import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { skillKey, t } from "@/i18n";
import { PatternGrid, SlipList } from "../PatternGrid";

// The stuck board's grid: rows = skills, columns = working lines L2…L5, each cell = children whose PATTERN
// first goes wrong there. Numbers are always printed, so colour is never the only signal.

const grid = {
  lines: [2, 3, 4, 5],
  rows: [
    { skillId: "alg.linear.two-step", counts: [0, 0, 0, 0] },
    { skillId: "alg.linear.both-sides", counts: [2, 1, 0, 6] },
  ],
};

describe("PatternGrid", () => {
  const html = renderToStaticMarkup(<PatternGrid grid={grid} />);
  const cells = [...html.matchAll(/<td[^>]*data-count="(\d+)"[^>]*>(.*?)<\/td>/g)].map((m) => [m[1], m[2]]);

  it("prints every count, one cell per skill and line", () => {
    expect(cells).toEqual([
      ["0", "0"], ["0", "0"], ["0", "0"], ["0", "0"],
      ["2", "2"], ["1", "1"], ["0", "0"], ["6", "6"],
    ]);
    for (const n of [2, 3, 4, 5]) expect(html).toContain(`>L${n}<`);
    expect(html).toContain(t(skillKey("alg.linear.both-sides", "title")));
  });

  it("shades bigger counts darker, and scrolls inside its own box", () => {
    const shade = (count: string) => html.match(new RegExp(`<td class="([^"]*)" data-count="${count}"`))![1];
    expect(shade("0")).toContain("bg-white");
    expect(shade("1")).toContain("bg-amber-100");
    expect(shade("2")).toContain("bg-amber-200");
    expect(shade("6")).toMatch(/bg-amber-700.*text-white|text-white.*bg-amber-700/);
    expect(html).toMatch(/^<div class="[^"]*overflow-x-auto/);
  });
});

describe("SlipList", () => {
  it("lists child codes with the line, per skill, without naming a mistake", () => {
    const html = renderToStaticMarkup(
      <SlipList slips={[{ skillId: "alg.linear.both-sides", students: [{ code: "8B-02", line: 2 }, { code: "8B-04", line: 5 }] }]} />,
    );
    expect(html).toContain(t("board.slips.title"));
    expect(html).toContain(t("board.slips.at", { code: "8B-02", n: 2 }));
    expect(html).toContain(t("board.slips.at", { code: "8B-04", n: 5 }));
  });
});
