import { asFraction } from "../answer";
import { randInt, type Rng } from "../rng";
import type { ApplyItem } from "../types";
import { makeInstance } from "./linear-both-sides";

// The "apply" (word problem) item for alg.linear.both-sides: two taxis, a·x + b = c·x + d.

export type { ApplyItem } from "../types";

const MAX_TRIES = 1000;

function storyEn(a: number, b: number, c: number, d: number): string {
  return (
    `Taxi A charges ₹${a} per km plus a fixed ₹${b}. Taxi B charges ₹${c} per km plus a fixed ₹${d}. ` +
    "For how many km do both taxis cost the same?"
  );
}

function storyHi(a: number, b: number, c: number, d: number): string {
  return (
    `टैक्सी A ₹${a} प्रति किमी और ₹${b} तय शुल्क लेती है। टैक्सी B ₹${c} प्रति किमी और ₹${d} तय शुल्क लेती है। ` +
    "कितने किमी पर दोनों टैक्सियों का किराया बराबर होगा?"
  );
}

/** Per-km fares ₹8–₹30; fixed charges ₹20–₹300 in steps of ₹10; the answer is a whole number of km, 1 to 50. */
export function generateApply(rng: Rng): ApplyItem {
  for (let i = 0; i < MAX_TRIES; i++) {
    const a = randInt(rng, 8, 30);
    const c = randInt(rng, 8, 30);
    const b = 10 * randInt(rng, 2, 30);
    const d = 10 * randInt(rng, 2, 30);
    if (a === c || b === d) continue;
    const instance = makeInstance({ a, b, c, d }, rng.seed);
    const x = asFraction(instance.answer);
    if (x.den !== 1 || x.num <= 0 || x.num > 50) continue;
    return { instance, text: storyEn(a, b, c, d), textHi: storyHi(a, b, c, d) };
  }
  throw new Error(`taxi apply item: no valid item after ${MAX_TRIES} tries (seed ${rng.seed})`);
}
