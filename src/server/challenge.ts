import { DET, DICE } from "../core/challengeCheck";
import { normaliseInput } from "../core/normalise";
import type { Pack } from "../core/types";
import type { StudyArm } from "./store";

// The Shishya Challenge's fixed rules (F11), in one place. Pure: no database, no clock.

/** Equal work in both groups: A practises 8 questions; B practises 4 and then teaches the Shishya once (3 traces). */
export const PRACTISE_TARGET: Record<StudyArm, number> = { A: 8, B: 4 };
/** Group B teaches the Shishya in the practise step; group A never does. */
export const TEACHES: Record<StudyArm, boolean> = { A: false, B: true };
/** The practise step's skill, for both groups. */
export const PRACTISE_SKILL = "alg.linear.both-sides";
/**
 * Each pack's practise step, with equal work in both groups. School: as above. College (F12): A practises 4
 * determinants and 4 dice questions; B practises 2 and 2, and then teaches the Shishya once on determinants. Each set
 * is finished on its own: extra answers on one skill never make up for another.
 */
export type PractisePlan = { sets: Record<StudyArm, { skillId: string; target: number }[]>; teachSkill: string };
export const PRACTISE_PLANS: Record<Pack, PractisePlan> = {
  school: {
    sets: { A: [{ skillId: PRACTISE_SKILL, target: PRACTISE_TARGET.A }], B: [{ skillId: PRACTISE_SKILL, target: PRACTISE_TARGET.B }] },
    teachSkill: PRACTISE_SKILL,
  },
  college: {
    sets: {
      A: [{ skillId: DET, target: 4 }, { skillId: DICE, target: 4 }],
      B: [{ skillId: DET, target: 2 }, { skillId: DICE, target: 2 }],
    },
    teachSkill: DET,
  },
};
/** After this long in the practise step, anyone may go on to the after check. */
export const SKIP_AFTER_MINUTES = 12;
/** The later check opens this many days after the after check, and is not offered after DELAYED_UNTIL_DAYS. */
export const DELAYED_FROM_DAYS = 3;
export const DELAYED_UNTIL_DAYS = 21;
export const COMMENT_MAX = 200;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** A social media handle like @riya_123. */
const HANDLE = /(^|\s)@[\w.]{2,}/;
const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|in|org|net|io|co|me|app|xyz|info|edu|gov|ai|ly|gg|tv|online|site)\b/i;
/** 6 or more digits in a row, also with single spaces, dots or dashes between them (98765 43210, a PIN code). */
const LONG_NUMBER = /\d(?:[\s.-]?\d){5,}/;
/**
 * A student code like 8C-K7QM (with at least one letter after the dash, so maths like 2x-1234 is not one), a college
 * student code like UG-K7QM, or a challenge class code like CH-K7QM: together they log in as that student, so they
 * are never kept in a comment.
 */
const LOGIN_CODE = /\b\d{1,2}[a-z]-(?=[a-z0-9]*[a-z])[a-z0-9]{4}\b|\b(?:ch|ug)-[a-z0-9]{4}\b/i;

/**
 * Why a feedback comment cannot be saved: "tooLong" (over COMMENT_MAX characters) or "personal" (it has an email
 * address, a link, a handle, a long number such as a phone number or PIN code in any keyboard's digits, or a
 * login code). Null when it is fine. The comment is checked as the student typed it, after trimming.
 */
export function commentProblem(comment: string): "tooLong" | "personal" | null {
  if (comment.length > COMMENT_MAX) return "tooLong";
  const text = normaliseInput(comment); // Devanagari and full-width digits read as 0–9
  if (EMAIL.test(text) || HANDLE.test(text) || LINK.test(text) || LONG_NUMBER.test(text) || LOGIN_CODE.test(text)) return "personal";
  return null;
}
