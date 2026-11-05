import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";
import { hi } from "@/i18n/hi";

// Found in a live test: after a finished check, "Next" cleared the result BEFORE the overview had come back, so on a
// slow network the finished check's first question showed again, with "Save my answer", for several seconds. It looked
// as if the check had restarted.
//
// Tests run in node without a DOM, and a click needs state that changes. So this runs the real ChallengeScreen function
// with small stand-ins for useState and useTransition, and looks at what it returns at each moment.

const hooks = vi.hoisted(() => {
  let cells: unknown[] = [];
  let cursor = 0;
  let running = 0;
  return {
    reset() {
      cells = [];
      cursor = 0;
      running = 0;
    },
    beginRender() {
      cursor = 0;
    },
    useState(initial: unknown) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = initial;
      return [cells[i], (next: unknown) => (cells[i] = typeof next === "function" ? next(cells[i]) : next)];
    },
    useTransition() {
      // as in React: pending from the moment the action starts until its promise has finished
      return [
        running > 0,
        (action: () => unknown) => {
          running++;
          void Promise.resolve(action()).finally(() => running--);
        },
      ];
    },
  };
});

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useState: hooks.useState, useTransition: hooks.useTransition }));
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

const { challengeOverviewAction } = await import("../../../actions");
const { ChallengeScreen } = await import("../ChallengeScreen");
type Overview = Parameters<typeof ChallengeScreen>[0]["initial"];

const base = {
  ok: true,
  code: "8C-K7QM",
  classCode: "CH-R4TX",
  title: "Shishya Challenge",
  teach: false,
  scores: { pre: 3, post: null, delayed: null, total: 6, delayedTotal: 4 },
  feedbackGiven: false,
  delayed: null,
};
const runningCheck = {
  ...base,
  step: "pre",
  practise: null,
  check: { ok: true, checkId: "k1", phase: "pre", items: [{ itemId: "i1", skillId: "alg.linear.one-step", text: "x + 7 = 3", answered: true }] },
} as unknown as Overview;
const practise = {
  ...base,
  step: "practise",
  check: null,
  practise: { target: 8, done: 0, teachStarted: false, teachDone: false, ready: false, skipInSeconds: 300 },
} as unknown as Overview;
const finished = { ok: true, finished: true, phase: "pre", score: 3, total: 6, before: null, receipts: [] };

type Found = ReactElement<Record<string, unknown>>;
const flatten = (node: ReactNode): Found[] => {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const el = node as Found;
  return [el, ...flatten(el.props.children as ReactNode)];
};
const screen = () => {
  hooks.beginRender();
  return flatten(ChallengeScreen({ initial: runningCheck }));
};
const named = (els: Found[], name: string) => els.find((e) => typeof e.type === "function" && e.type.name === name);
const shows = (name: string) => named(screen(), name) !== undefined;
const nextButton = () => named(screen(), "ReadyButton");
const settle = () => new Promise((resolve) => setTimeout(resolve));

/** The student has just answered the last question of the check, and sees the result. */
function finishCheck() {
  (named(screen(), "CheckRunner")!.props.onFinished as (r: unknown) => void)(finished);
  expect(shows("CheckResult")).toBe(true);
}

/** An overview that comes back only when the test says so: the slow network. */
function slowOverview() {
  let arrive!: (o: unknown) => void;
  vi.mocked(challengeOverviewAction).mockReturnValueOnce(new Promise((resolve) => (arrive = resolve)) as never);
  return arrive;
}

describe("Next, after a finished check", () => {
  beforeEach(() => {
    hooks.reset();
    vi.mocked(challengeOverviewAction).mockReset();
  });

  it("keeps the result on screen, with Next disabled, until the overview has come back", async () => {
    const arrive = slowOverview();
    finishCheck();
    expect(nextButton()!.props.disabled).toBe(false);

    (nextButton()!.props.onClick as () => void)();
    await settle();

    expect(shows("CheckRunner")).toBe(false); // the finished check never shows again
    expect(shows("CheckResult")).toBe(true);
    expect(nextButton()!.props.disabled).toBe(true);
    expect(challengeOverviewAction).toHaveBeenCalledTimes(1);

    arrive(practise);
    await settle();

    expect(shows("CheckResult")).toBe(false);
    expect(shows("CheckRunner")).toBe(false);
    expect(shows("PractiseStep")).toBe(true);
  });

  it("if the overview is refused: the result stays, with the error, and Next can be pressed again", async () => {
    const arrive = slowOverview();
    finishCheck();
    (nextButton()!.props.onClick as () => void)();
    arrive({ ok: false });
    await settle();

    expect(shows("CheckRunner")).toBe(false);
    expect(shows("CheckResult")).toBe(true);
    expect(screen().find((e) => e.props.role === "alert")?.props.children).toBe(en["common.error"]);
    expect(nextButton()!.props.disabled).toBe(false);

    vi.mocked(challengeOverviewAction).mockResolvedValueOnce(practise as never);
    (nextButton()!.props.onClick as () => void)();
    await settle();

    expect(shows("CheckResult")).toBe(false);
    expect(shows("PractiseStep")).toBe(true);
    expect(screen().some((e) => e.props.role === "alert")).toBe(false);
  });
});

describe("the challenge name field on the teacher page", () => {
  it("suggests a plain name, in both languages", () => {
    expect(en["create.challenge.namePlaceholder"]).toBe("Shishya Challenge");
    expect(hi["create.challenge.namePlaceholder"]).toBe("Shishya Challenge");
  });
});
