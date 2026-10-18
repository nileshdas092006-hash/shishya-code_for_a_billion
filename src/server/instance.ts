import { basename, dirname, join, resolve } from "node:path";
import { createServices, type Services } from "./services";
import { loadSessionSecret } from "./session";
import { DEFAULT_DB_FILE, openStore } from "./store";

// One database connection and one services object for the running web app.
// SHISHYA_DB_FILE picks the database (default data/shishya.db). The demo database is data/demo.db and is
// always labelled DEMO on screen, so it is never mixed up with pilot data.

export const DB_FILE = process.env.SHISHYA_DB_FILE ? resolve(process.env.SHISHYA_DB_FILE) : DEFAULT_DB_FILE;
export const IS_DEMO = basename(DB_FILE) === "demo.db";

type Shared = { services: Services; secret: string };
const holder = globalThis as typeof globalThis & { __shishya?: Shared };

function shared(): Shared {
  // Kept on globalThis so the dev server's hot reload does not open a new connection on every edit.
  holder.__shishya ??= {
    services: createServices(openStore(DB_FILE)),
    secret: loadSessionSecret(join(dirname(DB_FILE), ".session-secret")),
  };
  return holder.__shishya;
}

export const getServices = () => shared().services;
export const getSessionSecret = () => shared().secret;
