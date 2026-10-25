# Shishya

Shishya is a free, open-source algebra practice app for Class 7–9 children in India's crowded classrooms. It finds the
exact step of an equation each child gets wrong, lets the child fix it by "teaching the Shishya" (a classmate character
whose working has a mistake), and then asks for proof. No AI help inside the proof. It opens only when the teacher
opens it in class. Code, not AI, decides when a child has truly learned a skill. Two AI agents help behind the scenes,
always checked by code and approved by a teacher: the Misconception Miner turns unexplained wrong answers into new
mistake patterns, and the Skill Author drafts new skills.
No names are stored, children under 13 never see an AI chat, and every child-facing word follows the NCERT textbook,
in English and Hindi.

**Live demo:** _coming soon (link will be added here after deploying to Vercel)_

**Built with AgentFoundry** (all app code was written in AgentFoundry with Claude Code; see [BUILD_LOG.md](BUILD_LOG.md)).

## Run it locally

Needs Node.js 22.18 or newer (24 recommended).

```bash
npm install
npm run dev   # open http://localhost:3000
```

## Run the tests

```bash
npm test        # unit, property and end-to-end server tests (Vitest)
npm run lint    # ESLint, including the rule that keeps src/core pure
npm run build   # production build
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

## Skills and the Skill Author (AI agent)

Five skills form a chain: integers → like terms → one-step equations → two-step equations → variables on both sides
(`src/core/skills/`, notes in `docs/skills/`). Every skill passes the same property tests over 1,000 generated questions.

The Skill Author drafts a new skill and its tests on a separate branch, never touching your working folder:

```bash
npm run author -- alg.integers.multiply "Multiply and divide integers, like −3 × 4 = −12"
```

It may only create files in `src/core/skills` and `src/core/__tests__`, may only run `npm test`, stops when the tests
pass (or after 20 turns), commits on branch `author/<skillId>`, prints a review checklist, and never merges.

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
