# Shishya: time flexible, learning fixed
### Vision and design of Shishya (Code for a Billion · Education track)
Status labels used throughout: **LIVE** (running at the demo link) · **BUILT** (in the repo, tested, not yet
used at scale) · **DESIGNED** (specified, not built) · **VISION** (where the system goes). Every number has a
source.

---

## 1. The core problem
India promotes children **by calendar, not by learning**. A child moves to the next class because a year has
passed, not because the previous skills were checked. Each unlearned step then becomes the floor the next
chapter is built on, so gaps compound silently until they show up as a failed board exam or a dropout.

Nobody designed it this way on purpose. Checking every skill of every child is expensive, so the system checks
once a year, on one shared paper, and averages the result into a mark.

## 2. The evidence
| Fact | Number | Source |
|---|---|---|
| Children in Indian schools | **24.7 crore** in 14.7 lakh schools, taught by **1.01 crore** teachers | UDISE+ 2024–25 |
| Maths falls as school goes on | National maths average **60% (Class 3) → 46% (Class 6) → 37% (Class 9)**; only **28%** of Class 9 students could solve percentage problems | PARAKH Rashtriya Sarvekshan 2024 (NCERT), 21.15 lakh students, 74,229 schools, 781 districts |
| Gaps grow, not shrink | The average Delhi student fell from **2.5 to 4.5 grade levels** behind between Class 6 and Class 9 | Muralidharan, Singh & Ganimian, *American Economic Review* 2019 |
| Families pay to buy back learning | **27%** of school students take private coaching; ₹6,384 a year on average at higher secondary | NSO Comprehensive Modular Survey: Education 2025 (57,742 students) |
| Leaving school | Secondary (Class 9–10) dropout rate **8.2%** in 2024–25 | Ministry of Education, UDISE+ 2024–25 report (The Tribune, 28 Aug 2025) |
| Answer-giving AI hides the gap | Unguarded GPT-4 access raised practice scores **48%** but cut later unaided exam scores **17%** | Bastani et al., *PNAS* 2025 |

**Severity in human terms:** a Class 7 student who never really learned "do the same operation on both sides"
can still be promoted to Class 8, 9 and 10. The gap surfaces at the Class 10 board exam, where it costs a
year, a stream choice (science closes first), or the child's place in school. Families who can pay for coaching
buy the missing check privately; families who cannot, do not.

## 3. Root causes: the loopholes we found
| Today's practice | The scarcity behind it | What it causes |
|---|---|---|
| One lecture at one pace for 40+ children | One teacher, no time to see each child's working | The teacher cannot see **which step** each child gets wrong; ability inside one class spans about six grade levels |
| The same test for everyone, reused | Writing good questions is costly | Copying and memorising answers; the test checks recall of one paper, not the skill |
| Promotion by calendar | Measuring each skill for each child is costly | Gaps compound; marks average a skill the child has into one they do not |
| AI chat as the fix | Language models are cheap and fluent | They produce answers, not learning, and can be confidently wrong in maths |

The common root: **verification is expensive, so the system skips it.** Fix verification and the calendar no
longer has to stand in for learning.

## 4. The fix, from first principles: time flexible, learning fixed
This is Benjamin Bloom's mastery learning: let **time vary** and hold **learning constant**. A child moves on
only after showing the skill, however long that takes. It is one of the best-evidenced ideas in education:
across 108 controlled studies mastery programmes raised achievement by **0.52 standard deviations** (about
50th → 70th percentile), with larger gains for weaker students (Kulik, Kulik & Bangert-Drowns, *Review of
Educational Research* 1990). India's own policy asks for it: NEP 2020 calls for "a shift from rote learning to
conceptual understanding, competency-based assessment", and NCERT set up PARAKH to deliver it.

It never scaled because mastery needs **fresh questions for every child, step-level diagnosis and a check
nobody can copy**, and those were too expensive by hand. They are not expensive in code.

Seven rules Shishya is built on:
1. No AI output ever changes a child's progress record.
2. Every answer and every mistake is computed by code.
3. Help gives hints, never final answers.
4. Proof runs with all AI off, on single-use questions with each child's own numbers.
5. Data is formative only: it never feeds detention or ranking.
6. The teacher sees children grouped by mistake, with no new admin work.
7. No names, camera, location, keystroke or emotion data, ever.

## 5. Where AI belongs: engineered, not blind
| Job | Who does it | Why |
|---|---|---|
| Making questions, answers, marking, diagnosis, the proof, the progress record | **Code** (deterministic, tested over 1,000 random questions per mistake) | Must be exact, free, offline-capable and impossible to talk into a wrong decision |
| Finding NEW mistakes children make that nobody has written down | **AI agent** (the Misconception Miner) | Discovery from messy data is what AI is good at |
| Checking the AI's proposal | **Code** (a validator: reproduces ≥3 real wrong answers, never gives the right answer on 1,000 questions, ≤10% overlap with known mistakes) | Never trust the conversation |
| Approving it for children | **A teacher** (one tap; can rewrite the wording) | AI cannot judge whether advice is pedagogically good |
| Words a child reads | **People** (fixed, NCERT-language messages) | In our first real Miner run, the AI's formula was right and its advice to the child was wrong |
| Hints in the child's own words | **AI, behind a layered answer guard** | DESIGNED, not built: Class 7 never sees AI chat |

The AI proposes **data in a tiny formula language**, never code. A hand-written parser evaluates it, with no
`eval`. The worst a bad proposal can do is waste one minute of a teacher's time.

## 6. The full system we propose
| Layer | What changes | Status |
|---|---|---|
| **Child** | Practise → teach the Shishya (find the wrong line in a classmate's working, type the fix) → prove alone. At their own pace | **LIVE** |
| **Teacher** | Children grouped by the exact mistake, so the teacher can run one short group session with projector mode instead of re-teaching everyone; Paper Mode for schools without devices | **LIVE** |
| **School** | A record of verified skills (which skill, when, on which fresh questions) replaces one averaged mark; it feeds NEP's Holistic Progress Card | **BUILT** (the records exist); export to the progress card **DESIGNED** |
| **System** | An open, growing library of Indian children's real misconceptions; the Skill Specification as an open standard for any subject with a code-checkable answer (arithmetic, algebra, physics numericals, chemistry balancing); a mode inside DIKSHA rather than a rival | **BUILT** for one chapter + an open mistake API; the rest is **VISION** |

## 7. The prototype: a working subset of that system
For this event we built the full loop for one gateway chapter, linear equations, where letters first replace
numbers. It is five skills in teaching order: integers → like terms → one-step → two-step → x on both sides.
- **Practise with step diagnosis** (LIVE): every wrong answer is matched against mistakes written as code. One
  match is treated as a possible slip ("Check line 3 again"); the same mistake on two different questions is a
  pattern, and gets its own message.
- **Teach the Shishya** (LIVE): the child finds the first wrong line in the Shishya's working and types the
  corrected line; code checks it algebraically.
- **Prove** (LIVE): 3 equations + 1 word problem, all correct, AI off, 30 minutes, single-use questions.
  "Mastered" is decided by one module of code only, and re-checked 7 days later.
- **Teacher board, projector mode, Paper Mode, consent record, one-tap class deletion** (LIVE). English and
  Hindi. No names stored.
- **Misconception Miner** (BUILT; run from the command line): in its first real run it rediscovered a mistake
  we had deliberately left out of the library ("divides by the coefficient from the question"); the validator
  passed it; its suggested child message was wrong, which is exactly why the teacher gate exists.
- **Shishya Challenge** (LIVE): a self-join link with a before check, practice, an after check and feedback,
  two random groups (practise only vs practise + teach), and a public /impact page computed by code.
- **The engine beyond school** (BUILT; live once this version is deployed): the same engine with a college pack (2×2 determinants,
  two-dice probability) for first-year students, to test that the Skill Specification generalises.

## 8. Quality: proof, not claims
Every claim here can be checked in two minutes:
- **Judge Tour** on the home page: 3 minutes on a made-up class, every feature clickable.
- **Hundreds of automated tests** (run `npm test`), including property tests over 1,000 random questions for every mistake,
  and source-scanning tests that enforce "only one module writes progress" and "agents never see child data".
- **Public /impact page and /api/impact**: every number is re-scored from the questions' seeds; groups under 5
  are hidden; test, demo and trial classes are never counted.
- **Open mistake library** at /api/mistakes (MIT): other tutors can reuse it.
- **Pre-registered** before the link was shared: https://osf.io/jmkq4
- **Built in AgentFoundry with Claude Code**, task by task; every task has written acceptance tests and a
  BUILD_LOG entry, including the failures.

## 9. Impact (real users only)
The live numbers are public and computed by code: https://shishya-codeforabillion.vercel.app/impact
(JSON: /api/impact). Two online arms are reported separately and never pooled: **school students
(Classes 7–10)** and the **college pack** (first-year college students, the same engine on two college topics).
Pre-registered at https://osf.io/jmkq4. Honest limits: online, self-selected, one session each, small numbers;
not a classroom study. The college numbers test the engine, not school learning.

## 10. Scaling: what 90 days built, and the blueprint for the rest
One person cannot build a national learning system in 90 days, and we do not claim to. What we built is the
part that has to be right first, the **verification engine**, with real users and open code.
| Phase | What | Done when |
|---|---|---|
| **Now (built)** | One chapter, the full loop, online trials, open mistake library | Live, tested, real users |
| **Phase 1 · 3 months** | Class 6–8 maths core (fractions, integers, ratio) as Skill Specifications; the Miner running on real classes weekly; classroom pilot in 2–3 schools with a delayed post-test | ≥ 20 skills; a measured gain on a delayed test |
| **Phase 2 · 6–12 months** | Skill passport export to the Holistic Progress Card; offline mode for low-connectivity schools; Hindi + 2 more languages reviewed by teachers; a guarded hint tutor for Class 8+ tested against no-AI hints | 50 schools; teacher time diary shows no extra load |
| **Phase 3 · 1–3 years** | Class 3–10 maths and code-checkable science; a state ICT-lab rollout; a DIKSHA integration; the misconception library as an open national dataset | A state partner; the library grows from every classroom |

Everything is open source (MIT) so any school, state or developer can build on it. The thing no one can copy
quickly is the library of real Indian misconceptions, because it grows with every classroom that uses it.

---
**Sources:** UDISE+ 2024–25 (educationforallinindia.com analysis) · PARAKH Rashtriya Sarvekshan 2024 (ThePrint) ·
Muralidharan et al. 2019, AER 109(4) · NSO CMS: Education 2025 (PIB release, 26 Aug 2025) · Bastani et al.
2025, PNAS 122(26) · Kulik, Kulik & Bangert-Drowns 1990, RER 60(2) · NEP 2020 via PARAKH (NCERT) · Brown & Burton
1978, Cognitive Science 2(2) · Chase et al. 2009, J. Sci. Educ. Technol. 18(4) · Roediger & Karpicke 2006.
