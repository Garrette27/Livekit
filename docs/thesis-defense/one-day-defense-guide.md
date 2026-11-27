# TeleConsole — one-day defense guide

Current follow-up: `69f9c85`, 27 November 2026. Use the [97 ranked answers](panel-questions-and-answers.md), [quick rehearsal route](PANEL-QA-LATEST.md), current 14-slide panel/demo deck and [appointment verification/review](../testing/evidence/2026-11-27-appointments/implementation-review.md). All administrators are non-clinical; switch to a separate provisioned doctor identity for the call. Doctor-booked appointments are implemented but default-off pending production rules/indexes, data/retention review and signed-in staging acceptance. They were not surveyed. Older question references below use the [stable-id map](panel-question-number-map.md).

27 November 2026 · code at branch `fix/atomic-queue-capacity-visit-binding` (PR #9) · manuscript: same 259 pages, see [page-changes-2026-11-27.md](page-changes-2026-11-27.md).

Use this to learn the system well enough to **teach it**, run the demo, and answer the panel. Practice answers are in [panel-questions-and-answers.md](panel-questions-and-answers.md). Nothing here is a new clinical, security-certification or capacity result.

---

## 0. Do this first (before the day starts)

> Production (`livekit-frontend-tau.vercel.app`) still runs `main`. Read the [presentation risk register](presentation-risk-register.md) and decide: demo the PR #9 preview and merge after testing, or demo production as-is.

1. **Provision new doctors with the script** (existing doctor accounts keep working; granting them a claim is recommended but no longer required for the demo):
   ```bash
   vercel env pull .env.local
   node --env-file=.env.local scripts/admin/provision-role.mjs audit
   node --env-file=.env.local scripts/admin/provision-role.mjs grant doctor <demo-doctor-email> --apply
   ```
   Sign the doctor out and back in after a grant.
2. **Deploy the branch** (merge PR #9 or use its Vercel preview). Note the commit SHA you demo.
3. **Prepare three synthetic accounts:** Doctor (provisioned), Patient A (Google account, verified email), and a guest browser with no sign-in (incognito). Never use real patients.
4. **Freeze.** No code changes after this point.

---

## 1. The one-day schedule (three writers: W1 scope, W2 security/demo, W3 capacity/evidence)

| Time | What | Output |
|---|---|---|
| 08:00–09:00 | Everyone reads §2 and §3 aloud once | Each person can draw the 5-box diagram |
| 09:00–10:00 | W2 runs the demo script (§4) twice; others time it | A 6-minute demo that works |
| 10:00–11:00 | Build the deck from §5 (10 slides) | Slides + speaker notes |
| 11:00–12:00 | W1 rehearses objectives → evidence (§3) | Each objective has a "how we know" sentence |
| 13:00–14:00 | W3 rehearses capacity / CCTV answer (§6) | Units, scope, next test — no invented maximum |
| 14:00–16:00 | Mock panel: Q&A 1–60, random order, owner answers first, others add one thing | List of weak answers |
| 16:00–17:00 | Fix weak answers; rehearse the 4-part answer (§7) | Final run, 15 minutes total |

---

## 2. Understand the system in five boxes (teach this first)

```
 Browser (doctor / patient)
     │  HTTPS: sign-in, invitation, admit, history
     ▼
 Next.js server on Vercel  ──►  Firestore (accounts, invitations, queue rows, sessions, summaries)
     │  signs short-lived room credentials
     ▼
 LiveKit Cloud (audio / video / screen share)       OpenAI (optional: transcribe consented audio, draft summary)
```

Say it in one breath: **"The browser asks; the server decides and signs; LiveKit carries the media; Firestore remembers; AI only drafts, and a clinician reviews."**

Four rules carry every security answer:
1. **A link is a key, not an identity.** Anyone holding it can knock; only the server decides who enters.
2. **Only a verified account on the doctor's list enters directly.** Everyone else waits for the doctor. Typed emails never count.
3. **Every credential names one visit.** A credential from an earlier visit, or a doctor click on a visit they did not see, is refused.
4. **Only an administrator makes someone a doctor.** Signing up with Google makes you a patient, never a doctor.

### How "the doctor assigns the patient"
The invitation is the admission assignment. It is owned by the doctor and bound to one room. **"Patients who can join directly"** lets the corresponding verified account skip the queue; everyone else with the link waits. The encounter and summary remain doctor-owned, and the patient sees only their own history. The later, deployment-gated appointment module plans a time without granting admission or proving attendance; it does not replace invitation policy.

---

## 3. Objectives → what we built → how we know (objectives are unchanged)

| Specific objective (Chapter I, unchanged) | What we built | Evidence we can show | Honest limit |
|---|---|---|---|
| 1. Platform with LiveKit/WebRTC, layered security, controlled access | Server-signed invitations, provisioned doctor roles, waiting-room admission, visit-bound credentials, LiveKit media | Live demo; 75 automated regression tests; emulator run: 25 simultaneous arrivals → exactly 10 waiting | Not a penetration test; capacity not measured |
| 2. AI-assisted summarization | Consented transcription → evidence-gated draft → clinician review/edit | Demo of a summary card marked "AI draft · review required"; insufficient-evidence record | Clinical accuracy not evaluated |
| 3. User-centered flexible access + ISO 25010 evaluation | Verified direct entry or doctor admission; role pages; survey of 30 respondents | Chapter IV: all groups Highly Acceptable (3.51–3.94) | Perceptions, not measurements; small purposive sample |

The results answer the objectives **as written**: build (1, 2, 3) and evaluate perceived quality (3). We do not claim more than the objectives ask.

---

## 4. Demo script (≈8 minutes) — each step answers a top-20 panel question

Question numbers refer to the [ranked bank](panel-questions-and-answers.md). Test every step first with [TEAM-TEST-TOP-40.md](TEAM-TEST-TOP-40.md).

| # | Panel question it answers | Do | Say |
|---|---|---|---|
| 1 | Q1 Title, Q3 contribution | Show the landing page, header with signed-in account, and the five-box diagram | "Every word of the title is on this screen or in the next seven minutes." |
| 2 | Q28/Q31/Q40 Who makes doctors? | `/admin` with the synthetic admin: grant a doctor in a clinic. Switch to the separate doctor account. | "Administrators manage access only; a clinic admin can grant doctors only in their clinic." |
| 3 | Q10 How many wait? | Create invitation `demo-nov27`, waiting limit **2**, add Patient A's email → Copy link | "The access preview says exactly who enters and who waits." |
| 4 | Q14/Q29 Forwarded link? | Guest 1 opens the link and types Patient A's email | "A typed email is not proof — the guest waits. Notice the waiting page never turns on the camera (Q15)." |
| 5 | Q11/Q12 Eleventh patient, limit change | Guest 2 joins; Guest 3 is refused "Waiting room is full". Save limit = 3; Guest 3 retries and waits | "Checked in one transaction; measured 25 into 10 → exactly 10. Raising applies to the next arrival; lowering removes nobody." |
| 6 | Q14 Verified patient | Patient A opens the link with Google | "Verified and on the list — enters directly, even with a full queue." |
| 7 | Q8/Q9 Quality and capacity | Admit a guest; in the call open **Call quality** | "These are measured numbers: round trip __ ms, loss __ %, 720p. Provider ceiling is 50 pairs; our trial ran 1, 3 and 5." |
| 8 | Q5/Q7 Consent | Show both consent boxes; leave and rejoin as doctor | "Consent belongs to the encounter — the box is unticked again. The call works without it." |
| 9 | Q6 Several history rows | Consultation History: show two encounters from the same invitation, one *Not finalized* while active | "An invitation is a door key; each encounter is a walk through the door, with its own summary." |
| 10 | Q4 AI | Open the draft *AI draft · review required*, edit, Risk *Unknown* | "AI drafts, the dentist decides; no evidence is never turned into Low." |
| 11 | Q20 Revocation (optional) | Admin revokes a test doctor; the doctor's next click is refused | "Cut on the next request, not after an hour." |

**If something fails:** name the box that failed (§2), say what the system did correctly (e.g. it refused), and continue. Never bypass admission. Backup: the team's screenshots from the test plan.

## 5. Core research presentation and current demo supplement

| Slide | Title (one claim per slide) | Content | Speaker |
|---|---|---|---|
| 1 | TeleConsole | Official title, team, adviser | W1 |
| 2 | The problem at Henry Cheung Dental Clinic | 3 specific problems from Chapter I | W1 |
| 3 | Objectives (unchanged) | The 3 specific objectives verbatim | W1 |
| 4 | Five boxes | §2 diagram + one-breath sentence | W2 |
| 5 | A link is a key, not an identity | Admission flow: signed link → server → verified list enters / others wait → doctor admits | W2 |
| 6 | Security we tested | 4 rules (§2) + "75 automated tests, emulator concurrency check" + what is *not* claimed | W2 |
| 7 | AI drafts, clinicians decide | Consent → transcript → evidence gate → draft → review; insufficient-evidence outcome | W2 |
| 8 | Evaluation results | Table XXXVII; "perceived quality, n = 30, purposive" | W3 |
| 9 | Capacity: what we can and cannot say | §6 table; provider ceiling ≠ our capacity; next test 1/3/5 pairs | W3 |
| 10 | Conclusions, limits, next steps | Objectives met as written; limits; staged acceptance + paired-call trials + AI accuracy study | W1 |

The table above is an outline for the institution's core research presentation, not the current supplement's slide index. Replace its historical test count with the dated evidence actually presented. The rebuilt supplement has 14 slides with speaker notes: scope, roles, admission, state distinctions, waiting limits, local capacity evidence, admin entry, language, encounter/consent/retention, the CCTV capacity answer, evidence, writer assignments and the demo sequence. It does not replace the original methodology/results slides.

---

## 6. The CCTV question, applied to us ("How many can it handle?")

A CCTV thesis gets asked "how many cameras before it lags?" Our version: **how many doctor–patient consultations can run at once, at acceptable quality, without access errors or mixed records?**

What we learned from that question, and must say every time:

| Number people quote | What it really is | Why it is not our capacity |
|---|---|---|
| 10 waiting | Per-invitation waiting target (now enforced atomically) | Admission rule, not a video limit |
| 100 connections | LiveKit Build plan ceiling | Provider limit; 100 ÷ 2 = 50 pairs is arithmetic, not a test |
| 40 in the grid | Layout setting | Not a quota |
| 5,000 participant-minutes | Monthly free allowance | One 20-min two-person visit uses 40 → ≤125 visits/month, bandwidth may run out first (~98 at 1.7 Mbps) |

**Answer (W3, 30 seconds):** "We designed for one doctor and one patient per encounter. We have not measured a maximum number of simultaneous consultations, so we don't claim one. The 10 is a waiting rule, and 100 is LiveKit's plan limit, not our result. We tested that the waiting limit holds under 25 simultaneous arrivals in the Firestore emulator. The next experiment is 1, then 3, then 5 simultaneous pairs on separate devices, recording join time, round-trip time, jitter, packet loss and frame rate, and reporting the highest level that passes."

---

## 7. How to answer any question (20–40 seconds)

1. **Rule:** what the system does now.
2. **Reason:** why it's designed that way.
3. **Evidence:** test, demo step, or chapter/table.
4. **Limit:** what we do not claim, and the next test.

If you don't know: "We didn't measure that. Here is how we would." That is a correct engineering answer.
