import type { Fraction } from "./fraction";
import type { Rng } from "./rng";

/** One question, fully determined by its skill, version and seed. */
export type Instance = {
  skillId: string;
  version: string;
  seed: number;
  params: { a: number; b: number; c: number; d: number };
  text: string;
  answer: Fraction;
};

export type TraceLine = { text: string };
export type Trace = TraceLine[];

export type StepType = "move-x" | "move-const" | "simplify" | "divide";

export type Mistake = {
  id: string;
  /** For the teacher. */
  label: string;
  /** For the child, in the NCERT textbook's language. */
  childLabel: string;
  stepType: StepType;
  origin: "authored" | "mined";
  /** firstWrongLine is 1-based (L1 is the question itself). */
  apply(instance: Instance): { trace: Trace; answer: Fraction; firstWrongLine: number };
};

export type SkillSpec = {
  id: string;
  version: string;
  statement: string;
  prerequisites: string[];
  generate(rng: Rng): Instance;
  solve(instance: Instance): { trace: Trace; answer: Fraction };
  mistakes: Mistake[];
  hintLadder: [string, string, string, string];
  teachRule: { traces: 3; distinctMistakesMin: 2; triesMax: 2 };
  proofRule: { solve: 3; apply: 1; allCorrect: true };
};
