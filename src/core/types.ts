import type { MessageParams } from "./equation";
import type { Fraction } from "./fraction";
import type { Rng } from "./rng";

/** An answer that is an expression in x, like 2x + 7 (x = coefficient of x, c = the number). */
export type ExprAnswer = { kind: "expr"; x: Fraction; c: Fraction };
/** A skill's answer: a number (most skills) or an expression (alg.like-terms). */
export type Answer = Fraction | ExprAnswer;
export type AnswerKind = "number" | "expression";

/** One question, fully determined by its skill, version and seed. */
export type Instance = {
  skillId: string;
  version: string;
  seed: number;
  /** The question's numbers, e.g. { a, b, c, d } for a·x + b = c·x + d. */
  params: Record<string, number>;
  text: string;
  answer: Answer;
};

export type TraceLine = { text: string };
export type Trace = TraceLine[];

export type StepType = "move-x" | "move-const" | "simplify" | "divide" | "sign" | "operation";

export type Mistake = {
  id: string;
  /** For the teacher. */
  label: string;
  /** For the child, in the NCERT textbook's language. */
  childLabel: string;
  /** A mined mistake shown with the fixed message for its step type: the message key and numbers, so screens can translate it. */
  childText?: { key: `child.step.${StepType}`; params: Record<string, number> };
  stepType: StepType;
  origin: "authored" | "mined";
  /** Some mistakes only make sense for some questions (e.g. "minus a negative" needs a − (−n)). Default: all. */
  appliesTo?(instance: Instance): boolean;
  /** firstWrongLine is 1-based (L1 is the question itself). */
  apply(instance: Instance): { trace: Trace; answer: Answer; firstWrongLine: number };
};

/** Is a typed line an acceptable correct line at this position of the working? */
export type LineCheck = { ok: boolean; feedback: string; feedbackKey: string; feedbackParams?: MessageParams };

export type SkillSpec = {
  id: string;
  version: string;
  statement: string;
  prerequisites: string[];
  answerKind: AnswerKind;
  generate(rng: Rng): Instance;
  solve(instance: Instance): { trace: Trace; answer: Answer };
  /** Checks a child's typed line for position `line` (2…) of this question's correct working. */
  checkLine(instance: Instance, line: number, typed: string): LineCheck;
  mistakes: Mistake[];
  hintLadder: [string, string, string, string];
  teachRule: { traces: 3; distinctMistakesMin: 2; triesMax: 2 };
  proofRule: { solve: 3; apply: 1; allCorrect: true };
};

/** Does this mistake make sense for this question? */
export const applies = (m: Mistake, instance: Instance) => m.appliesTo?.(instance) ?? true;

/** A word problem ("apply" item): the story, in English and Hindi, and the question behind it. */
export type ApplyItem = {
  /** The equation or expression behind the story, so the solver, mistakes and checker all work on it. */
  instance: Instance;
  text: string;
  textHi: string;
};
