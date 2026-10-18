Task 4: the mastery engine and the data store (server side). Read CLAUDE.md first. Tests first. Work autonomously.

A. Store (src/server/store.ts)
 - Use Node's built-in SQLite module (node:sqlite, Node 22.5+). This adds NO new dependency. Use WAL mode and transactions.
   Database file: data/shishya.db (add data/ to .gitignore). Keep all SQL inside store.ts behind plain functions, so we
   can swap to Postgres later without touching other files.
 - Tables (pseudonymous only, no names anywhere): classes (id, code, grade, aiAllowed boolean = grade >= 8),
   students (id, classId, code like "8B-17"), items (id, studentId, skillId, version, seed, kind 'practice'|'proof',
   paramsJson, answer, servedAt, answeredAt; a proof item is single-use and has a unique index), attempts
   (id, studentId, itemId, answer, correct, mistakeId or 'unknown', createdAt), teachTraces (id, studentId, itemId, mistakeId,
   tappedLine, typedLine, lineCorrect, fixAccepted, createdAt), proofRuns (id, studentId, skillId, version, itemIds, passed,
   startedAt, finishedAt), mastery (studentId, skillId, state, evidenceJson, version, updatedAt), unknownErrors
   (id, skillId, paramsJson, wrongAnswer, count), minedMistakes (id, skillId, source, testsJson, status, approver, createdAt),
   events (id, studentId, type, payloadJson, createdAt) for pilot metrics.

B. Mastery engine (src/server/mastery.ts), the ONLY file allowed to write the mastery table
 - States: LOCKED → OPEN → KEY1 → MASTERED, plus NOT_YET after a failed proof (which keeps KEY1).
 - OPEN when every prerequisite is MASTERED, or the teacher unlocks it.
 - KEY1 when the teach rule is met on the current version: 3 traces covering at least 2 different mistakes, each fixed
   (lineCorrect and fixAccepted) within 2 tries.
 - MASTERED when KEY1 is held and one proof run is fully correct: 3 solve items + 1 apply item, single-use, served with AI
   off, finished within 30 minutes.
 - A failed proof gives NOT_YET, keeps KEY1, and the next proof opens after PROOF_COOLDOWN_HOURS (an env setting,
   default 24; 0 allowed for demos).
 - Every write records evidence ids and the skill version. No other file may write mastery (add a test that greps the
   source for writes to the mastery table outside mastery.ts).

C. Session services (src/server/services.ts): servePracticeItem, submitPracticeAnswer (diagnoses with src/core; unknown
   wrong answers go into unknownErrors with a count), startTeach (3 traces covering at least 2 mistakes), submitTeachStep,
   startProof (refuses if no KEY1 or still cooling down; marks the run aiOff), submitProofAnswer, getStuckBoard(classId)
   (groups students by their most frequent mistake in the last 7 days), exportPilotCsv(classId) (anonymous counts only).
   Log an event row for every action.

D. Tests: the full state-transition table; proof items can't be served twice (even if two requests race); cooldown is
   respected; the stuck board groups correctly; the CSV contains no student codes. Use a temporary database file per test.
Run npm test until all pass, commit "Server: store and mastery engine", update BUILD_LOG.md, and explain in plain English
how a child moves from OPEN to MASTERED and why no AI can change that.
