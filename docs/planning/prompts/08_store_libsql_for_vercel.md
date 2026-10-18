Task 8: make the store work on Vercel (free hosting). Read CLAUDE.md first. Work autonomously. Tests first where behaviour changes.

Why: Vercel's servers cannot keep a SQLite file between requests, so all data would be lost. We switch to libSQL, which is
SQLite-compatible: a local file on the laptop (file:data/shishya.db) and Turso's free hosted database in the cloud
(libsql://… URL). Das has approved ONE new dependency for this: @libsql/client.

A. Replace node:sqlite with @libsql/client inside src/server/store.ts ONLY (all SQL stays in that file).
   - Config from env: DATABASE_URL (default file:data/shishya.db; demo: file:data/demo.db) and DATABASE_AUTH_TOKEN (cloud only).
   - libSQL is async: make the store functions async and update mastery.ts, services.ts and the app's server actions to await
     them. Keep every rule: transactions, the unique index on proof items, single answer per item, one open proof per skill.
   - Schema creation runs once at startup (idempotent CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
B. Keep ALL existing tests passing, including the race tests (two connections answering/starting a proof at the same time)
   and the "only mastery.ts writes mastery" scan. Tests use a temporary file: URL per test.
C. Vercel readiness: no writes to the local filesystem in production code paths (data/ is only for local files);
   add .env.example listing DATABASE_URL, DATABASE_AUTH_TOKEN, SESSION_SECRET, PROOF_COOLDOWN_HOURS, LLM_* (no real values);
   make sure `npm run build` passes; add a "Deploy to Vercel" section to README.md (create a Turso database, copy its URL and
   token, set the env vars in Vercel, deploy). Never print or commit real secrets; .env.local stays gitignored.
D. Run npm test, npm run lint, npm run build. Restart the demo dev server (npm run dev:demo) and leave it running.
   Commit "Store: libSQL for local file and Turso", update BUILD_LOG.md, and explain in plain English why Vercel needed this.
