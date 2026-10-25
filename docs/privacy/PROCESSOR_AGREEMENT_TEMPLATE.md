**A template, not legal advice.** Have it checked before anyone signs it.

# Data processing agreement: Shishya

Between **[School name]** ("the School", the data fiduciary) and **[Operator name]** ("the Operator", who runs
Shishya and processes data for the School), from **[date]**.

1. **Purpose.** The Operator processes the data described in [PRIVACY.md](../../PRIVACY.md) only to provide Shishya to
   the School's classes, for education. Nothing else.
2. **No sale, no ads, no tracking.** The Operator never sells data, never shows ads, and never tracks children or
   monitors their behaviour outside learning in Shishya. No profiles are built for any other purpose.
3. **What is processed.** Class and child codes (never names), answers, working lines, progress and timestamps. No
   names, phone numbers, email, birth dates, camera, microphone, location or chat.
4. **Consent.** The School gets parents' consent and tells parents what Shishya does. A teacher records this on the
   class board before any child of that class can log in.
5. **Security.** Data travels encrypted (HTTPS). Teacher PINs and recovery codes are stored only as hashes. Access to
   the database and its keys is limited to the Operator. Secrets are kept out of the code.
6. **Breach notice.** If data may have been exposed, the Operator tells the School without delay, and within
   **72 hours** at the latest, with what happened, what data, and what is being done.
7. **Deletion.** The School can delete a class at any time on the class board, which removes all of that class's
   data at once. On written request, the Operator deletes the School's classes within **[7] days** and confirms in
   writing. When this agreement ends, the Operator deletes all of the School's data.
8. **Sub-processors.**
   - **Vercel** hosts the app (functions in the Mumbai region, `bom1`).
   - **Turso** hosts the database (expected Mumbai, `aws-ap-south-1`; **[confirm the region before signing]**, see
     PRIVACY.md).
   - **AI providers (Groq, OpenRouter)**, only for the Misconception Miner, which receives only anonymous numbers
     (question numbers and wrong answers). They never receive codes, names or anything else about a child.

   The Operator tells the School before adding a new sub-processor.
9. **Region.** Data is kept in India (Mumbai region) unless the School agrees otherwise in writing.
10. **Help.** The Operator helps the School answer parents' questions and requests about their child's data.

Signed for the School: ____________________ Name and role: ____________________ Date: __________

Signed for the Operator: ____________________ Name: ____________________ Date: __________
