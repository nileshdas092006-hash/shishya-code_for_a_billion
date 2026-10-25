import { asFraction, parseAnswer, sameAnswer } from "./answer";
import { childMessage, childMessageKey, childMessageParams } from "./childMessages";
import { equivalent, parseEquation } from "./equation";
import { formatEquation, fracText } from "./format";
import { add, div, equals, frac, mul, sub, type Fraction } from "./fraction";
import { createRng } from "./rng";
import { applies, type Instance, type Mistake, type SkillSpec, type StepType } from "./types";

// A MINED mistake is DATA, never code. The Misconception Miner (an AI agent) may only propose this JSON:
//   { id, label, childLabel, stepType, firstWrongLine (2..5), lines: {"<n>": "<template>"}, answerFormula }
// e.g. answerFormula "(d - b) / a" and lines {"5": "x = {(d - b) / a}"}.
// Formulas use ONLY a, b, c, d, whole numbers, + − × ÷ and brackets. Templates are equations with {formulas}.
// We evaluate them with our own tiny exact-fraction evaluator below: no eval, no Function, no imports of AI.

type Params = Instance["params"];

export type MinedMistakeSpec = {
  id: string;
  label: string;
  childLabel: string;
  stepType: StepType;
  firstWrongLine: number;
  lines: Record<string, string>;
  answerFormula: string;
};

/** A logged wrong answer that no known mistake explains (anonymous: only the question's numbers). */
export type UnknownError = { params: Params; wrongAnswer: string; count?: number };

/** Who wrote the child message of a mined mistake: the AI (never shown: children see the fixed message) or the teacher. */
export type ChildLabelSource = "ai" | "teacher";

const MAX_TEXT = 200;
const STEP_TYPES: StepType[] = ["move-x", "move-const", "simplify", "divide"];
export const NOT_NCERT =/\bmov(e|es|ed|ing)\b|change (the|its) sign/i;

// ---------------- the evaluator ----------------

type Token = { kind: "num"; value: number } | { kind: "var"; name: keyof Params } | { kind: "op"; op: "+" | "-" | "*" | "/" } | { kind: "(" | ")" };
type Node =
  | { kind: "num"; value: number }
  | { kind: "var"; name: keyof Params }
  | { kind: "neg"; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Node; right: Node };

const OPS: Record<string, "+" | "-" | "*" | "/"> = { "+": "+", "-": "-", "−": "-", "–": "-", "*": "*", "×": "*", "/": "/", "÷": "/" };

function tokenize(src: unknown): Token[] {
  if (typeof src !== "string") throw new Error("a formula must be text");
  if (src.trim() === "") throw new Error("a formula is empty");
  if (src.length > MAX_TEXT) throw new Error(`a formula is longer than ${MAX_TEXT} characters`);
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " ") {
      i++;
    } else if (/[0-9]/.test(ch)) {
      let digits = "";
      while (i < src.length && /[0-9]/.test(src[i])) digits += src[i++];
      if (digits.length > 6) throw new Error("a number in a formula is too big");
      tokens.push({ kind: "num", value: Number(digits) });
    } else if (/[a-d]/.test(ch) && !/[a-z0-9_.]/i.test(src[i + 1] ?? "")) {
      tokens.push({ kind: "var", name: ch as keyof Params });
      i++;
    } else if (ch in OPS) {
      tokens.push({ kind: "op", op: OPS[ch] });
      i++;
    } else if (ch === "(" || ch === ")") {
      tokens.push({ kind: ch });
      i++;
    } else {
      throw new Error(`"${ch}" is not allowed in a formula (only a, b, c, d, whole numbers, + − × ÷ and brackets)`);
    }
  }
  return tokens;
}

/** expr := term (+|- term)* ; term := factor (*|/ factor)* ; factor := -factor | number | a..d | ( expr ) */
function parseFormula(src: unknown): Node {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (t: Token | undefined, ...ops: string[]): t is Token & { kind: "op" } => t?.kind === "op" && ops.includes(t.op);

  function factor(): Node {
    const t = tokens[pos++];
    if (!t) throw new Error("a formula ends too early");
    if (isOp(t, "-")) return { kind: "neg", arg: factor() };
    if (t.kind === "num") return { kind: "num", value: t.value };
    if (t.kind === "var") return { kind: "var", name: t.name };
    if (t.kind === "(") {
      const inner = expr();
      if (tokens[pos++]?.kind !== ")") throw new Error("a bracket is not closed");
      return inner;
    }
    throw new Error("a formula has an operator in the wrong place");
  }
  function term(): Node {
    let node = factor();
    while (isOp(peek(), "*", "/")) {
      const op = (tokens[pos++] as { op: "*" | "/" }).op;
      node = { kind: "bin", op, left: node, right: factor() };
    }
    return node;
  }
  function expr(): Node {
    let node = term();
    while (isOp(peek(), "+", "-")) {
      const op = (tokens[pos++] as { op: "+" | "-" }).op;
      node = { kind: "bin", op, left: node, right: term() };
    }
    return node;
  }

  const tree = expr();
  if (pos !== tokens.length) throw new Error("a formula has something extra at the end (two values need an operator between them)");
  return tree;
}

function run(node: Node, p: Params): Fraction {
  switch (node.kind) {
    case "num":
      return frac(node.value);
    case "var":
      return frac(p[node.name]);
    case "neg":
      return sub(frac(0), run(node.arg, p));
    case "bin": {
      const l = run(node.left, p);
      const r = run(node.right, p);
      if (node.op === "+") return add(l, r);
      if (node.op === "-") return sub(l, r);
      if (node.op === "*") return mul(l, r);
      if (r.num === 0) throw new Error("division by zero");
      return div(l, r);
    }
  }
}

/** Evaluates a formula like "(d - b) / a" exactly, for one question's a, b, c, d. Throws on anything unsafe. */
export const evaluate = (formula: string, params: Params): Fraction => run(parseFormula(formula), params);

// ---------------- templates ----------------

const TEMPLATE_PART = /\{([^{}]*)\}/g;
const OUTSIDE_ALLOWED = /^[0-9x =+\-− ]*$/;

function checkTemplate(template: unknown): string {
  if (typeof template !== "string" || template.trim() === "") throw new Error("a line template must be text");
  if (template.length > MAX_TEXT) throw new Error(`a line template is longer than ${MAX_TEXT} characters`);
  const outside = template.replace(TEMPLATE_PART, "");
  if (!OUTSIDE_ALLOWED.test(outside)) {
    throw new Error(`line "${template}": outside {formulas} only x, whole numbers, + − and = are allowed`);
  }
  for (const m of template.matchAll(TEMPLATE_PART)) parseFormula(m[1]);
  return template;
}

/** Fills a line template's {formulas} and prints it exactly like the Shishya's other lines. */
export function renderLine(template: string, params: Params): string {
  checkTemplate(template);
  const filled = template.replace(TEMPLATE_PART, (_, f: string) => fracText(evaluate(f, params)));
  if (/^x = −?\d+\/\d+$/.test(filled)) return filled; // a final answer that is a fraction, e.g. "x = 5/2"
  const parsed = parseEquation(filled);
  if (!parsed.ok) throw new Error(`line "${template}" gives "${filled}", which is not a whole-number equation`);
  const terms = (side: { terms: { coef: Fraction; hasX: boolean }[] }) => side.terms.map((t): [number, boolean] => [t.coef.num, t.hasX]);
  return formatEquation(terms(parsed.equation.left), terms(parsed.equation.right));
}

// ---------------- turning the data into a Mistake ----------------

/**
 * The Shishya's wrong trace: correct lines before firstWrongLine, then the mined templates.
 * The child label is NEVER the AI's words: it is the fixed message for the step type, unless a teacher wrote
 * the child message when approving it (childLabelSource "teacher").
 */
export function toMistake(spec: MinedMistakeSpec, skill: SkillSpec, childLabelSource: ChildLabelSource = "ai"): Mistake {
  const formula = parseFormula(spec.answerFormula);
  for (const template of Object.values(spec.lines)) checkTemplate(template);
  const fromTeacher = childLabelSource === "teacher";
  return {
    id: spec.id,
    label: spec.label,
    childLabel: fromTeacher ? spec.childLabel : childMessage(spec.stepType, spec.firstWrongLine),
    ...(fromTeacher ? {} : { childText: { key: childMessageKey(spec.stepType), params: childMessageParams(spec.firstWrongLine) } }),
    stepType: spec.stepType,
    origin: "mined",
    apply(instance) {
      const correct = skill.solve(instance).trace;
      const trace = correct.map((line, i) =>
        i + 1 < spec.firstWrongLine ? { text: line.text } : { text: renderLine(spec.lines[String(i + 1)], instance.params) },
      );
      return { trace, answer: run(formula, instance.params), firstWrongLine: spec.firstWrongLine };
    },
  };
}

// ---------------- the validator ----------------

export type ValidationContext = {
  skill: SkillSpec;
  unknownErrors: UnknownError[];
  /** Every mistake already known for this skill (authored, approved and drafted mined ones). */
  existing: Mistake[];
  seeds?: number;
};
export type ValidationResult = {
  ok: boolean;
  errors: string[];
  /** How many logged unknown wrong answers it explains. */
  reproduced: number;
  checkedInstances: number;
  /** Per existing mistake: on how many questions both give the same answer. */
  overlaps: Record<string, number>;
  /** On how many of the generated questions it gives the correct answer (must be 0). */
  rightAnswerOn: number;
  /** On how many of the generated questions it divides by zero (must be 0). */
  divideByZeroOn: number;
};

const MIN_REPRODUCED = 3;
const MAX_OVERLAP_SHARE = 0.1;

function shapeErrors(x: Record<string, unknown>, ctx: ValidationContext, lineCount: number): string[] {
  const errors: string[] = [];
  if (typeof x.id !== "string" || !/^[a-z][a-z0-9-]{2,39}$/.test(x.id)) errors.push("id must be 3–40 lower-case letters, digits or -");
  else if (ctx.existing.some((m) => m.id === x.id)) errors.push(`id "${x.id}" is already used by another mistake`);
  for (const key of ["label", "childLabel"] as const) {
    const v = x[key];
    if (typeof v !== "string" || v.trim() === "" || v.length > 300) errors.push(`${key} must be text of 1–300 characters`);
  }
  if (typeof x.childLabel === "string" && NOT_NCERT.test(x.childLabel)) {
    errors.push('childLabel must use NCERT language ("do the same operation on both sides"), not "move" or "change the sign"');
  }
  if (!STEP_TYPES.includes(x.stepType as StepType)) errors.push(`stepType must be one of ${STEP_TYPES.join(", ")}`);
  const fwl = x.firstWrongLine;
  if (!Number.isInteger(fwl) || (fwl as number) < 2 || (fwl as number) > lineCount) {
    errors.push(`firstWrongLine must be a whole number from 2 to ${lineCount}`);
  } else {
    const want = Array.from({ length: lineCount - (fwl as number) + 1 }, (_, i) => String((fwl as number) + i));
    const lines = x.lines;
    const have = lines && typeof lines === "object" && !Array.isArray(lines) ? Object.keys(lines).sort((p, q) => +p - +q) : null;
    if (!have || have.join() !== want.join()) errors.push(`lines must have exactly the keys ${want.map((k) => `"${k}"`).join(", ")}`);
    else {
      for (const k of want) {
        try {
          checkTemplate((lines as Record<string, unknown>)[k]);
        } catch (e) {
          errors.push(`lines["${k}"]: ${(e as Error).message}`);
        }
      }
    }
  }
  try {
    parseFormula(x.answerFormula);
  } catch (e) {
    errors.push(`answerFormula: ${(e as Error).message}`);
  }
  return errors;
}

/**
 * Checks a proposed mined mistake. Never throws. It must: use only allowed symbols; reproduce at least 3 logged
 * unknown wrong answers; on 1,000 generated questions never give the correct answer, never divide by zero, not be
 * a copy of an existing mistake, end with "x = <answerFormula>", and have a first wrong line that really is wrong.
 */
export function validateMinedMistake(input: unknown, ctx: ValidationContext): ValidationResult {
  const seeds = ctx.seeds ?? 1000;
  const result: ValidationResult = { ok: false, errors: [], reproduced: 0, checkedInstances: 0, overlaps: {}, rightAnswerOn: 0, divideByZeroOn: 0 };
  const stop = (message: string) => {
    result.errors.push(message);
    return result;
  };
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) return stop("a mined mistake must be a JSON object");
    const lineCount = ctx.skill.solve(ctx.skill.generate(createRng(1))).trace.length;
    result.errors.push(...shapeErrors(input as Record<string, unknown>, ctx, lineCount));
    if (result.errors.length) return result;
    const spec = input as MinedMistakeSpec;

    for (const e of ctx.unknownErrors) {
      const typed = parseAnswer(e.wrongAnswer);
      if (!typed.ok) continue;
      try {
        if (equals(evaluate(spec.answerFormula, e.params), typed.value)) result.reproduced++;
      } catch {
        // division by zero on this question: it does not explain it
      }
    }
    if (result.reproduced < MIN_REPRODUCED) {
      result.errors.push(`it reproduces only ${result.reproduced} of the logged unknown wrong answers (needs at least ${MIN_REPRODUCED})`);
    }

    const mined = toMistake(spec, ctx.skill);
    const fwl = spec.firstWrongLine;
    // the right answer and division by zero are counted over every question (the teacher sees how often)
    let firstRight = "";
    let firstZero = "";
    for (let seed = 1; seed <= seeds; seed++) {
      const inst = ctx.skill.generate(createRng(seed));
      const q = inst.text;
      result.checkedInstances++;
      let out;
      try {
        out = mined.apply(inst);
      } catch (e) {
        const message = (e as Error).message;
        if (message !== "division by zero") return stop(`for ${q}: ${message}`);
        result.divideByZeroOn++;
        firstZero ||= q;
        continue;
      }
      if (sameAnswer(out.answer, inst.answer)) {
        result.rightAnswerOn++;
        firstRight ||= q;
        continue;
      }
      for (const ex of ctx.existing) {
        if (applies(ex, inst) && sameAnswer(ex.apply(inst).answer, out.answer)) result.overlaps[ex.id] = (result.overlaps[ex.id] ?? 0) + 1;
      }
      const last = out.trace[out.trace.length - 1].text;
      const expected = `x = ${fracText(asFraction(out.answer))}`;
      if (last !== expected) return stop(`the last line must be x = <answerFormula>: for ${q} it is "${last}", expected "${expected}"`);
      const correctLine = ctx.skill.solve(inst).trace[fwl - 1].text;
      const wrongLine = out.trace[fwl - 1].text;
      if (wrongLine === correctLine) return stop(`line ${fwl} is the same as the correct line for ${q}`);
      const parsedWrong = parseEquation(wrongLine);
      const parsedQuestion = parseEquation(q);
      if (parsedWrong.ok && parsedQuestion.ok && equivalent(parsedWrong.equation, parsedQuestion.equation)) {
        return stop(`line ${fwl} ("${wrongLine}") is still equivalent to the question ${q}, so it is not wrong`);
      }
    }
    if (result.rightAnswerOn) {
      result.errors.push(`it gives the correct answer on ${result.rightAnswerOn} of ${seeds} questions (e.g. ${firstRight}), so it is not a mistake`);
    }
    if (result.divideByZeroOn) result.errors.push(`it divides by zero on ${result.divideByZeroOn} of ${seeds} questions (e.g. ${firstZero})`);
    for (const [id, n] of Object.entries(result.overlaps)) {
      if (n > seeds * MAX_OVERLAP_SHARE) result.errors.push(`it gives the same answer as the existing mistake "${id}" on ${n} of ${seeds} questions`);
    }
  } catch (e) {
    result.errors.push(`could not check it: ${(e as Error).message}`);
  }
  result.ok = result.errors.length === 0;
  return result;
}

// ---------------- evidence for the teacher's review card ----------------

/** The validator's numbers as stored with a draft. Older drafts lack the two counts; they passed, so both were 0. */
export type ReportNumbers = Pick<ValidationResult, "reproduced" | "checkedInstances" | "overlaps"> &
  Partial<Pick<ValidationResult, "rightAnswerOn" | "divideByZeroOn">>;
export type CheckId = "explains" | "neverRight" | "noDivideByZero" | "different";

/**
 * The 4 ticks on the review card: explains 3 or more real answers · never gives the right answer on the generated
 * questions · never divides by zero · different from every known mistake. n is the number each tick talks about.
 */
export function validationChecks(r: ReportNumbers): { id: CheckId; ok: boolean; n: number }[] {
  const checked = r.checkedInstances;
  return [
    { id: "explains", ok: r.reproduced >= MIN_REPRODUCED, n: r.reproduced },
    { id: "neverRight", ok: (r.rightAnswerOn ?? 0) === 0, n: checked },
    { id: "noDivideByZero", ok: (r.divideByZeroOn ?? 0) === 0, n: checked },
    { id: "different", ok: Object.values(r.overlaps ?? {}).every((n) => n <= checked * MAX_OVERLAP_SHARE), n: checked },
  ];
}

/** Each logged wrong answer the mined mistake explains: the question, the answer given, what it predicts, how often. */
export function explainedErrors(spec: MinedMistakeSpec, errors: UnknownError[]) {
  const rows: { question: string; wrongAnswer: string; predicted: string; count: number }[] = [];
  for (const e of errors) {
    const typed = parseAnswer(e.wrongAnswer);
    if (!typed.ok) continue;
    let predicted: Fraction;
    try {
      predicted = evaluate(spec.answerFormula, e.params);
    } catch {
      continue; // a bad formula, or division by zero on this question: it explains nothing here
    }
    if (!equals(predicted, typed.value)) continue;
    const { a, b, c, d } = e.params;
    const question = formatEquation([[a, true], [b, false]], [[c, true], [d, false]]);
    rows.push({ question, wrongAnswer: e.wrongAnswer, predicted: fracText(predicted), count: e.count ?? 1 });
  }
  return rows.sort((p, q) => q.count - p.count);
}
