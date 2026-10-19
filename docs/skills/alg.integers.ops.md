# alg.integers.ops: adding and subtracting integers (skill 1, no prerequisite)

1. Generates `a + b` or `a − b` with a, b from −12 to 12 (never 0), at least one negative, different sizes; a negative second number is written in brackets: `5 − (−4)`.
2. Working: (for subtraction) add the opposite `5 − (−4) → 5 + 4`; then the sign rule `−7 + 3 → −(7 − 3)`; then the answer `−4`.
3. Mistake **ignores-sign**: adds the sizes and drops the minus signs. `−7 + 3` → `7 + 3 = 10` (correct −4). Only for questions that still have a negative after rewriting.
4. Mistake **minus-negative-as-minus**: reads `a − (−n)` as `a − n`. `5 − (−4)` → `5 − 4 = 1` (correct 9). Only for subtracting a negative.
5. Mistake **sign-of-first**: subtracts the smaller size from the larger but keeps the first number's sign. `3 + (−7)` → `7 − 3 = 4` (correct −4). Only when the first number has the smaller size and the signs differ.
6. Not every mistake fits every question, so each has an "applies to" rule; diagnosis and Teach only use mistakes that apply (every question has at least one).
7. Answers are whole numbers from −24 to 24. The word problem is about temperatures in Leh, Shimla and Kargil.
8. The Teach checker accepts any line with the same value as the question that is a real step; the last line must be one number.
9. Check by hand: are these the three mistakes you see most in Class 7 classrooms? Is "size" (not "absolute value") the right word for KV children?
10. Check by hand: the Hindi words पूर्णांक, योज्य प्रतिलोम and "आकार" for size, with a Hindi-medium teacher.
