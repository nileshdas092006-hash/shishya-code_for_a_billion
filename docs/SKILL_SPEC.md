# The SkillSpec format

Every skill Shishya teaches is one `SkillSpec` object in `src/core/skills/`. The type is in
[`src/core/types.ts`](../src/core/types.ts). This page explains each field, with `alg.linear.two-step`
([`src/core/skills/linear-two-step.ts`](../src/core/skills/linear-two-step.ts)) as the worked example, and then the
JSON format of a mistake found by the Misconception Miner
([`src/core/minedMistake.ts`](../src/core/minedMistake.ts)).

How to add a skill, step by step: [CONTRIBUTING.md](../CONTRIBUTING.md#how-to-add-a-skill).

## The types a skill uses

| Type | What it is |
| --- | --- |
| `Instance` | One question: `skillId`, `version`, `seed`, `params` (its numbers, e.g. `{ a, b, d }`), `text` (as printed, e.g. `5x − 3 = −8`) and `answer`. The same skill, version and seed always give the same question. |
| `Answer` | A `Fraction` (most skills), or an `ExprAnswer` `{ kind: "expr", x, c }` for an expression like `2x + 7` (`alg.like-terms`). |
| `Trace` | The working, one `{ text }` per line. Line 1 is the question itself. |
| `Mistake` | One known wrong way of working (below). |
| `LineCheck` | The verdict on one typed line: `ok`, `feedback`, `feedbackKey` (an i18n key) and optional `feedbackParams`. |
| `ApplyItem` | A word problem: the `instance` behind the story, the story in English (`text`) and in Hindi (`textHi`). |
| `Rng` | The seeded random generator from `src/core/rng.ts`. The only allowed source of randomness in `src/core`. |

## SkillSpec, field by field

| Field | Type | Meaning | In `alg.linear.two-step` |
| --- | --- | --- | --- |
| `id` | `string` | Unique id, used in the database, the URLs and the i18n keys. | `"alg.linear.two-step"` |
| `version` | `string` | Raise it whenever `generate`, `solve` or the mistakes change. Stored questions are rebuilt from their seeds, and teach sessions and proofs only count on the current version. | `"1.0.0"` |
| `statement` | `string` | What the skill is, for developers and the Skill Author. Screens use the i18n title instead. | `"Solve two-step equations such as 5x − 3 = −8."` |
| `prerequisites` | `string[]` | Ids of the skills that must be mastered first. They must come earlier in `SKILLS`. | `["alg.linear.one-step"]` |
| `answerKind` | `"number" \| "expression"` | How the child's typed answer is read. | `"number"` |
| `generate(rng)` | `(Rng) => Instance` | Makes a question from the seeded `rng` only. It must keep trying until `mistakesAreSound` holds (below), and throw after a fixed number of tries. | `a·x + b = d`: a from −9 to 9 (not 0 or ±1), b from −12 to 12 (not 0), a whole-number answer from −12 to 12 (not 0) |
| `solve(instance)` | `(Instance) => { trace, answer }` | The correct working and answer. The trace starts with the question. | `5x − 3 = −8` → `5x = −8 + 3` → `5x = −5` → `x = −1` |
| `checkLine(instance, line, typed)` | `=> LineCheck` | Checks a line the child typed in "Teach the Shishya" at position `line` (2, 3, …) of the correct working. Built from the checkers in `src/core/lineCheck.ts`. | `checkEquationLine`: the typed equation must be equivalent to the question and a real step; the last line must be `x = a number` |
| `mistakes` | `Mistake[]` | The known mistakes (below). | `divided-first`, `kept-const-sign`, `forgot-to-divide` |
| `hintLadder` | 4 strings | Four hints, from a gentle nudge to a worked example. NCERT words; a hint never contains an answer (the example uses other numbers, or `y` instead of `x`). | Hint 4: "An example with y: 3y + 4 = 25 gives 3y = 25 − 4 = 21, so y = 21 ÷ 3 = 7." |
| `teachRule` | `{ traces: 3; distinctMistakesMin: 2; triesMax: 2 }` | To earn "Taught the Shishya", the child fixes the Shishya's first wrong line on 3 questions in one session, covering at least 2 different mistakes, each within 2 tries. The type allows only these values. | same |
| `proofRule` | `{ solve: 3; apply: 1; allCorrect: true }` | "Show it alone": 3 questions and 1 word problem, all correct, no hints, no AI help (within 30 minutes). The type allows only these values. | same |

Besides the spec, the skill file exports a word-problem generator `(rng) => ApplyItem`. Both are registered together
in `src/core/skills/index.ts` as `{ spec, generateApply }`. The two-step skill's story is an auto-rickshaw fare: a
fixed charge plus a charge per km, and the child finds how many km the ride was.

## Mistake, field by field

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Unique within the skill, e.g. `kept-const-sign`. |
| `label` | `string` | For the teacher: names the mistake. |
| `childLabel` | `string` | For the child, in the NCERT textbook's language: what went wrong and the correct step. Never tells the child to do the mistake, never says "move" or "change the sign". The same text must be in `src/i18n/en.ts` as `mistake.<skillId>.<id>`, with a Hindi line in `hi.ts`. |
| `childText` | optional | Only for mined mistakes: the key and numbers of the fixed message for the step type, so screens can show it in Hindi. |
| `stepType` | `"move-x" \| "move-const" \| "simplify" \| "divide" \| "sign" \| "operation"` | Which kind of step goes wrong. (These are internal names; children never see them.) |
| `origin` | `"authored" \| "mined"` | Written by a person in a skill file, or found by the Misconception Miner. |
| `appliesTo(instance)` | optional | Only some questions can show this mistake (for example "minus a negative" needs `a − (−n)`). Default: every question. |
| `apply(instance)` | `=> { trace, answer, firstWrongLine }` | The Shishya's wrong working, its wrong answer, and the first line that is wrong (1-based; line 1 is the question, so it is 2 or more). |

The two-step skill's mistakes, for `5x − 3 = −8`:

| `id` | `stepType` | Wrong working | Answer | `firstWrongLine` |
| --- | --- | --- | --- | --- |
| `divided-first` | `divide` | `x − 3 = −8/5` → `x = 7/5` | `7/5` | 2 |
| `kept-const-sign` | `move-const` | `5x = −8 − 3` → `5x = −11` → `x = −11/5` | `−11/5` | 2 |
| `forgot-to-divide` | `divide` | `5x = −8 + 3` → `5x = −5` → `x = −5` | `−5` | 4 |

Example, `kept-const-sign` from the file:

```ts
const keptConstSign: Mistake = {
  id: "kept-const-sign",
  label: "Took the constant across without the opposite operation: a·x = d + b",
  childLabel:
    "To remove a number from one side, do the opposite operation on both sides. To remove − 3, add 3 to both sides. To remove + 3, subtract 3 from both sides.",
  stepType: "move-const",
  origin: "authored",
  apply(inst) {
    const p = P(inst);
    const v = frac(p.d + p.b, p.a);
    const lines = [
      questionText(p),
      formatEquation([[p.a, true]], [[p.d, false], [p.b, false]]),
      formatEquation([[p.a, true]], [[p.d + p.b, false]]),
      xEquals(v),
    ];
    return { trace: toTrace(lines), answer: v, firstWrongLine: 2 };
  },
};
```

## The rule every generator keeps: `mistakesAreSound`

`mistakesAreSound(instance, mistakes)` in `src/core/skills/helpers.ts` is true when at least one mistake applies to
the question, and the correct answer and the answers of all the mistakes that apply are all different. Every
`generate()` rejects questions where it is false, so a wrong answer points to at most one mistake, and `diagnose()`
never has to guess. (If two mistakes gave the same answer, `diagnose()` would say "unknown".) From the two-step skill:

```ts
function generate(rng: Rng): Instance {
  for (let i = 0; i < MAX_TRIES; i++) {
    const a = nonZero(rng, 9);
    const b = nonZero(rng, 12);
    const x = nonZero(rng, 12);
    if (Math.abs(a) < 2) continue;
    const inst = makeTwoStepInstance({ a, b, d: a * x + b }, rng.seed);
    if (mistakesAreSound(inst, mistakes)) return inst;
  }
  throw new Error(`${SKILL_ID}: no valid question after ${MAX_TRIES} tries (seed ${rng.seed})`);
}
```

## The tests every skill passes

`describeSkillProperties` in `src/core/__tests__/skill-properties.ts` runs the same property tests on every skill,
over 1,000 seeded questions:

- the same seed gives the same question; `solve()` gives the question's answer; the working starts with the question;
- every mistake that applies never gives the correct answer, the mistakes' answers all differ, and each
  `firstWrongLine` really is the first line that differs from the correct working;
- `checkLine` accepts every correct line and rejects each mistake's first wrong line;
- `diagnose()` names each mistake from its answer;
- word problems are valid questions of the skill, in English and Hindi;
- hints and child labels use NCERT words, and (with the `leak` option) hints never give away the answer.

The two-step test file (`src/core/__tests__/linear-two-step.test.ts`) also checks the worked example `5x − 3 = −8`
exactly, line by line for each mistake, and the generator's ranges.

## Mined mistakes (JSON)

The Misconception Miner (an AI agent) may only propose a mistake as **data, never code**: a JSON object of type
`MinedMistakeSpec`. Today it works on `alg.linear.both-sides`, whose questions are `a·x + b = c·x + d` and whose
correct working has 5 lines, for example `4x − 3 = 2x + 7` → `4x − 2x − 3 = 7` → `4x − 2x = 7 + 3` → `2x = 10` → `x = 5`.

| Field | Rules |
| --- | --- |
| `id` | 3–40 characters: lower-case letters, digits or `-`, starting with a letter. Not used by any existing mistake. |
| `label` | For the teacher. Text of 1–300 characters. |
| `childLabel` | The AI's suggestion for the child. Text of 1–300 characters, no "move" or "change the sign". **Children never see it**: they see the fixed message for the step type (`src/core/childMessages.ts`), unless the teacher writes their own words when approving. |
| `stepType` | One of `move-x`, `move-const`, `simplify`, `divide`. |
| `firstWrongLine` | A whole number from 2 to the number of lines in the correct working (5). |
| `lines` | The Shishya's wrong lines: exactly one key for every line from `firstWrongLine` to the last (`"3"`, `"4"`, `"5"`). Each value is a template: outside `{…}` only `x`, whole numbers, spaces, `+`, `−` and `=`; inside `{…}` a formula. At most 200 characters. Lines before `firstWrongLine` are copied from the correct working. |
| `answerFormula` | The wrong answer as a formula. Formulas use only `a`, `b`, `c`, `d`, whole numbers (up to 6 digits), `+ − × ÷` (or `+ - * /`) and brackets; at most 200 characters. They are worked out by Shishya's own small exact-fraction evaluator: no `eval`, no `Function`. |

Example: the proposal from the real Miner run of 2026-10-19 ("divides by the a of the question, not by the collected
number in front of x"):

```json
{
  "id": "divide-by-original-a",
  "label": "Divides by the x-coefficient from the question, not the collected one",
  "childLabel": "First collect the x-terms, then divide both sides by the number in front of x in that line.",
  "stepType": "divide",
  "firstWrongLine": 5,
  "lines": { "5": "x = {(d - b) / a}" },
  "answerFormula": "(d - b) / a"
}
```

For `4x − 3 = 2x + 7` (a = 4, b = −3, c = 2, d = 7), lines 1–4 are the correct working and line 5 becomes
`x = 5/2`. (The `label` and `childLabel` above are illustrations; that run's own texts were not recorded.)

`validateMinedMistake` accepts a proposal only if all of these hold:

1. the shape follows the rules in the table above;
2. it reproduces at least 3 of the logged wrong answers that no known mistake explains;
3. on 1,000 generated questions it never gives the correct answer and never divides by zero;
4. it gives the same answer as any one existing mistake on at most 10% of those questions;
5. its last line is always `x = <answerFormula>`;
6. its first wrong line is really wrong: different from the correct line and not equivalent to the question.

A proposal that passes is saved as a draft (`DRAFT_TESTED`) in the `minedMistakes` table. A teacher reads it on the
class board, with the wrong answers it explains and the 4 checks, and approves (`APPROVED`) or rejects (`REJECTED`)
it. Only approved mistakes are used, and they never change any child's mastery. The table's `childLabelSource`
column says whether the child sees the fixed message (`ai`, the default) or the teacher's own words (`teacher`).

## Use our mistakes in your own tutor: `GET /api/mistakes`

Every Shishya server publishes its mistake library as JSON at `/api/mistakes` (MIT licence, cached for 5 minutes,
`Cache-Control: public, max-age=300`). It is built only from the skill code and the mistake specs teachers have
approved, so it never holds child data: no child or class codes, no answers, no counts, no drafts or rejected
mistakes, no record of who approved a mistake, and never the AI's suggested child text.

```json
{
  "licence": "MIT",
  "spec": "https://github.com/nileshdas092006-hash/shishya-code_for_a_billion/blob/main/docs/SKILL_SPEC.md",
  "about": "Shishya's algebra mistakes: …",
  "skills": [
    {
      "skillId": "alg.linear.two-step",
      "version": "1.0.0",
      "statement": "Solve two-step equations such as 5x − 3 = −8.",
      "answerKind": "number",
      "mistakes": [
        {
          "id": "divided-first",
          "label": "Divided before removing the constant (divided only d by a): x = d ÷ a − b",
          "stepType": "divide",
          "origin": "authored",
          "firstWrongLine": 2,
          "example": { "question": "3x − 12 = −9", "working": ["3x − 12 = −9", "x − 12 = −3", "x = 9"], "result": "9" }
        }
      ]
    },
    {
      "skillId": "alg.linear.both-sides",
      "mistakes": [
        {
          "id": "divide-by-original-a",
          "label": "… (the label the teacher approved)",
          "stepType": "divide",
          "origin": "mined",
          "firstWrongLine": 5,
          "lines": { "5": "x = {(d - b) / a}" },
          "answerFormula": "(d - b) / a",
          "example": { "question": "…", "working": ["…"], "result": "…" }
        }
      ]
    }
  ]
}
```

Shortened above: every skill has all of its fields and lists all of its mistakes. The mined mistake is the one
from the real 2026-10-19 Miner run, shown as it would appear once a teacher approves it.

- `skills`: every skill, in teaching order, with its `skillId` and `version` (a mistake belongs to that version).
- An **authored** mistake is code in `src/core/skills/`; its `firstWrongLine` is the one on its `example`.
- A **mined** mistake is the JSON spec described in the section above (`lines` templates and `answerFormula`, in the
  numbers a, b, c, d of `a·x + b = c·x + d`), approved by a teacher.
- `example`: the first generated question (seeds 1, 2, …) the mistake makes sense for, worked through with the
  mistake by src/core: the question, every working line (line 1 is the question) and the wrong result it leads to.
