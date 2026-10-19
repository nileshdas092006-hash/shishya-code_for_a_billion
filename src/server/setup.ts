// Server settings the cloud needs. A missing one is a SetupError: pages and actions show a friendly
// "not set up yet" message, and only the server log names the setting (never its value).

type Env = Record<string, string | undefined>;

export const MIN_SECRET_LENGTH = 32;

export class SetupError extends Error {
  constructor(
    readonly setting: string,
    message: string,
  ) {
    super(message);
    this.name = "SetupError";
  }
}

export const isSetupError = (e: unknown): e is SetupError => e instanceof SetupError;

const isProduction = (env: Env) => env.NODE_ENV === "production";

/** Which required settings are missing or invalid. On a laptop nothing is required (local fallbacks are used). */
export function checkSetup(env: Env = process.env): { ok: true } | { ok: false; missing: string[] } {
  if (!isProduction(env)) return { ok: true };
  const missing: string[] = [];
  if ((env.SESSION_SECRET?.trim().length ?? 0) < MIN_SECRET_LENGTH) missing.push("SESSION_SECRET");
  if (!env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  return missing.length ? { ok: false, missing } : { ok: true };
}

/** Throws a SetupError naming the first missing setting. */
export function requireSetup(env: Env = process.env): void {
  const r = checkSetup(env);
  if (!r.ok) throw new SetupError(r.missing[0], `Server setting missing or invalid: ${r.missing.join(", ")} (see README, Deploy to Vercel).`);
}

/** Server log line for an error a page or action turned into a friendly message. */
export function logServerError(where: string, e: unknown): void {
  console.error(`[shishya] ${where}:`, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
}
