# alg.linear.one-step: one-step equations (skill 3, after like terms)

1. Generates either `x ± b = d` (b from −9 to 9, d from −12 to 12) or `a·x = d` (a from −9 to 9, not 0 or ±1); the answer x is a whole number from −12 to 12, never 0.
2. Working for `x + 7 = 3`: `x + 7 − 7 = 3 − 7`, then `x = −4`. For `4x = −12`: `x = −3`.
3. Mistake **same-operation**: does the same operation instead of the opposite. `x + 7 = 3` → `x = 3 + 7 = 10`; `4x = −12` → `x = −48`.
4. Mistake **divided-wrong-way**: divides a by d. `4x = −12` → `x = −1/3` (correct −3). Only for `a·x = d`.
5. Mistake **sign-error**: right steps, wrong sign. `x + 7 = 3` → `x = 4` (correct −4).
6. The Teach checker accepts any equation equivalent to the question that is a real step; the last line must be `x = a number`.
7. Number sizes are kept small so every line fits a 360px phone on one line (checked by a test).
8. Word problems: marbles (x + b = d), money left after shopping (x − b = d), sharing a bill equally (a·x = d).
9. Check by hand: whether "sign error" is too general a label for the teacher's stuck board (it groups different causes).
10. Check by hand: the NCERT Class 7 Ch 7 wording for "do the same operation on both sides", and the Hindi word संक्रिया.
