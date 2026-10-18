# 01_research — Is Shishya the right entry for Code for a Billion?

Written 18 Oct 2026. Source material: "Shishya — Round 1 Submission (Re-engineered)" (32 pages, Cline AI Builders Hackathon, 3 Oct 2026) + the official rules in 00_brief.md.

---------------------------------------------------------------------
## 1. The one-line truth
---------------------------------------------------------------------
Shishya was designed to impress engineers at a Cline build event: novelty, invariants, red-team logs.
Code for a Billion scores something different. Half the marks are for how BIG and how BAD the problem is,
written with numbers. Another quarter is REAL USAGE DATA from the field. Good engineering touches only
one quarter of the score.

So the idea can win, but only if we change what we are optimising for.

---------------------------------------------------------------------
## 2. Brutal teardown: "just port Shishya as-is" (Version 1)
---------------------------------------------------------------------
| # | Flaw | Why it hurts in THIS hackathon | Rubric hit |
|---|------|--------------------------------|-----------|
| 1 | Zero proven impact. The doc says "Nothing is built yet", and there are no users. | Proven impact is 25 marks and the FIRST tie-breaker. A demo with no users scores near 0 here. | Impact (25) |
| 2 | The users are minors (Class 8–9, ages 13+). | They are the hardest group to pilot with in 3 weeks: school permission, parent consent (DPDP Act), device time, the timetable. Faking users is banned and would also get caught. | Impact |
| 3 | The headline is anti-agentic: "AI only talks", "No LLM in any gate". | It is an *Agentic-AI* hackathon. A judge skimming it may file it as "a maths quiz app". | Quality + the AF sponsor award |
| 4 | The only agent (the Misconception Miner) fires only after 5 or more unknown errors. | In a small pilot it may never trigger, so the one agentic part is invisible in the demo. | Quality |
| 5 | Cline branding everywhere (the Cline SDK, .clinerules, Memory Bank, "Cline builds Shishya"). | AgentFoundry, a competing IDE, is the platinum sponsor and the eligibility rule. Showcasing Cline is the wrong signal and puts eligibility at risk. | Eligibility |
| 6 | Only one skill (variables on both sides). | Judges compare a national-size problem with one textbook chapter, and a real class cannot use one skill for a week of pilot. | Quality, Impact |
| 7 | English only in v1. | In a "Bharat" hackathon the target kids are often Hindi, Bengali or Assamese medium. | Size, Quality |
| 8 | The business model is "Rs 500 per child, sold to private schools". | Code goes open-source (Apache-2.0/MIT) to the CFI GitHub org as a digital public good. Charging for it contradicts the spirit of the event. | Quality (story) |
| 9 | It assumes Claude Haiku/Opus are paid from our own API key. | AF's free tokens cover only coding in the IDE, not the app's live AI calls. This is small but real money, so we need a budget cap. | Risk |
| 10 | Severity is framed as "test scores". | Judges may rank "maths marks" below health or justice. We must translate it into human or economic loss with numbers. | Severity (25) |
| 11 | Time. | Today is 18 Oct and our internal deadline is 8 Nov, so 21 days. A pilot alone needs about 10 days, so the product must be pilot-ready in about 9 days. Other hackathons are open in parallel. | Everything |
| 12 | The official rules contradict themselves (prizes, tracks) and organizers answer nobody. | Do not over-optimise for a prize structure that may change. Maximise the things every judge rewards: real numbers, real users, a demo that works. | Strategy |

Verdict on V1: it loses. It would come across as a beautiful design document with an empty "Deployment & impact data" box.

---------------------------------------------------------------------
## 3. What the competition looks like (16 submissions read, 18 Oct)
---------------------------------------------------------------------
- Submissions so far: CARE BLACKBOX (Health), SanitaSafe, RESQ evacuation, CivicPulse, Vision AI glasses,
  a phishing detector, CareerPath AI, Satyam heart-disease prediction, DevOps Control Center, RuleCam, EasyView,
  NoteCare AI, weapon detection, Crowdcity AI, HyperIDE, plus one template-only entry.
- None of the ones read has real users. CareerPath AI: "no external user numbers". CARE BLACKBOX: "No users or hospitals have been reached yet."
- AgentFoundry use is described in one line or not at all.
- No serious education/maths-learning entry is visible yet.

Implication: the bar is LOW on impact and on AF usage. Even 50–80 real students with honest before/after
numbers would put us in a different league from what we have seen. This is the real opportunity.

---------------------------------------------------------------------
## 4. Problem evidence: size and severity, with numbers
---------------------------------------------------------------------
Size (how many people):
- India's school enrolment in 2024–25 was 23.29 crore students (UDISE+ 2024–25, via educationforallinindia.com analysis;
  the same page also cites 24.69 crore, so verify against the official UDISE+ report before final use).
- That is roughly 1.9 crore children per grade [estimate: 23.29 crore ÷ 12 grades, label it as an estimate].
- Algebra (linear equations) is a gateway skill for every child who reaches Class 8. The whole cohort meets it.

Severity (how bad):
- PARAKH Rashtriya Sarvekshan 2024 (NCERT, 21 lakh+ students, 74,000+ schools, 781 districts):
  Class 9 maths average 37%, "the lowest across all grades". Class 6 maths average 50%.
  Only 29% of Class 9 students could apply percentages to solve problems. (The Federal, report on PARAKH 2024)
- The average Delhi student fell from 2.5 to 4.5 grade levels behind between Class 6 and Class 9 (Muralidharan et al., AER 2019, already in the Shishya references).
- Unguarded AI makes it worse: GPT-4 access raised practice scores 48% but cut later unaided exam scores 17% (Bastani et al., PNAS 2025).
- About 10 lakh teacher vacancies (ThePrint, already cited).
- STILL NEEDED [to source before submission]: one number linking maths failure to dropout or lost earnings
  (for example the secondary dropout rate from UDISE+, or a returns-to-schooling estimate). Do not write
  this number until it has been read on the source page.

Draft problem statement (to fill in the form):
"Class 9 students in India average 37% in maths, the lowest of any grade tested (PARAKH 2024, 21 lakh students).
Gaps start in single steps of algebra and compound every year, because one teacher with 40+ children cannot
see which step each child gets wrong, and answer-giving AI hides the gap instead of closing it.
About 1.9 crore children enter each grade every year."

---------------------------------------------------------------------
## 5. Shishya vs the alternative (scored as a judge would)
---------------------------------------------------------------------
Scores out of 5 are my judgement, not data.
| | Shishya (Education) | Benefits-eligibility agent (Livelihood) |
|-|---------------------|------------------------------------------|
| Size | 5: every Class 8 child | 5: crores of informal workers |
| Severity | 3 → 4 if framed as dropout and lost earnings | 4: money people are owed |
| Quality (design ready?) | 5: a 32-page red-teamed design, and Das already understands it | 2: from scratch; wrong eligibility advice harms people |
| Impact in 21 days | 3: needs ONE school, tuition centre or NGO to say yes | 2: adults are reachable, but "benefit received" takes months to show |
| Head start | About 1 week saved | None |
| Total | **21 / 25** | 15 / 25 |

**Decision: Shishya wins, on one condition. We must have a confirmed pilot site (a written or WhatsApp "yes") by 23 Oct.**
If no site agrees by then, the impact score collapses and we accept a lower ceiling (see §8).

---------------------------------------------------------------------
## 6. Version 2: "Shishya for Bharat" (the improved entry)
---------------------------------------------------------------------
### 6.1 New one-sentence angle
"For Class 8–9 children in India's crowded classrooms, Shishya's agents find the exact algebra step each child
gets wrong and turn real classroom mistakes into practice, while code (not AI) decides when a child has truly
learned it, unlike chat tutors that hand over answers."

### 6.2 Reframe: agents do the invisible work, code makes the decisions
This keeps Shishya's best idea (no AI ever decides mastery) and turns it into a STRENGTH for an
agentic hackathon: "trustworthy agents". Agents act; deterministic checks stop them doing harm.
| Agent | What it does (plain words) | Status |
|-------|----------------------------|--------|
| Misconception Miner | Reads real wrong answers that no known mistake explains, writes a new "mistake function" plus tests, runs the tests in a sandbox, and asks the teacher to approve | MUST: run it LIVE on real pilot errors. Lower the trigger from 5 errors to 3. |
| Skill Author | Given a skill name ("one-step equations"), drafts the full Skill Specification (question generator, solver, 3–5 mistake functions, tests). The tests must pass and Das reviews it before it goes in | MUST: we actually use it to build the 5-skill chain, so it is real, not decorative |
| Teacher Planner | Each week, reads the "stuck board" and drafts a 10-minute regrouping plan in the teacher's language; the teacher approves | NICE-TO-HAVE, cut if late |

Built with what AgentFoundry scaffolds (the Claude Agent SDK in TypeScript), NOT the Cline SDK. Every agent run
is logged so the "How you used AgentFoundry" box in the form has real detail. This targets the "Best Use of AgentFoundry Agents" award.

### 6.3 Scope changes
- 5-skill chain instead of 1: integers → like terms → one-step equations → two-step equations → variables on both sides.
  Word problems are a stretch goal. A child who is behind is routed back to the first skill they haven't mastered.
- Languages: English + Hindi templates for the Shishya's voice and the hints (templates, so translation costs nothing at runtime).
  Add Bengali or Assamese only if the pilot site needs it.
- Class mode (teacher + projector, no child accounts) is promoted to a MUST. It is the easiest thing for a school
  to say yes to, and it still gives anonymous class-level data.
- Individual mode stays ages 13+ (Class 8–9), as the original doc required.
- Drop the Rs 500 pricing. Replace it with "digital public good": Apache-2.0 code, Skill Specifications as open data that any
  NGO or state can fork, and DIKSHA-pluggable later.

### 6.4 Cost guard for live AI
- Original estimate: about $0.03 per skill per child. 60 children × 5 skills ≈ $9, plus a few Miner runs. Total budget cap: $25.
- Hard daily cap per child; template hints take over when the cap is hit. The app must work with ALL AI off.

### 6.5 The pilot (this is the 25% that decides the winner)
Who (try all at once, this week):
1. The school on the IITG campus (Kendriya Vidyalaya IIT Guwahati, to verify): ask the Class 8/9 maths teacher for class mode plus lab sessions.
2. IITG student teaching groups (for example the Udaan / "Prayas" programme with Snehalaya near campus; a 2016 article says Prayas taught 30 children near IITG, so check whether it is still running).
3. A tuition or coaching centre in Guwahati or Alipurduar (Class 8–9, phone mode, parent consent slip).
4. Through E-Cell / CSI contacts: any teacher who will run 3 sessions.

What we measure (honest, small and real):
- Day 0: pre-test, 4 fresh items with AI off.
- Days 1–5: 3–4 sessions of about 15 minutes (Practise → Teach the Shishya → Prove).
- Day 6: post-test on fresh items. Day 9 or later: a delayed re-test if time allows.
- If two sections or batches exist: one does practice only, the other Teach + Prove (a light version of H1).
- Logged automatically: students reached, sessions, skills mastered, % of wrong answers the library explained,
  new mistakes mined from real kids (and how many children each one explains), teacher minutes per week.
- Consent: a parent consent slip, pseudonymous IDs, no names in AI calls (as in Shishya §18).
- Honesty: report small samples and "no control group" plainly. Never inflate a number.

### 6.6 Second teardown of V2 (and the fix for each flaw)
| Flaw in V2 | Fix |
|------------|-----|
| The Skill Author agent may write wrong maths | Every draft must pass property tests (1,000 random items, never returns the correct answer). Das reviews and explains each mistake function back. |
| Three agents is scope creep | Only Miner + Author are MUST. The Planner is cut by default. |
| The pilot site may say no | Ask 4 channels in parallel this week; class mode is the easy yes; set a 23 Oct gate. |
| Few unknown errors means the Miner has nothing to mine | Trigger at 3 errors; also run it on errors Das collects on paper from the pre-test. |
| Vercel cannot keep a SQLite file | Use a free hosted Postgres (for example Neon or Supabase) or Render with a disk. Decide in 02_plan. |
| Eligibility doubt if any Shishya code was started outside AF | Build fresh inside AF from day 1, ask the organizers (Discussions + email), and describe AF use honestly. |
| Fewer than 21 days with other hackathons running | Treat this as MAIN. Product pilot-ready by 27 Oct; pilot 28 Oct – 5 Nov; video and submission 6–8 Nov. |

---------------------------------------------------------------------
## 7. Demo path (the 2–3 minute video)
---------------------------------------------------------------------
1. 0:00 The problem in numbers: "Class 9 maths average 37%". Then a real (anonymised) wrong answer from a pilot child.
2. 0:25 A child practises, makes the mistake, and Shishya names the exact step ("moved a term but kept its sign").
3. 0:55 The child teaches the Shishya: taps the wrong line, types the fix, and code accepts it.
4. 1:20 Prove with AI off on fresh numbers: "Mastered". The next skill opens.
5. 1:45 The agent moment: a mistake nobody had coded, from REAL pilot kids → the Miner writes and tests a function → the teacher taps Approve.
6. 2:15 Impact: students reached, pre → post scores, mistakes mined, teacher minutes. Real numbers only.
7. 2:40 Open-source digital public good: any school or NGO can fork it, in Hindi and English.

---------------------------------------------------------------------
## 8. Kill / fallback rule
---------------------------------------------------------------------
- If no pilot site says yes by 23 Oct: still build V2 and run it with whatever honest testing we can do
  (for example volunteer tutors from Udaan using it with children they already teach). Label it exactly as that.
  We accept a lower impact score rather than switching idea mid-way, because a switch after day 5 loses more.

---------------------------------------------------------------------
## 9. Questions to send the organizers (Discussions + hello@codeforindia.org)
---------------------------------------------------------------------
1. Prizes: per track (website, Rs 18L) or overall (README, $17,500)? Which tracks get prizes?
2. Our design was written for another event (no code). If we build all code inside AgentFoundry from now, is it eligible?
3. Does "Education" from the website's 10 areas map to the "Education" track in the form?

---------------------------------------------------------------------
## Sources (opened and read, 18 Oct 2026)
---------------------------------------------------------------------
- Official page: https://codeforindia.org/hackathon
- Judging rubric: https://github.com/karlmehta/code-for-a-billion/blob/main/JUDGING.md
- Submission hub README: https://github.com/karlmehta/code-for-a-billion
- Submissions: https://github.com/karlmehta/code-for-a-billion/issues (read #11 CareerPath AI, #21 CARE BLACKBOX)
- Discussions: https://github.com/karlmehta/code-for-a-billion/discussions
- AgentFoundry: https://agentfoundry.me
- PARAKH 2024 findings: https://thefederal.com/category/education/parakh-2024-survey-learning-gaps-indian-school-students-196870
- UDISE+ 2024–25 analysis: https://educationforallinindia.com/indias-school-education-in-data-an-analysis-of-udise-2024-25/
- Udaan / Prayas at IITG (2016): https://www.pagalguy.com/articles/udaan-iit-guwahatis-social-initiative-to-educate-underprivileged-children-4853
- Shishya design doc references [3] Muralidharan 2019, [6] Bastani 2025, [32] ThePrint (teacher vacancies)

---------------------------------------------------------------------
## 10. Update 18 Oct: pilot site and syllabus
---------------------------------------------------------------------
- No Shishya code exists yet. The build starts fresh inside AgentFoundry (good for eligibility).
- Pilot site: Kendriya Vidyalaya IIT Guwahati, confirmed by Das to be available.
- IITG students = usability testers only. They do not have the problem, so counting them as "impact" would be fake.
- Honest weak point: judges may see a campus KV as an advantaged school. Report the school type plainly. If possible,
  add one more site (for example the Prayas/Snehalaya children near campus, or a hometown tuition centre).
- New NCERT syllabus finding: solving linear equations, including unknown on both sides, is now Class 7 Ganita Prakash II
  Ch 7 "Finding the Unknown", which even has an "Identifying and correcting mistakes" section. Class 8 has "Algebra Play";
  Class 9 Ganita Manjari has "Introduction to Polynomials" and "Linear Equations in Two Variables". So Class 7 = core users
  (code-only, no AI because they are under 13); Class 8–9 = gateway-skill check-and-repair.
- Sources: teachoo.com Class 7 Ganita Prakash II Ch 7 page; vedantu.com Class 8 Ganita Prakash chapter list (2026-27);
  mycbseguide.com new Class 9 maths book 2026-27.
