import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { recordedRun } from "../agent-run";
import { TourApprove } from "../TourApprove";
import { TourBanner } from "../TourBanner";

// The Judge Tour's own pieces: the banner on every stop, the recorded Miner run (stop 6) and its Approve button,
// which explains and saves nothing.

/** Static markup with &#x27; and &quot; turned back into ' and ". */
const render = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe("tour banner", () => {
  it("says where the judge is, that the class is made up and deleted in 24 hours, with Back / Next", () => {
    expect(en["tour.banner"]).toBe("Judge Tour · stop {n} of 6 · made-up class · deleted in 24 hours");
    const html = render(<TourBanner stop={3} />);
    expect(html).toContain("Judge Tour · stop 3 of 6 · made-up class · deleted in 24 hours");
    expect(hrefs(html)).toEqual(expect.arrayContaining(["/tour/2", "/tour/4", "/tour/5"]));
    expect(html).toContain(en["tour.toTeacher"]);
    expect(html).toContain(en["tour.tip.3"]);
    expect(html).toMatch(/sticky/);
    expect(html).toMatch(/flex-wrap/); // wraps at 360 px instead of scrolling sideways
  });

  it("the first stop has no Back, the last has no Next; teacher stops switch to the child view", () => {
    const first = render(<TourBanner stop={1} />);
    expect(hrefs(first)).not.toContain("/tour/0");
    expect(first).toContain(en["tour.tip.1"]);
    expect(en["tour.tip.1"]).toBe("Try a wrong answer on purpose.");
    const board = render(<TourBanner stop={5} />);
    expect(board).toContain(en["tour.toChild"]);
    expect(hrefs(board)).toContain("/tour/1");
    const last = render(<TourBanner stop={6} />);
    expect(hrefs(last)).not.toContain("/tour/7");
  });
});

describe("the recorded Misconception Miner run (stop 6)", () => {
  it("is labelled as a recorded run on test answers, with its real date", () => {
    const run = recordedRun();
    expect(run.label).toBe("Recorded run, 2026-10-19, on test answers");
    expect(run.model).toBe("openai/gpt-oss-120b");
    expect(run.calls.map((c) => c.tool)).toEqual(["get_unknown_errors", "validate_mined_mistake", "submit_draft"]);
    expect(run.seconds).toBe(8); // 1166 + 6132 + 949 ms
  });

  it("the proposed mistake, worked out by src/core, gives exactly the recorded wrong answer for the recorded question", () => {
    const run = recordedRun();
    expect(run.example.question).toBe("4x − 3 = 2x + 7");
    expect(run.example.trace).toHaveLength(5);
    expect(run.example.firstWrongLine).toBe(5);
    expect(run.example.trace[4]).toBe("x = 5/2");
    expect(run.example.wrongAnswer).toBe(run.example.recordedWrongAnswer);
    expect(run.example.correct).toBe("x = 5");
  });

  it("Approve explains and saves nothing: no form, no server action", () => {
    expect(en["tour.agent.approveNote"]).toBe(
      "In a real class, the teacher's approval adds this mistake for every class. In the tour, nothing is saved.",
    );
    const html = render(<TourApprove />);
    expect(html).toContain(en["tour.agent.approve"]);
    expect(html).not.toMatch(/<form|action=/);
    const src = readFileSync(join(__dirname, "..", "TourApprove.tsx"), "utf8");
    expect(src).not.toMatch(/actions|"use server"|fetch\(/);
  });
});
