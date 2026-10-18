# Shishya

Shishya finds the exact algebra step each child gets wrong, lets them fix it by teaching the Shishya, and uses code (not AI) to decide when they have truly learned it.

## Run it

Needs Node.js 22.18 or newer (24 recommended).

```bash
npm install
npm run dev   # open http://localhost:3000
npm test      # run the unit tests
```

Demo data (kept apart from pilot data, in `data/demo.db`, and shown with a DEMO banner):

```bash
npm run seed:demo   # creates a demo class (PIN 123456), 5 demo students and some practice answers
npm run dev:demo    # runs the app on the demo data
```

On a laptop, pilot data lives in `data/shishya.db` (not in git). Settings are listed in [.env.example](.env.example);
copy it to `.env.local` to change them (`.env.local` is never committed).

## The Misconception Miner (AI agent)

When children give wrong answers that no known mistake explains, the Miner proposes one new mistake as data (never
code), checks it with code on 1,000 generated questions, and saves a tested draft. A teacher approves or rejects it on
the class board; only approved mistakes are used, and they never change any child's mastery.

```bash
npm run miner -- alg.linear.both-sides          # needs GROQ_API_KEY or OPENROUTER_API_KEY in .env.local (free tiers)
npm run miner -- alg.linear.both-sides --fake   # offline FAKE model, no key
```

The AI only ever sees anonymous numbers (the question's a, b, c, d and the wrong answer). Each AI call is logged,
without keys or messages, in `data/agent-runs.jsonl`.

## Deploy to Vercel

Vercel does not keep files between requests, so in the cloud the data lives in a free hosted
[Turso](https://turso.tech) database (libSQL, the same SQL as the local file).

1. **Create the database.** Sign up at turso.tech (free plan) and create a database, for example `shishya`
   (in the dashboard, or with the Turso CLI: `turso db create shishya`).
2. **Copy its URL and a token.** The URL looks like `libsql://shishya-<your-org>.turso.io`
   (`turso db show shishya --url`). Create an auth token (`turso db tokens create shishya`).
   Treat the token like a password: never paste it into code, chat or git.
3. **Make a session secret.** `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
4. **Import the project in Vercel.** Push this repository to GitHub, then in Vercel choose *Add New → Project*,
   pick the repository, and keep the detected Next.js settings.
5. **Set the environment variables** (Vercel → Project → Settings → Environment Variables):
   - `DATABASE_URL` = the Turso URL
   - `DATABASE_AUTH_TOKEN` = the Turso token
   - `SESSION_SECRET` = the secret from step 3
   - `PROOF_COOLDOWN_HOURS` = `24`
6. **Deploy.** The tables are created automatically on the first request. Open the Vercel link, go to
   `/teacher` and create the real class there (the demo seed is only for laptops).

If a token is ever exposed, revoke it in Turso, create a new one and update `DATABASE_AUTH_TOKEN` in Vercel.

## Licence

MIT, see [LICENSE](LICENSE).
