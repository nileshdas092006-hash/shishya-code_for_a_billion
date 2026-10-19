import { join } from "node:path";
import { createServices, type Services } from "./services";
import { loadSessionSecret } from "./session";
import { MIN_SECRET_LENGTH, requireSetup, SetupError } from "./setup";
import { DEFAULT_DATABASE_URL, openStore, type StoreConfig } from "./store";

// One database client and one services object for the running web app.
//   DATABASE_URL         file:data/shishya.db on a laptop (the default), libsql://… for Turso in the cloud.
//                        The demo uses file:data/demo.db and is always labelled DEMO on screen.
//   DATABASE_AUTH_TOKEN  Turso only.
//   SESSION_SECRET       required in production; on a laptop a random one is kept in data/.session-secret.
// In production nothing here writes to the local disk: Vercel's disk is not kept between requests.

export { checkSetup, isSetupError, requireSetup, SetupError } from "./setup";

type Env = Record<string, string | undefined>;

export function databaseConfig(env: Env = process.env): Required<Pick<StoreConfig, "url">> & StoreConfig {
  const url = env.DATABASE_URL?.trim() || (env.NODE_ENV === "production" ? "" : DEFAULT_DATABASE_URL);
  if (!url) throw new SetupError("DATABASE_URL", "DATABASE_URL is not set. In production use your Turso URL (see .env.example and README).");
  return { url, authToken: env.DATABASE_AUTH_TOKEN?.trim() || undefined };
}

/** The session secret: SESSION_SECRET (32+ characters), or on a laptop a random one kept in data/.session-secret. */
export function sessionSecretFrom(env: Env = process.env): string {
  const fromEnv = env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= MIN_SECRET_LENGTH) return fromEnv;
  if (env.NODE_ENV === "production") throw new SetupError("SESSION_SECRET", "SESSION_SECRET (32+ characters) must be set in production.");
  return loadSessionSecret(join(process.cwd(), "data", ".session-secret"));
}

/** True when the app runs on the demo database (never mixed with pilot data). */
export const IS_DEMO = /(^|[/\\:])demo\.db$/.test(process.env.DATABASE_URL?.trim() ?? "");

type Shared = { services?: Promise<Services>; secret?: string };
const holder = globalThis as typeof globalThis & { __shishya?: Shared };
const shared = (): Shared => (holder.__shishya ??= {});

/** Kept on globalThis so the dev server's hot reload does not open a new client on every edit. */
export function getServices(): Promise<Services> {
  const s = shared();
  s.services ??= Promise.resolve()
    .then(() => openStore(databaseConfig()))
    .then((store) => createServices(store, { checkSetup: () => requireSetup() }))
    .catch((e) => {
      s.services = undefined; // try again on the next request
      throw e;
    });
  return s.services;
}

export function getSessionSecret(): string {
  const s = shared();
  s.secret ??= sessionSecretFrom();
  return s.secret;
}
