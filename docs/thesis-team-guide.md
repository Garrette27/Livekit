# TeleConsole for thesis co-authors

Updated 18 November 2026. Written for teammates who write the paper and run the
survey but did not build the application. You do not need to read code. Each
section tells you what the system does, why it was built that way, which thesis
chapter it supports, and what we may and may not claim.

Deeper references, if you need them: `docs/thesis-defense-guide.md` (panel
script and likely questions), `docs/invitation-access-model.md`,
`docs/access-control.md`, `docs/testing/` (all test evidence).

## 1. The project in one paragraph

TeleConsole is a web-based teleconsultation prototype. A doctor creates a
private invitation link, a patient opens it on a phone or computer, waits in a
virtual waiting room, and the doctor admits them into a live audio/video call.
With both people's consent, the call can be transcribed, and an AI drafts a
structured consultation summary that the doctor must review before it counts.
The research contribution is the **combination**: the link is not treated as
proof of identity, the AI is not treated as the clinical authority, and the
screen is not treated as the security boundary. Each layer checks its own part.

Say "thesis prototype". Do **not** call it HIPAA-compliant, certified, a medical
device, or production-ready. Those claims are false and a panel will test them.

## 2. Who uses it and what they do

| Person | What they do in the app | Screen |
| --- | --- | --- |
| Doctor | Signs in, creates an invitation, copies the link, watches the waiting queue, admits or removes patients, runs the call, reviews the AI summary, opens history | Doctor dashboard, Invitations, Room, History |
| Patient | Opens the link, optionally signs in, accepts one consent statement, waits, joins the call, can see their own permitted history | Invitation page, Waiting room, Room, Patient dashboard |
| Guest (patient without an account) | Opens the link and waits; can still be admitted by the doctor | Invitation page, Waiting room |
| Administrator (the app owner) | Creates doctor accounts and assigns the doctor role. Not a screen; done in Firebase | — |

Patients cannot make themselves doctors. The doctor role is set by the
administrator on the server side and cannot be changed from the browser.

## 3. One consultation, step by step (plain language)

1. **Doctor creates an invitation.** The doctor picks how long the link lasts
   and how many patients may wait. Optionally the doctor lists patient emails
   that may skip the queue. The server saves a record and gives the doctor a
   signed link.
   *Why:* the signature stops anyone from editing the link; the saved record
   lets the doctor cancel ("revoke") it at any time.
2. **Patient opens the link.** The server re-checks everything each time: is
   the signature real, does the record exist, is it for this room, has it
   expired or been revoked, is the waiting room full.
3. **Waiting room or direct entry.** Only a signed-in account whose email the
   provider (Google, or a confirmed email/password account) has verified *and*
   that is on the doctor's list may join directly. Everyone else waits. A typed
   email never lets anyone skip the queue.
   *Why:* anyone can type someone else's email. Possession of a link proves
   only that you have the link.
4. **Doctor admits.** The waiting patient holds a "waiting-only" pass that
   cannot send or receive audio/video. When the doctor clicks Admit, the server
   checks the doctor really owns this invitation and issues a full pass.
5. **The call.** LiveKit (a video-call service) carries audio, video, chat and
   screen sharing. The call works even if transcription or AI is off or broken.
6. **Transcription (optional).** Each person opts in. Audio is sent in short
   pieces, turned into text, and the audio is thrown away. Only the text and
   who said it are kept.
7. **AI summary.** The AI drafts a summary only from what was actually said.
   If there is too little evidence (silence, no-show, the patient was never
   admitted), the program records "insufficient evidence" itself instead of
   asking the AI to guess. The summary moves through
   `processing → ready (AI draft) → reviewed (doctor approved)`. A reviewed
   summary is never overwritten.

## 4. Mapping to the thesis disciplines

| Discipline | The question | What the system does | Where to write it |
| --- | --- | --- | --- |
| Cybersecurity | Who may enter, what is trusted, what is recorded? | Signed expiring links, server re-checks, verified-identity rule, waiting room, one-time use reserved in a database transaction, rate limits, revocation, privacy-preserving audit (hashed signals, no raw IP/email in logs) | Chapter III (design), Chapter IV (security test results) |
| AI / Computer Science | How can a summary help without inventing facts? | Consent-gated transcript, evidence-quality checks, strict structured output, deterministic "insufficient evidence", clinician review | Chapter III, Chapter IV (AI evaluation) |
| Web development / HCI | Can doctors and patients understand and control it? | Goal-directed invitation screen, visible status, waiting-queue controls, mobile layout, device check before calls, accessible messages | Chapter III, Chapter IV (usability survey) |

## 5. Design patterns we used and why (for Chapter III)

Each row is an established, named pattern. Cite the general pattern in the
paper; the file names are for us.

| Pattern | Plain meaning | Why it fits a teleconsultation |
| --- | --- | --- |
| Capability token | The link is like a ticket: holding it grants a specific, limited permission, not an identity | A forwarded link cannot let a stranger skip the waiting room |
| Server-side validation (never trust the client) | Every decision is re-checked on the server | Editing the web page cannot grant access |
| Least privilege | A waiting patient gets the smallest possible permission | An unadmitted person cannot see or hear the doctor |
| Atomic transaction | "Use one seat" and "record the visit" happen together or not at all | Two people clicking at the same moment cannot both take the last slot |
| Defense in depth | Server checks *and* database rules both enforce ownership | If one layer has a bug, the other still blocks cross-doctor access |
| Fail closed | When the database is unavailable, deny with a clear "try again" message rather than guess | The quota incident on 18 Nov showed a retry message instead of letting anyone in unchecked |
| Human-in-the-loop AI | AI drafts; a clinician decides | Medical documentation stays the doctor's responsibility |
| Request coalescing + pause when hidden | Several screens share one data request; background tabs stop polling | Keeps database reads inside the free daily quota |

## 6. What we can and cannot claim (copy this discipline into the paper)

| We can claim (with evidence) | We cannot claim |
| --- | --- |
| Unauthorized profile read and role escalation found on 17 Nov were fixed and retested as denied | That the system is "secure" in general or "hack-proof" |
| 27 automated security/policy tests, 8 database-rule tests, 29 mobile browser tests pass (see brief) | HIPAA, Data Privacy Act certification, or ISO compliance |
| Public pages loaded with p95 304 ms and 1,239 ms in a 10-request pilot | That calls are fast or the system scales; video latency and concurrent calls are **not yet measured** |
| The AI produces "insufficient evidence" instead of guessing | That the AI is clinically accurate; that needs the planned clinician comparison |
| Survey results, once collected, with the real sample size | Any number before the survey actually runs |

Use these result words consistently: **PASS, FAIL, BLOCKED, NOT TESTED, NOT
APPLICABLE**. A failure that was fixed stays in the paper as a FAIL row plus a
separate retest PASS row. That is stronger evidence than an all-green table.

## 7. The Firebase free-tier limit (why the app sometimes refuses login)

The database (Cloud Firestore) is on Google's free Spark plan: **50,000 document
reads and 20,000 writes per day**. When reads run out, every login fails until
the counter resets at **midnight US Pacific time**, which is **4:00 p.m.
Philippine/Singapore time** in November–March (3:00 p.m. during US daylight
saving time, March–November).

This happened on 18 November. It is not a security bug: the app correctly
refused to guess the user's role and now shows "Account verification is
temporarily unavailable". It *is* a capacity limitation worth one paragraph in
Chapter IV's limitations, and it is why the survey schedule in
`docs/testing/survey-and-interview-protocol.md` starts sessions right after
4:00 p.m.

## 8. Glossary

| Term | Meaning |
| --- | --- |
| Invitation / link | The URL the doctor sends; a signed, expiring ticket for one room |
| Revoke | Cancel an invitation so it stops working immediately |
| Allowlist | Emails the doctor approved to skip the waiting room (verified accounts only) |
| Waiting room / queue | Where patients wait until the doctor admits them |
| Token | A short-lived pass the server issues to join the call |
| LiveKit | The third-party real-time audio/video service |
| Firestore | Google's database used by the app |
| Firebase Authentication | Google's sign-in service (Google account or email/password) |
| Vercel | Where the web app is hosted |
| p95 | 95th percentile: 95% of measurements were at or below this time |
| Regression test | An automated check that a fixed bug stays fixed |
| Emulator | A local copy of Firebase used for safe testing |
