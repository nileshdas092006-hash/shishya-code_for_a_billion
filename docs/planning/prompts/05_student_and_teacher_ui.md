Task 5: the screens. Read CLAUDE.md and docs/planning/02_plan.md first. Work autonomously. Use only Next.js + Tailwind
(already installed); ask before adding any library. Read node_modules/next/dist/docs if APIs differ from what you expect.

Design rules (these are KV lab PCs, old phones and a classroom projector):
- Big text and big tap targets, high contrast, works at 1024×768 and on a phone, fast on slow internet (no heavy images,
  no animation libraries). Everything works with mouse, touch or keyboard.
- A friendly ORIGINAL "Shishya" character drawn as a simple inline SVG (a cheerful student with a notebook), with three moods:
  confused, thinking, happy. Do not copy any existing mascot or brand.
- Child-facing words: simple English, NCERT language ("do the same operation on both sides"). Put every child-facing string
  in src/i18n/en.ts so Hindi (src/i18n/hi.ts) can be added later; add a Hindi file with the same keys, translated.
- Show "Shishya is a computer program" on every student screen. In Prove, show a clear "AI is off" badge.

Skill registry: src/core/skills/index.ts exports all skills; screens read skills only from it (right now only
alg.linear.both-sides exists, and the screens must not assume there is only one).

Routes (App Router, server actions or route handlers that call src/server/services.ts only):
1. /           : choose Teacher or Student.
2. /teacher    : create a class (grade 7–9, section) → shows a class code, a teacher PIN, and N printable student codes
                 (e.g. 8B-01 … 8B-40) on a print-friendly page. No names are ever entered.
3. /teacher/[class] (PIN required): the stuck board ("6 students: kept-x-sign" with the teacher label and an example trace),
                 per-skill progress counts (Open / Key 1 / Mastered / Not yet), unlock a skill for the class, a list of
                 mined mistakes waiting for Approve/Reject (empty for now), and "Download pilot CSV".
4. /teacher/[class]/project : projector mode. A huge-font Shishya trace with a mistake; the teacher clicks the line the
                 class chose, types the class's fix, and the checker accepts or rejects it. No student accounts needed.
5. /s          : the student enters class code + student code.
6. /s/home     : the skill map (states shown with simple icons and words).
7. /s/practise/[skill] : one question at a time, an answer box (fractions allowed like 5/3), instant feedback. A wrong
                 answer names the exact step in child words when diagnosed; otherwise "Let's look at this step by step".
                 The hint button shows the 4 template hints one level at a time (no AI yet). After 5 correct answers in a
                 row, offer "Teach the Shishya".
8. /s/teach/[skill] : the Shishya shows its working line by line; the child taps the first wrong line, then types the
                 corrected line; the checker decides; the Shishya reacts (mood change) and a level-up bar fills. 3 traces,
                 at least 2 different mistakes.
9. /s/prove/[skill] : 3 solve items + 1 taxi word problem, own numbers, no hints, "AI is off", 30-minute limit, then
                 "Mastered! Next skill unlocked" or "Not yet: here is what to practise" (never a mark out of 10).
Class 7 classes (aiAllowed = false) must never render any AI chat element, even after the AI tutor is added later.

Add a small seed script (npm run seed:demo) that creates a demo class, 5 demo students and some fake practice attempts
ONLY in a separate demo database (data/demo.db), clearly labelled DEMO, never mixed with pilot data.

Run npm test, npm run build and npm run lint until all pass. Start the dev server and check every route loads without
errors. Commit "UI: student and teacher screens", update BUILD_LOG.md, and explain in plain English how a click on a
screen reaches the mastery engine and back.
