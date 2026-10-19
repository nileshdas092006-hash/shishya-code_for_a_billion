# alg.linear.two-step: two-step equations (skill 4, after one-step; leads to variables on both sides)

1. Generates `a·x + b = d`, e.g. `5x − 3 = −8`: a from −9 to 9 (not 0 or ±1), b from −12 to 12 (not 0), a whole-number answer −12…12 (not 0).
2. Working: `5x = −8 + 3`, then `5x = −5`, then `x = −1`.
3. Mistake **divided-first**: divides only d by a before removing b. `5x − 3 = −8` → `x − 3 = −8/5`, so `x = 7/5`.
4. Mistake **kept-const-sign**: takes b across without the opposite operation. `5x − 3 = −8` → `5x = −8 − 3 = −11`, so `x = −11/5`.
5. Mistake **forgot-to-divide**: stops at `5x = −5` and writes `x = −5`.
6. All three mistakes apply to every question; the generator rejects questions where two of them give the same answer.
7. The Teach checker accepts any equivalent equation that is a real step; the last line must be `x = a number`.
8. The word problem is an auto-rickshaw fare: a fixed charge plus a charge per km, giving a whole number of km.
9. Check by hand: "divided-first" shows a fraction (`−8/5`) in the Shishya's line; is that confusing for Class 8 children, or a good thing to spot?
10. Check by hand: the Hindi auto-rickshaw story and the hints, with a Hindi-medium teacher.
