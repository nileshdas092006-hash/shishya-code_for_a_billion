import type { Equation, Term } from "./equation";

// The shape each line of the 5-line linear-both-sides trace must have.
// A child may combine steps early, so these check the shape only; equivalence is checked separately.

export type TraceLineNumber = 2 | 3 | 4 | 5;

const isX = (t: Term) => t.hasX;
const isNumber = (t: Term) => !t.hasX;

export function meetsTargetForm(eq: Equation, line: TraceLineNumber): boolean {
  const { left, right } = eq;
  switch (line) {
    case 2: // x-terms collected on the left: no x-term on the right
      return right.terms.every(isNumber);
    case 3: // left only x-terms, right only numbers
      return left.terms.every(isX) && right.terms.every(isNumber);
    case 4: // one x-term = one number
      return left.terms.length === 1 && isX(left.terms[0]) && right.terms.length === 1 && isNumber(right.terms[0]);
    case 5: // exactly x = one number
      return (
        left.terms.length === 1 &&
        isX(left.terms[0]) &&
        left.terms[0].coef.num === 1 &&
        left.terms[0].coef.den === 1 &&
        right.terms.length === 1 &&
        isNumber(right.terms[0])
      );
  }
}
