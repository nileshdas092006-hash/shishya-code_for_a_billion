import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";
import { t } from "@/i18n";

vi.mock("../../../actions", () => ({
  challengeOverviewAction: vi.fn(),
  startChallengeCheckAction: vi.fn(),
  submitChallengeCheckAction: vi.fn(),
  saveChallengeFeedbackAction: vi.fn(),
  servePractice: vi.fn(),
  answerPractice: vi.fn(),
  startTeachSession: vi.fn(),
  submitTeach: vi.fn(),
}));
const { ChallengeScreen } = await import("../ChallengeScreen");
type Overview = Parameters<typeof ChallengeScreen>[0]["initial"];

// F11 Part 2: what a challenge student sees first on each step (the server render, i.e. before the page is ready).

const base: Overview = {
  ok: true,
  step: "welcome",
  code: "8C-K7QM",
  classCode: "CH-R4TX",
  title: "Udgam Shishya Challenge",
  teach: false,
  practise: null,
  check: null,
  scores: { pre: null, post: null, delayed: null, total: 6, delayedTotal: 4 },
  feedbackGiven: false,
  delayed: null,
};
const render = (o: Partial<Overview>) => renderToStaticMarkup(<ChallengeScreen initial={{ ...base, ...o } as Overview} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the challenge screen", () => {
  it("welcome: the code BIG with the class code, the 4 steps, and 'Start the challenge' (waits for the page)", () => {
    const html = render({});
    expect(html).toContain("8C-K7QM");
    expect(html).toContain("CH-R4TX");
    expect(html).toContain(en["challenge.writeDown"]);
    expect(html).toMatch(/text-5xl[^"]*"[^>]*>8C-K7QM</);
    expect(text(html)).toMatch(/1 Before 2 Practise 3 After 4 Feedback/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Start the challenge<span/);
  });

  it("a running check: one question, no hints, the keypad", () => {
    const html = render({
      step: "pre",
      check: { ok: true, checkId: "k1", phase: "pre", items: [{ itemId: "i1", skillId: "alg.linear.one-step", text: "x + 7 = 3", answered: false }, { itemId: "i2", skillId: "alg.linear.two-step", text: "5x − 3 = −8", answered: false }] },
    });
    expect(html).toContain(en["challenge.pre.title"]);
    expect(text(html)).toContain("Question 1 of 2");
    expect(html).toContain("x + 7 = 3");
    expect(html).not.toContain(en["practise.hint"]);
    expect(html).toContain('aria-label="Maths keypad"');
  });

  it("practise, group A: the count of 8 and the normal Practise screen, with no offer to teach", () => {
    const html = render({ step: "practise", practise: { target: 8, done: 3, teachStarted: false, teachDone: false, ready: false, skipInSeconds: 300 } });
    expect(text(html)).toContain("Practice questions done: 3 of 8");
    expect(html).toContain(en["practise.loading"]);
    expect(html).not.toContain(en["practise.offerTeach"]);
    expect(html).not.toContain(en["challenge.practise.skip"]);
  });

  it("practise after 12 minutes: anyone may go on", () => {
    const html = render({ step: "practise", practise: { target: 8, done: 1, teachStarted: false, teachDone: false, ready: true, skipInSeconds: 0 } });
    expect(html).toContain(en["challenge.practise.skipNote"]);
    expect(html).toContain(en["challenge.practise.skip"]);
  });

  it("practise, group B after its 4 questions: teach the Shishya", () => {
    const html = render({ step: "practise", teach: true, practise: { target: 4, done: 4, teachStarted: false, teachDone: false, ready: false, skipInSeconds: 120 } });
    expect(html).toContain(en["challenge.practise.teachNow"]);
    expect(html).toContain(en["teach.start"]);
  });

  it("feedback: group B is asked about teaching, group A is not; the comment warns about personal details", () => {
    const b = render({ step: "feedback", teach: true });
    const a = render({ step: "feedback", teach: false });
    expect(b).toContain(en["challenge.fb.teach"]);
    expect(a).not.toContain(en["challenge.fb.teach"]);
    for (const html of [a, b]) {
      expect(html).toContain(en["challenge.fb.useful"]);
      expect(html).toContain(en["challenge.fb.warning"]);
      expect(html).toMatch(/maxLength="200"/);
      expect(html).not.toContain(en["challenge.fb.quote"]); // only once a comment is typed
    }
  });

  it("done: before → after, and come back after 3 days with both codes", () => {
    const html = render({
      step: "done",
      scores: { pre: 3, post: 5, delayed: null, total: 6, delayedTotal: 4 },
      delayed: { state: "later", opensAt: "2026-11-03T09:00:00.000Z", closesAt: "2026-11-21T09:00:00.000Z" },
    });
    expect(text(html)).toContain("Before: 3/6 → After: 5/6");
    expect(text(html)).toContain(t("challenge.done.later", { classCode: "CH-R4TX", code: "8C-K7QM" }));
  });

  it("never names the student's group", () => {
    for (const step of ["welcome", "practise", "feedback", "done"] as const) {
      const html = render({
        step,
        teach: true,
        practise: { target: 4, done: 0, teachStarted: false, teachDone: false, ready: false, skipInSeconds: 60 },
        scores: { pre: 1, post: 2, delayed: null, total: 6, delayedTotal: 4 },
      });
      expect(text(html)).not.toMatch(/\bgroup\b|\barm\b/i);
      expect(text(html)).not.toMatch(/\b(A|B)\b/);
    }
  });
});
