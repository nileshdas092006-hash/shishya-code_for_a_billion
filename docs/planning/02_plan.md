# 02_plan — Shishya for Bharat (Code for a Billion)

Decision locked 18 Oct 2026: Shishya v2 (see 01_research.md §6). No code exists yet; everything is built fresh.
Pilot site: Kendriya Vidyalaya IIT Guwahati (KV IITG). IITG students are TESTERS only, never "impact".

## 0. Ground rules for this build
1. Write ALL app code inside AgentFoundry (AF). Eligibility says "Built using AgentFoundry". Claude (in this chat)
   plans, reviews, runs tests and explains, but does not write app code outside AF. Every AF session gets noted in BUILD_LOG.md
   (date, what AF's agent did), which becomes the "How you used AgentFoundry" answer.
2. No AI decides mastery. Only code does (from the original Shishya design).
3. Children under 13 (Class 7) never talk to an AI. They get code + template hints only. The AI hint tutor is for Class 8–9 only.
4. No names anywhere. Each child gets a code like KV8B-17. The teacher keeps the list matching codes to names on paper.
5. Real numbers only. Small sample → say "small sample".

## 1. Syllabus fit (new NCERT, what KV follows)
- Class 7 Ganita Prakash II, Ch 7 "Finding the Unknown": solving ax + b = c, unknown on both sides, brackets,
  word problems, and a section on "Identifying and correcting mistakes". This is Shishya's exact skill, and the
  textbook already asks children to correct mistakes, so "teach the Shishya" fits the book.
  Note: the book discourages "move it across and change the sign" as a trick and explains it as doing the same inverse
  operation on both sides. Our mistake labels and hints must use the textbook's language.
- Class 8 Ganita Prakash II, Ch 6 "Algebra Play": expressions and simple equations.
- Class 9 Ganita Manjari, Ch 2 "Introduction to Polynomials" and Ch 12 "Linear Equations in Two Variables" both need this skill.
- Pilot pitch to KV: for Class 8–9 it is a "gateway-skill check and repair" (they learned it in Class 7). For Class 7 it
  is practice for Ch 7, in class mode / code-only mode.
- ASK THE TEACHER: which class is on which chapter right now, and when the Diwali break starts (Diwali is 8 Nov 2026).

## 2. The 5-skill chain
1. alg.integers.ops: add/subtract negative numbers (the root of most sign mistakes)
2. alg.like-terms: combine 3x + 5 − x + 2
3. alg.linear.one-step: x + 7 = 3, 4x = −12
4. alg.linear.two-step: 5x − 3 = −8
5. alg.linear.both-sides: 4x − 3 = 2x + 7 (the original Shishya worked example)
Stretch: alg.linear.brackets: −3(u + 2) = 2(u − 1); word problems.

## 3. Must-haves (the demo cannot work without these)
- M1 Maths core (pure TypeScript, runs in the browser): generator, solver, 3–5 mistake functions per skill, equation checker,
  property tests (1,000 random items each). Skill 5 is written by hand first. Skills 1–4 are drafted by the Skill Author agent (M4).
- M2 The student loop: Practise → Teach the Shishya → Prove (AI off), the mastery engine (the only writer of mastery),
  and a projector view of the Teach screen for class mode.
- M3 Teacher stuck board: "N children stuck on mistake X", plus pilot export (CSV of anonymous numbers).
- M4 Two agents, built with the Claude Agent SDK (TypeScript) scaffold in AF:
  - Skill Author: skill name → draft spec + mistake functions + tests → tests must pass → Das reviews → merged.
  - Misconception Miner: ≥3 unknown wrong answers → draft mistake function → sandbox tests → teacher Approve/Reject.
- M5 Deploy: Vercel (AF one-click) + free hosted Postgres (Neon). It must also open on KV lab PCs in a normal browser.
- M6 Pilot logging: every attempt, teach step, proof, and mined mistake gets timestamped (anonymous code only).

Nice-to-have: N1 AI hint tutor with answer-leak guard (Class 8–9 only), N2 Hindi templates.
Cut (future scope for the pitch): offline sync, spaced review, Teacher Planner agent, Open Badges, more subjects.

## 4. Build order (riskiest first). What to do, in order; Das sets the pace.
1. Setup: register on CFI (codeforindia.org/hackathon/register) + AgentFoundry.me; open C:\Dev\code-for-a-billion\app in AF;
   git init; push the public repo to GitHub (nileshdas092006-hash/shishya); MIT or Apache-2.0 licence.
2. Contracts first: write the Skill Specification JSON schema (from Shishya §6.3) and the data tables (Shishya §17).
3. M1 for skill 5 by hand in AF, tests first, using the worked example (4x − 3 = 2x + 7, answer 5) as fixtures.
   Explain-back: Das explains generator / solver / mistake function in his own words.
4. M4 Skill Author agent, then use it to produce skills 1–4. Review every mistake function.
5. M2 screens + mastery engine + store. Deploy to Vercel immediately (a working link from this step onwards).
6. M3 stuck board + export. M6 logging.
7. M4 Misconception Miner + the Approve button. Test it on errors collected from IITG testers first.
8. Tester round: 5–10 IITG friends use the deployed link for usability only (labelled as testers).
9. PILOT at KV (pilot/03_pilot_protocol.md).
10. N1 / N2 only if steps 1–9 are done.
11. Freeze → demo video (real pilot clips, no faces unless the school allows it) → README → submit.

## 5. Hard gates (external dates; everything else is Das's call)
- KV principal + maths teacher say yes: target 23 Oct. If no → 01_research.md §8 fallback.
- Product pilot-ready (steps 1–8 done): before the pilot dates the teacher gives.
- Pilot finished: before KV's Diwali break (Diwali 8 Nov 2026; confirm break dates with the school).
- Submit: by 7 Nov 2026. Official deadline 15 Nov (end-sem week).

## 6. Risks and fallbacks
| Risk | Fallback |
|------|----------|
| KV lab has no or weak internet | The core runs in the browser; results sync when back online, or the teacher exports from one PC |
| KV says no to individual devices | Class mode only on the projector (teacher-led), plus paper pre/post tests marked by our checker |
| Skill Author writes wrong maths | Property tests + Das review; the hand-written skill 5 is the reference |
| Miner gets too few unknown errors | Trigger at 3; also feed in pre-test paper errors |
| AI cost | Template hints default; AI tutor only for 13+; hard cap of $25 total |
| Organizers change rules | Watch Discussions weekly; keep the demo link working at all times |

## 7. Explain-back checklist (before submission, Das answers without notes)
- What is a Skill Specification and why is it data, not code?
- How does a mistake function produce the Shishya's wrong trace?
- How does the checker know a typed correction is right?
- Why can't an AI leak make a child "Mastered"?
- What exactly does each agent do, which tools does it have, and what stops it from doing harm?
- Where does pilot data live and what is NOT stored?

## 8. Rule added 18 Oct: ask KV now, pilot only when it passes this gate
Asking KV for permission (one visit + one follow-up) happens NOW, in parallel with building, because approval and consent
slips take days. Children use the product ONLY after every item below is true. If one fails, the pilot date moves; we never
show children a broken product.

Pilot-ready checklist:
- [ ] All 5 skills pass their property tests (1,000 random items each, no mistake function ever returns the correct answer)
- [ ] Das has done the explain-back for the maths core
- [ ] Practise → Teach → Prove works end to end on the deployed link, on a normal browser
- [ ] Tested on a slow / patchy connection (or offline) without losing a child's work
- [ ] Prove runs with all AI off, and fresh numbers per child are checked
- [ ] Class 7 mode has no AI chat anywhere
- [ ] The stuck board shows real groups from tester data
- [ ] The Miner has turned at least one real tester error into an approved mistake function
- [ ] 5–10 IITG testers have used it without help, and their confusions are fixed
- [ ] The export of anonymous pilot numbers works
- [ ] No names stored anywhere (checked in the database)
