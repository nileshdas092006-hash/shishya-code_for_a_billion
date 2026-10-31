// The few statistics the impact page needs, written by hand (no dependency) and tested against printed tables:
// Student's t distribution (through the regularised incomplete beta function), a paired mean difference with its
// 95% t-interval, and the difference of two group means with Welch's 95% t-interval. Pure.

/** ln Γ(x) for x > 0 (Lanczos, g = 7, 9 terms; about 15 correct digits). */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** The continued fraction of the incomplete beta function (modified Lentz). */
function betaFraction(a: number, b: number, x: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const step = d * c;
    h *= step;
    if (Math.abs(step - 1) < 1e-15) break;
  }
  return h;
}

/** The regularised incomplete beta function I_x(a, b). */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaFraction(a, b, x)) / a : 1 - (front * betaFraction(b, a, 1 - x)) / b;
}

/** P(T ≤ t) for Student's t with df degrees of freedom (df may be fractional, as in Welch's test). */
export function tCdf(t: number, df: number): number {
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** The t value with P(T ≤ t) = p (for p > 0.5), by bisection. */
export function tQuantile(p: number, df: number): number {
  let lo = 0;
  let hi = 1e4;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
/** The sample variance (n − 1 below the line). */
const variance = (xs: number[]) => {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
};

/** Before and after for the same students (in the same order): the means, the mean difference and its 95% t-interval. Needs n ≥ 2. */
export function paired(before: number[], after: number[]) {
  if (before.length !== after.length || before.length < 2) throw new Error("paired: needs two lists of the same length, 2 or more");
  const diffs = after.map((a, i) => a - before[i]);
  const n = diffs.length;
  const d = mean(diffs);
  const half = tQuantile(0.975, n - 1) * Math.sqrt(variance(diffs) / n);
  return { n, before: mean(before), after: mean(after), difference: d, ci95: [d - half, d + half] as [number, number] };
}

/** mean(b) − mean(a), with Welch's 95% t-interval (unequal variances; Welch–Satterthwaite degrees of freedom). Needs 2+ in each. */
export function welch(a: number[], b: number[]) {
  if (a.length < 2 || b.length < 2) throw new Error("welch: needs 2 or more in each group");
  const va = variance(a) / a.length;
  const vb = variance(b) / b.length;
  const difference = mean(b) - mean(a);
  const se = Math.sqrt(va + vb);
  if (se === 0) return { difference, df: a.length + b.length - 2, ci95: [difference, difference] as [number, number] };
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  const half = tQuantile(0.975, df) * se;
  return { difference, df, ci95: [difference - half, difference + half] as [number, number] };
}
