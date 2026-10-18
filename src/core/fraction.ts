/** An exact fraction. Always simplified, with den > 0. */
export type Fraction = { readonly num: number; readonly den: number };

const gcd = (x: number, y: number): number => {
  x = Math.abs(x);
  y = Math.abs(y);
  while (y) [x, y] = [y, x % y];
  return x;
};

export function frac(num: number, den = 1): Fraction {
  if (!Number.isInteger(num) || !Number.isInteger(den)) throw new Error("Fraction parts must be whole numbers");
  if (den === 0) throw new Error("Fraction denominator cannot be 0");
  if (num === 0) return { num: 0, den: 1 };
  const g = gcd(num, den);
  const sign = den < 0 ? -1 : 1;
  return { num: (sign * num) / g, den: (sign * den) / g };
}

export const add = (x: Fraction, y: Fraction) => frac(x.num * y.den + y.num * x.den, x.den * y.den);
export const sub = (x: Fraction, y: Fraction) => frac(x.num * y.den - y.num * x.den, x.den * y.den);
export const mul = (x: Fraction, y: Fraction) => frac(x.num * y.num, x.den * y.den);
export const div = (x: Fraction, y: Fraction) => frac(x.num * y.den, x.den * y.num);
export const equals = (x: Fraction, y: Fraction) => x.num === y.num && x.den === y.den;

/** "5/3", "5", "-7/2" (plain ASCII; traces use their own prettier minus sign). */
export const toString = (f: Fraction) => (f.den === 1 ? `${f.num}` : `${f.num}/${f.den}`);
