/**
 * Where the AI hint tutor (plan item N1) will appear. It does not exist yet, so this renders nothing.
 * `allowed` must come from canShowAiChat() in src/server/policy.ts: Class 7 is never allowed, and Prove never
 * renders this slot at all.
 */
export function AiTutorSlot({ allowed }: { allowed: boolean }) {
  if (!allowed) return null;
  return null;
}
