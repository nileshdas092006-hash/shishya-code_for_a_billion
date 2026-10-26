import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { childMessage } from "@/core/childMessages";
import { validateMinedMistake, validationChecks } from "@/core/minedMistake";
import { linearBothSides } from "@/core/skills/linear-both-sides";
import { t } from "@/i18n";
import { en } from "@/i18n/en";
import { RECORDED_MINER_RUN } from "@/server/agent-runs";
import { recordedRun } from "../agent-run";
import { AgentRunView } from "../AgentRun";
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

  it("is read from the run history's recorded row (the same run, still labelled as recorded)", () => {
    expect(RECORDED_MINER_RUN.recorded).toBe(true);
    expect(recordedRun(RECORDED_MINER_RUN)).toEqual(recordedRun());
    expect(recordedRun(RECORDED_MINER_RUN).label).toBe("Recorded run, 2026-10-19, on test answers");
    // a live (not recorded) row is never shown as the recorded run
    expect(() => recordedRun({ ...RECORDED_MINER_RUN, recorded: false })).toThrow(/recorded/);
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

  it("says what a child sees now: the fixed message for the step type, never the AI's words", () => {
    expect(en["tour.agent.since"]).toBe(
      "Since then, children never see words written by the AI. For this mistake a child now sees: “{message}”.",
    );
    const run = recordedRun();
    expect(run.childNow).toBe(childMessage("divide", 5));
    expect(run.childNow).not.toContain(run.proposal.childLabelExcerpt);
    const html = render(<AgentRunView run={run} />);
    const advice = html.indexOf("What code cannot test");
    const since = html.indexOf(`Since then, children never see words written by the AI. For this mistake a child now sees: “${run.childNow}”.`);
    expect(advice).toBeGreaterThan(-1);
    expect(since).toBeGreaterThan(advice); // right after the paragraph about the AI's wrong message
  });

  it("shows the 4 ticks, worked out again by the validator now, and only the evidence row that was recorded", () => {
    const run = recordedRun();
    // the same validator, run here on the recorded formula and the one recorded question that kept its numbers
    const spec = { id: run.proposal.id, label: run.proposal.id, childLabel: run.proposal.childLabelExcerpt, stepType: "divide" as const,
      firstWrongLine: 5, lines: run.proposal.lines, answerFormula: run.proposal.answerFormula };
    const now = validateMinedMistake(spec, {
      skill: linearBothSides,
      unknownErrors: [{ params: { a: 4, b: -3, c: 2, d: 7 }, wrongAnswer: "5/2" }],
      existing: linearBothSides.mistakes,
    });
    expect(now.checkedInstances).toBe(1000);
    expect(run.checkedNow.map((c) => c.id)).toEqual(["explains", "neverRight", "noDivideByZero", "different"]);
    expect(run.checkedNow).toEqual(validationChecks({ ...now, reproduced: run.validation.explained }));
    expect(run.checkedNow.every((c) => c.ok)).toBe(true);
    expect(run.evidence).toEqual([{ question: "4x − 3 = 2x + 7", wrongAnswer: "5/2", predicted: "5/2", count: 1 }]);

    expect(en["tour.agent.checkedNow"]).toBe("Checked again by code just now");
    const html = render(<AgentRunView run={run} />);
    expect(html).toContain("Checked again by code just now");
    for (const c of run.checkedNow) expect(html).toContain(t(`review.check.${c.id}`, { n: c.n.toLocaleString("en-IN") }));
    expect(html).toContain("4x − 3 = 2x + 7");
    expect(html).toContain("x = 5/2");
    expect(html).toContain(t("tour.agent.checkedNowNote", { explained: run.validation.explained, n: "1,000" }));
    expect(html).toMatch(/overflow-x-auto/); // the evidence table scrolls in its own box at 360 px
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
