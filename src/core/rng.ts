/** A seeded random generator. The same seed always gives the same sequence. */
export type Rng = { readonly seed: number; next(): number };

/** mulberry32: returns numbers in [0, 1). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    seed,
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** A whole number from lo to hi, both included. */
export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));
