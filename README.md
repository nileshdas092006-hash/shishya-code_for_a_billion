# Shishya

Judges: open the live link and press **Try it as a judge**. It takes 3 minutes and uses a made-up class.

Shishya is a free, open-source algebra practice app for Class 7–9 children in India's crowded classrooms. It finds the
exact step of an equation each child gets wrong, lets the child fix it by "teaching the Shishya" (a classmate character
whose working has a mistake), and then asks for proof. No AI help inside the proof. It opens only when the teacher
opens it in class. Code, not AI, decides when a child has truly learned a skill. Two AI agents help behind the scenes,
always checked by code and approved by a teacher: the Misconception Miner turns unexplained wrong answers into new
mistake patterns, and the Skill Author drafts new skills.
No names are stored, children under 13 never see an AI chat, and every child-facing word follows the NCERT textbook,
in English and Hindi.

**Live demo:** https://shishya-codeforabillion.vercel.app/ (it runs the version the maintainer last deployed, so a
feature below can reach it a little after it reaches this repository).

**Built with AgentFoundry** (all app code was written in AgentFoundry with Claude Code; see [BUILD_LOG.md](BUILD_LOG.md)).

## How it works

Each skill goes through the same steps. These are the words a child and a teacher see on screen:

| On screen | What it means |
| --- | --- |
| **Not started** | The skill is not open for this child yet. It opens when the skills before it are mastered, or when the teacher opens it for the class. |
| **Practising** | The child solves questions with their own numbers. A wrong answer points to the line of working to look at again, and a hint ladder helps. |
| **Taught the Shishya** | On 3 questions the child found the first wrong line in the Shishya's working and typed a correct line in its place (at least 2 different mistakes, at most 2 tries each). Code checks every typed line. |
| **Show it alone** | 3 questions and 1 word problem with the child's own numbers, no hints and no AI help, in 30 minutes. In classes made since proof windows were added, a proof can start only while the teacher has opened proofs in class (15 minutes at a time). |
| **Next try opens tomorrow** | The child missed the proof. The next try opens after the class's wait: tomorrow, next period or straight away (the teacher chooses). |
| **Mastered** | The child showed the skill alone. Only code decides this, never an AI. |

**A slip is not a pattern.** One wrong answer that matches a known mistake can be a careless slip. The child then
sees only "Check line N again.", and the class board lists the child under **One slip, watching**. Only when the same
mistake explains the child's answers on 2 different questions (in the last 7 days) does the child see that mistake's
message and the board put the child in its group. A grid on the board shows, per skill, at which line of working
the children's patterns first go wrong.

**Every verdict shows its check.** Under each tick or cross there is a **How we checked** box: for an equation, the
child's answer put back into the question ("Put x = 7 back in: … Both sides are 26, so it is right."); for sums and
expressions, the rule used and a check. It never shows the correct answer to a wrong one.

**Easy to type.** An on-screen maths keypad (digits, x, −, +, =, /, delete and clear, with big keys) sits under every
answer box. Answers typed with other minus signs, Hindi (Devanagari) digits or full-width characters are read the
same way, and "7", "x = 7", "7 = x" and "14/2" all count as 7.

On the class board, the teacher sees where children's working first goes wrong. A wrong answer that no mistake in the
library explains is shown as **Not matched to a known mistake**. When there are enough of these, the **mistake finder
(an AI helper)**, called the Misconception Miner below, proposes a new mistake. Code tests it, and the teacher reads it
on the board as a **New mistake found in your class**, with the real wrong answers it explains and 4 ticks from the
code checks, and approves or rejects it. Children never see the AI's words: they see a fixed message written by
people, or the teacher's own words. The page **How the agent worked** lists the agent's last runs and each verdict.

## Features

- **Judge Tour.** "Try it as a judge (3 minutes)" on the home page makes a made-up class with 30 made-up children and
  walks through 6 stops on the real screens: practise, teach the Shishya, show it alone, mastered with its checks,
  the teacher's board, and a recorded run of the mistake finder. Tour classes are kept apart from real classes, are
  never counted, and are deleted after 24 hours.
- **Five skills in a chain:** integers → like terms → one-step equations → two-step equations → variables on both
  sides, each with word problems in English and Hindi.
- **The teacher's class board:** progress per skill, mistake groups, slips, the where-it-goes-wrong grid, "Open for
  the class", a proofs window (open for 15 minutes, or close now), the wait after a missed proof, a projector mode
  and a pilot CSV (only real classes are counted).
- **Codes, not names.** Each child gets a random code like `8B-R4TX`, printed on cards. "Give new codes" replaces all
  of them and keeps everyone's progress. Wrong codes and wrong PINs are counted in the database, so too many tries
  pause log-in for a while on every server.
- **A teacher PIN with a recovery code.** The recovery code is shown once and printed on the teacher's copy of the
  code sheet; "Forgot the PIN?" uses it to set a new PIN.
- **Consent first.** Children of a new class can log in only after the teacher records, on the class board, that the
  school has allowed the class and parents have been told (with the number of parent slips received).
- **Delete a class.** "Delete this class and all its data" (type the class code to confirm) removes the class, every
  child's code, answers, working lines, proofs, progress and every log line about it, in one go.
- **Paper Mode.** For a class with no computers: "Type in a paper worksheet" on the class board prints a worksheet
  (a skill, 8 questions by default, the same for every child, with a short worksheet code and a box for the child's
  code, never a name). The teacher then types each child's final answer into a grid. The answers are checked by the
  same code as typed answers and feed the board and the Misconception Miner (real classes only); they never change
  a child's progress. The pilot CSV counts them (`paperAnswers`, `paperCorrect`).
- **English and Hindi** on every screen, in the NCERT textbook's words.
- **Privacy written down:** [PRIVACY.md](PRIVACY.md) and a template agreement for schools (see below).

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

**Changing the session secret without logging everyone out.** Set `SESSION_SECRET_PREVIOUS` to the current
`SESSION_SECRET`, set `SESSION_SECRET` to a new secret (step 3), and redeploy. Cookies signed with either secret
keep working; new cookies are always signed with `SESSION_SECRET`. After 30 days (the longest a teacher cookie
lasts) remove `SESSION_SECRET_PREVIOUS`. If the old secret leaked, skip `SESSION_SECRET_PREVIOUS`: everyone simply
logs in again.

**Health check and keep-warm.** `GET /api/health` answers `{ "ok": true, "db": true }` after one trivial database
read (no secrets, counts or child data; never cached), or `503 { "ok": false }`. It also runs the hourly clean-up of
expired Judge Tour classes. `.github/workflows/keep-warm.yml` calls it every 10 minutes, so the first child of the
day does not wait for a cold start. GitHub turns off scheduled workflows in a repository with no commits for 60 days;
re-enable it under *Actions* if that happens.

## Contributing and privacy

- [CONTRIBUTING.md](CONTRIBUTING.md): the rules every change keeps, and how to add a skill.
- [docs/SKILL_SPEC.md](docs/SKILL_SPEC.md): the skill format, field by field, and the format of a mistake found by
  the Misconception Miner.
- [MAINTAINERS.md](MAINTAINERS.md): who looks after Shishya, and how to report a problem.
- [PRIVACY.md](PRIVACY.md): what Shishya stores, what it never stores, where, for how long, and how a school deletes
  a class. A template agreement between a school and the operator:
  [docs/privacy/PROCESSOR_AGREEMENT_TEMPLATE.md](docs/privacy/PROCESSOR_AGREEMENT_TEMPLATE.md).

## Licence

MIT, see [LICENSE](LICENSE).
