Task 3: the equation checker (used by "Teach the Shishya") and the word-problem ("apply") item. Pure code in src/core.
Read CLAUDE.md first. Tests first. Work autonomously.

A. Linear-equation parser (src/core/equation.ts)
 - Parse a typed equation in one variable x, e.g. "4x - 2x - 3 = 7", "4x−2x−3=7", "2x = 10", "x = 5", "-x + 4 = 2x", "10 = 2x".
   Accept ASCII "-" and Unicode "−", optional spaces, integer coefficients, an implied coefficient of 1 ("x", "-x").
   Brackets are NOT needed yet.
 - Each side becomes a list of terms, and also a simplified linear expression { xCoef: Fraction, constant: Fraction }.
 - parseEquation(text) returns { ok: true, equation } or { ok: false, error: "<child-friendly reason>" }. It must NEVER throw.
 - root(equation): the single solution as a Fraction, or "none" / "all" for special cases.
 - equivalent(e1, e2): true only if both have exactly one solution and the solutions are equal.

B. Target forms (src/core/targetForm.ts), for the 5-line trace of linear-both-sides:
 - After line 2 (x-terms collected on the left): no x-term on the right side.
 - After line 3: the left side has only x-terms, the right side has only numbers.
 - After line 4: the left side is a single x-term, the right side is a single number.
 - After line 5: the left side is exactly "x" (coefficient 1), the right side is a single number.
 A child may combine steps early (for example "2x − 3 = 7" is fine for line 2), as long as the line is equivalent to the
 original equation AND satisfies the target form for that line.

C. Teach check (src/core/teach.ts)
 - checkTeachStep(instance, mistakeId, tappedLine, typedLine) returns
   { lineCorrect: boolean, fixAccepted: boolean, feedback: string }.
   lineCorrect = the child tapped the mistake's first wrong line.
   fixAccepted = typedLine parses, is equivalent to the original equation, and meets that line's target form.
   feedback is child-friendly, NCERT language, and never states the final answer.

D. Apply item (word problem) for alg.linear.both-sides (src/core/skills/linear-both-sides-apply.ts)
 - Template (Indian context): "Taxi A charges ₹a per km plus a fixed ₹b. Taxi B charges ₹c per km plus a fixed ₹d.
   For how many km do both taxis cost the same?" Equation a·x + b = c·x + d.
 - Constraints: a, b, c, d positive whole numbers; a ≠ c; b ≠ d; the answer is a positive whole number ≤ 50;
   realistic values (per-km ₹8–₹30, fixed ₹20–₹300). Seeded, like the main generator.
 - Also add a Hindi version of the template text (keep the numbers the same).

E. Tests
 - Parser: all the example strings above, plus garbage ("4x ==", "abc", "") returning ok:false with no exception.
 - Property test over 1,000 seeds: every line of the correct trace parses and is equivalent to the original equation;
   each authored mistake's first wrong line parses and is NOT equivalent.
 - Teach: for 4x − 3 = 2x + 7 with mistake kept-x-sign, tapping line 2 and typing "4x − 2x − 3 = 7" is accepted;
   "2x − 3 = 7" is accepted; "4x + 2x − 3 = 7" is rejected; "4x − 3 − 7 = 2x" is rejected (x still on the right);
   tapping line 3 gives lineCorrect=false.
 - Apply: 1,000 seeds all meet the constraints, and the answer satisfies the equation.
Run npm test until all pass, commit "Core: equation checker, teach check, apply item", update BUILD_LOG.md, and explain in
plain English how the checker decides that a typed line is a correct fix.
