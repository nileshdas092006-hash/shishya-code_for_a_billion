# Privacy in Shishya

Short and plain. The school decides; Shishya only keeps what it needs to teach.

## Who decides

The **school** decides whether a class uses Shishya, and the school can delete a class at any time. Under India's
Digital Personal Data Protection Act, 2023 (DPDP), the school is the **data fiduciary**. Shishya (its operator) only
processes data for the school, for **educational purposes only**: no sale, no ads, no tracking of children outside
learning in Shishya. Getting parents' consent is the school's job; before any child of a class can log in, the
teacher records on the class board that the school has allowed the class and parents have been told, and how many
parent slips came back.

## What we store

- **Codes, not names.** A class code (like `8B-K7QM`), the class's grade and section letter, and one random code per
  child (like `8B-R4TX`). The teacher keeps the list that matches codes to names, on paper.
- **Answers.** Each question a child was given (its numbers), the answer the child typed, whether it was right, and
  which known mistake explains it.
- **Working lines.** In "Teach the Shishya": the line the child tapped and the line they typed.
- **Timestamps.** When each question, answer, proof and log-in happened.
- **Progress.** Each child's state per skill (Locked, Open, Key 1, Not yet, Mastered) and the evidence for it.
- **Teacher secrets as hashes only.** The teacher PIN and the PIN recovery code are stored only as scrypt hashes.
- **The consent record.** When it was recorded and the number of parent slips.
- **A log of events** (for example "a child logged in", "proofs opened"). It never holds codes.
- **Anonymous wrong answers** that no known mistake explains: only the question's numbers, the wrong answer and how
  often it was given. They are pooled across real classes for the Misconception Miner and are not linked to any child
  or class.
- **A signed login cookie** in the browser: only a child's internal id (8 hours) or the classes a teacher unlocked with
  the PIN (30 days).

## What we never store

Names, phone numbers, email addresses, birth dates, photos or camera, microphone, location, or chat transcripts.
There is no chat: the AI tutor is switched off, and children under 13 (Class 7) never see an AI chat. Shishya writes
no IP addresses or device details to its database. (Vercel, the host, keeps its own short-lived request logs.)

## Where

- **App:** Vercel, functions in the Mumbai region (`bom1`).
- **Database:** Turso (hosted libSQL). On 2026-10-19 the Vercel functions were moved next to the database and each
  database call then took about 0.3 s from Mumbai, which points to Turso's Mumbai region (`aws-ap-south-1`).
  **Not yet confirmed from the `DATABASE_URL` host:** that URL is set only in Vercel's settings, not on the laptop
  this was written on. To check: the region is the part of the host before `.turso.io` (for example
  `…aws-ap-south-1.turso.io`), or `turso db show <name>`.
- **AI providers** (Groq, OpenRouter) are used only by the Misconception Miner, which the operator runs by hand. They
  receive only anonymous numbers: question numbers and wrong answers, never codes, names or anything else about a
  child.

## How long

Until the school deletes the class. Judge Tour classes (made-up children) are deleted automatically after 24 hours.

## How to delete

On the class board: **Delete this class and all its data**, then type the class code to confirm. In one go this
deletes the class, every child's code, answers, working lines, proofs, progress and every log line about the class.
What is left: one log line saying a class was deleted, with counts only (how many rows), and the anonymous wrong
answers above, which cannot be traced back to the class. A mistake pattern the teacher approved for the shared
library stays, but no longer names the class. Turso's own backups age out on Turso's schedule.

Questions or a deletion request from a school: contact the operator (see the processor agreement).
