Task 2: the maths core for ONE skill, "variables on both sides" (id: alg.linear.both-sides, version 1.0.0).
Read CLAUDE.md first. Show me your plan before writing code. Tests first.

A. Types (src/core/types.ts) and exact fractions (src/core/fraction.ts)
 - Fraction {num, den}: always simplified, den > 0. Helpers: add, sub, mul, div, equals, toString ("5/3", "5", "-7/2").
 - Instance: { skillId, version, seed, params: {a, b, c, d}, text (e.g. "4x − 3 = 2x + 7"), answer: Fraction }
 - Trace = array of lines, each { text: string }
 - Mistake: { id, label (for the teacher), childLabel (for the child, NCERT language), stepType: "move-x" | "move-const" | "simplify" | "divide",
   origin: "authored" | "mined", apply(instance) => { trace, answer: Fraction, firstWrongLine: number } }
 - SkillSpec: { id, version, statement, prerequisites: string[], generate(rng) => Instance, solve(instance) => { trace, answer },
   mistakes: Mistake[], hintLadder: [string, string, string, string],
   teachRule: { traces: 3, distinctMistakesMin: 2, triesMax: 2 }, proofRule: { solve: 3, apply: 1, allCorrect: true } }

B. Seeded random generator (src/core/rng.ts): mulberry32, so the same seed always gives the same question.

C. The skill (src/core/skills/linear-both-sides.ts), for equations a·x + b = c·x + d
 - Generator rules: a, b, c, d are whole numbers in [−12, 12], none of them 0; a ≠ c; b ≠ d; a + c ≠ 0; |a − c| ≠ 1;
   the answer x = (d − b)/(a − c) is a non-zero whole number with |x| ≤ 12; the answer is not equal to any of a, b, c, d;
   every mistake answer differs from the answer and from every other mistake answer.
   If a sample breaks a rule, sample again (max 1,000 tries, then throw an error).
 - Correct trace (5 lines). For 4x − 3 = 2x + 7 it must be exactly:
   L1 4x − 3 = 2x + 7
   L2 4x − 2x − 3 = 7
   L3 4x − 2x = 7 + 3
   L4 2x = 10
   L5 x = 5
   Print negatives nicely ("4x − 3", never "4x + −3"); coefficient 1 is "x", −1 is "−x".
 - Authored mistakes (each produces its own wrong trace; the first wrong line is in brackets):
   1. kept-x-sign: takes the x-term to the left by adding instead of subtracting → (a + c)x = d − b → x = (d − b)/(a + c).
      Example answer 5/3. [L2: "4x + 2x − 3 = 7"]
   2. dropped-constant: forgets the constant when collecting → (a − c)x = d → x = d/(a − c). Example 7/2. [L3: "4x − 2x = 7"]
   3. kept-const-sign: takes the constant across without the opposite operation → (a − c)x = d + b → x = (d + b)/(a − c).
      Example 2. [L3: "4x − 2x = 7 − 3"]
   4. forgot-to-divide: reaches (a − c)x = d − b, then writes x = d − b. Example 10. [L5: "x = 10"]
   Do NOT add "divides by the original coefficient a" (it would give 5/2). We keep it out on purpose so the Misconception Miner
   agent can discover it later from real children's answers.
 - Hint ladder, 4 levels, never containing the answer: attention → strategy → step → a worked example with different numbers.

D. Diagnosis (src/core/diagnose.ts): given an instance and a wrong answer, return the id of the ONE mistake that reproduces it,
   or "unknown" (also "unknown" if no mistake or more than one mistake matches).

E. Tests (src/core/__tests__/)
 - 4x − 3 = 2x + 7 gives exactly the correct trace above and every example answer above (5, 5/3, 7/2, 2, 10).
 - Property tests over 1,000 seeds: every generator rule holds; substituting the answer makes both sides equal; no mistake ever
   returns the correct answer; all mistake answers are distinct; each mistake's firstWrongLine is the first line that differs from
   the correct trace; the same seed gives the same question; diagnose() returns the right id for each mistake's answer;
   a wrong answer that no mistake produces gives "unknown".

Run `npm test` until everything passes, commit "Core: linear-both-sides skill", update BUILD_LOG.md, and then explain to me in
plain English what a generator, a solver and a mistake function are, using 4x − 3 = 2x + 7 as the example.
