// Child-safety rules that every screen must ask before showing anything AI.
// Children under 13 (Class 7) never see an AI chat. The AI tutor does not exist yet and is off by default.

export type AiFlags = { aiTutorEnabled: boolean };

export const aiFlagsFromEnv = (env: Record<string, string | undefined> = process.env): AiFlags => ({
  aiTutorEnabled: env.AI_TUTOR_ENABLED === "1",
});

/** True only for Class 8+ classes with AI allowed, and only when the AI tutor is switched on. */
export function canShowAiChat(cls: { grade: number; aiAllowed: boolean }, flags: AiFlags = { aiTutorEnabled: false }): boolean {
  return cls.grade >= 8 && cls.aiAllowed && flags.aiTutorEnabled;
}
