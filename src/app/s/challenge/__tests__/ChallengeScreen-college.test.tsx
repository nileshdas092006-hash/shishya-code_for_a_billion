import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";

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

// F12 Part 2: what a college student sees first on each step, and the time on the end-of-challenge card.

const DET = "col.matrix.det2";
const DICE = "col.prob.two-dice";
const base = {
  ok: true,
  step: "welcome",
  code: "UG-K7QM",
  classCode: "CH-R4TX",
  title: "IITG first-years",
  teach: false,
  practise: null,
  check: null,
  scores: { pre: null, post: null, delayed: null, total: 6, delayedTotal: 4 },
  feedbackGiven: false,
  delayed: null,
  college: true,
};
const render = (o: Record<string, unknown>) => renderToStaticMarkup(<ChallengeScreen initial={{ ...base, ...o } as unknown as Overview} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const practise = (over: Record<string, unknown>) => ({
  target: 8,
  done: 0,
  teachStarted: false,
  teachDone: false,
  ready: false,
  skipInSeconds: 300,
  teachSkill: DET,
  sets: [{ skillId: DET, target: 4, done: 0 }, { skillId: DICE, target: 4, done: 0 }],
  ...over,
});

describe("the challenge screen, college pack", () => {
  it("welcome: the UG code and the college words, not 'x on both sides'", () => {
    const html = render({});
    expect(html).toContain("UG-K7QM");
    expect(html).toContain(en["challenge.intro.college"]);
    expect(html).not.toContain("x on both sides");
    expect(en["challenge.intro.college"]).toMatch(/determinant/);
    expect(en["challenge.intro.college"]).toMatch(/dice/);
  });

  it("a running check: the skill's own task and label, and a matrix in two rows", () => {
    const html = render({ step: "pre", check: { ok: true, checkId: "k", phase: "pre", items: [{ itemId: "i", skillId: DET, text: "[[3, −2], [4, 5]]", answered: false }] } });
    expect(html).toContain(en["skill.col.matrix.det2.task"]);
    expect(html).toContain(en["skill.col.matrix.det2.answerLabel"]);
    expect(html).not.toContain("Solve for x");
    expect(html).toMatch(/grid-cols-2/);
  });

  it("a dice check question reads as a sentence and asks for a probability", () => {
    const q = "Two fair dice are rolled. What is the probability that the sum is 7?";
    const html = render({ step: "pre", check: { ok: true, checkId: "k", phase: "pre", items: [{ itemId: "i", skillId: DICE, text: q, answered: false }] } });
    expect(html).toContain(q);
    expect(html).toContain(en["skill.col.prob.two-dice.answerLabel"]);
    expect(html).not.toContain("eq-box");
  });

  it("practise: the college title, the first unfinished set, and the count over both sets", () => {
    const first = render({ step: "practise", practise: practise({ done: 2, sets: [{ skillId: DET, target: 4, done: 2 }, { skillId: DICE, target: 4, done: 0 }] }) });
    expect(first).toContain(en["challenge.practise.title.college"]);
    expect(first).not.toContain("x on both sides");
    expect(text(first)).toContain("Practice questions done: 2 of 8");
    expect(first).toContain(en["skill.col.matrix.det2.title"]);
    const second = render({ step: "practise", practise: practise({ done: 5, sets: [{ skillId: DET, target: 4, done: 4 }, { skillId: DICE, target: 4, done: 1 }] }) });
    expect(text(second)).toContain("Practice questions done: 5 of 8");
    expect(second).toContain(en["skill.col.prob.two-dice.title"]);
    expect(second).not.toContain(en["skill.col.matrix.det2.title"]);
  });

  it("extra answers on one set do not count towards the total shown", () => {
    const html = render({ step: "practise", practise: practise({ done: 7, sets: [{ skillId: DET, target: 4, done: 7 }, { skillId: DICE, target: 4, done: 0 }] }) });
    expect(text(html)).toContain("Practice questions done: 4 of 8");
    expect(html).toContain(en["skill.col.prob.two-dice.title"]);
  });

  it("group B after both sets: teach the Shishya", () => {
    const html = render({ step: "practise", teach: true, practise: practise({ target: 4, done: 4, sets: [{ skillId: DET, target: 2, done: 2 }, { skillId: DICE, target: 2, done: 2 }] }) });
    expect(html).toContain(en["challenge.practise.teachNow"]);
  });

  it("the end card: before → after and the time taken", () => {
    const html = render({ step: "done", scores: { pre: 3, post: 6, delayed: null, total: 6, delayedTotal: 4 }, minutesTaken: 18 });
    expect(text(html)).toContain("Before: 3/6 → After: 6/6");
    expect(text(html)).toContain("Time taken: 18 minutes");
  });
});

describe("the end card, school pack", () => {
  it("shows the time taken too, and the school words are unchanged", () => {
    const html = render({ college: undefined, step: "done", scores: { pre: 2, post: 5, delayed: null, total: 6, delayedTotal: 4 }, minutesTaken: 1 });
    expect(text(html)).toContain("Before: 2/6 → After: 5/6");
    expect(text(html)).toContain("Time taken: 1 minute");
    const welcome = render({ college: undefined, code: "8C-K7QM" });
    expect(welcome).toContain(en["challenge.intro"]);
    expect(en["challenge.intro"]).toContain("x on both sides");
  });
});
