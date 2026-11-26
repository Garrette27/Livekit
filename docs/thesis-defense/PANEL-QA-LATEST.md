# TeleConsole — panel Q&A (LATEST, 27 November 2026)

**This is the file to study.** It is the short, panel-style version, in the order panels usually ask, with the demo moment that proves each answer. Long-form answers with sources and edge cases: [panel-questions-and-answers.md](panel-questions-and-answers.md) (Q1–Q76, numbers in brackets below). Demo script: [one-day-defense-guide.md §4](one-day-defense-guide.md). Live site: `livekit-frontend-tau.vercel.app` (production = `main`).

How to answer every question (20–40 s): **rule → reason → evidence (show it) → limit.** Never claim more than the objectives and Chapter IV support.

---

## A. The opening questions (Chair / adviser)

**"In one sentence, what did you build?"**
A web teleconsultation system for a dental clinic: the doctor sends a secure link, the server decides who enters, LiveKit carries the video, and AI drafts a summary that the dentist reviews. *Demo: steps 1–3.* [Q3]

**"What is your contribution if LiveKit already does video?"**
The integration and its rules: server-signed invitations, doctor-controlled admission, provisioned doctor roles, visit-bound access, consented transcription, evidence-gated AI drafts. We did not invent WebRTC. [Q3, Q67]

**"Did you meet your objectives?"** (Objectives are unchanged — printed pages 7–8.)
1. Platform with LiveKit and layered security — built; shown live; 78 automated regression tests.
2. AI summarization — built; draft labelled "review required"; insufficient-evidence records instead of invented content.
3. User-centred flexible access + ISO/IEC 25010 evaluation — built; 30 respondents, all groups "Highly Acceptable" (3.51–3.94).
Limit: perceived quality, not measured performance or clinical accuracy. [Guide §3]

**"Why 'secure' in your title?"**
It names the design goal backed by specific controls and tests, not a certification. We found and fixed our own weaknesses this week and kept tests for each. [Q4]

---

## B. Security (IT panelist — expect the hardest follow-ups here)

**"What if someone forwards the link?"**
The link is a key, not an identity. Anyone holding it can only knock; they wait until the doctor admits them. *Demo: guest in incognito waits.* [Q7]

**"Who skips the waiting room?"**
Only a signed-in, provider-verified account whose email the doctor put on that invitation. A typed email never counts. *Demo: verified patient enters directly; guest typing the same email waits.* [Q8, Q51]

**"Anyone can create a patient account — isn't that a risk?"**
No. Sign-up only creates the lowest role, which sees only that patient's own records; access to a consultation still needs the doctor's admission. That is the standard patient-portal pattern. [Q71]

**"Can anyone sign up as a doctor?"**
No. Doctor roles come only from an administrator. *Demo: /admin — grant a doctor role; show the audit-safe flow.* [Q52, Q72]

**"What if you revoke a doctor?"**
Their role is removed and other sessions end; a token already issued can last up to an hour — we say so honestly. [Q80]

**"Can another doctor see or admit my patients?"**
No. Every server action checks the acting doctor owns the invitation; a doctor id sent by the browser is ignored. [Q13]

**"What if a removed patient comes back?"**
They wait again — even if they are on the direct-join list — because the doctor's rejection outranks the list. [Q40]

**"Is the video end-to-end encrypted?"**
Encrypted in transit (TLS and WebRTC DTLS-SRTP); end-to-end encryption is available in LiveKit but not enabled. We say so in Chapter II. [Q35]

**"Did you do penetration testing?"**
No. We ran automated regression and emulator tests and an internal review; an independent penetration test is a recommendation (Chapter V). [Q48]

---

## C. The waiting room and numbers (often asked by the statistician or IT)

**"How many patients joined, and were they anonymous?"**
Each invitation now shows its visits by identification: e.g. "5 visits · 2 verified accounts · 3 guests". Guests include anonymous sessions and typed emails; the doctor's queue also shows how each person's identity was established. History labels unidentified visits "Unidentified patient". *Demo: View queue → Visits line.*

**"What is the waiting limit? What if the doctor raises it?"**
Default 10 per invitation, 1–100. The doctor can change it on a live invitation ("Save limit"); it applies to the next arrival. Lowering it never removes anyone already waiting — it only blocks new arrivals. It is enforced inside a database transaction (25 simultaneous arrivals into 10 places → exactly 10 in the emulator). *Demo: change 10 → 2, open a third guest, see "Waiting room is full".* [Q16–Q19]

**"Two guests on the same Wi-Fi — mixed up?"**
No: each tab/device is its own visitor (session, or network + browser + per-tab id). [Q81]

**"Is the queue first-come-first-served?"**
It displays oldest first, but the doctor chooses whom to admit; it is not triage. [Q9–Q10]

**"How many consultations can it handle at once?" (the CCTV question)**
Designed for one doctor and one patient per encounter. We did not measure a maximum, so we don't claim one. The 10 is a waiting rule; LiveKit's free plan allows 100 connections — a provider ceiling, not our result. Next test: 1, 3, then 5 simultaneous pairs on separate devices. [Q27, Guide §6]

**"Why only 5 dentists? Is 3.51 meaningful?"**
Descriptive for the selected respondents; purposive sample; no dispersion or reliability coefficient reported. Chapter V limits the conclusion accordingly. [Q38]

---

## D. AI (adviser / clinician-minded panelist)

**"Does the AI diagnose?"**
No. It drafts from consented transcript evidence; the dentist reviews and edits. Too little speech → an "insufficient evidence" record, risk "Unknown", never invented findings. *Demo: dashboard card "AI draft · review required"; Edit shows Risk "Unknown (not established)".* [Q5, Q64]

**"What if the patient refuses recording?"**
The call still works; each participant opts in separately. [Q44]

**"Is chat used in the summary?"**
No — chat is shown in history but is not AI evidence. [Q63]

**"Can the patient send an X-ray or photo?"**
Not yet, by design. Attachments need private storage, file checks, malware scanning, permission-checked downloads, retention and isolation tests; on Firebase it also needs the Blaze plan. Today the patient shows it on camera or shares the screen. Plan: `attachment-plan.md`. [Q69, Q70, Q76]

---

## E. "Can this become a business for small clinics?" (very common closing question)

**Answer:** "Yes, the access model is ready for it, and we would add two things before selling it."
- **Provisioning (already built):** a platform super admin creates a **clinic administrator** for each clinic; each clinic admin grants **doctor** accounts only inside their own clinic; doctors invite their own patients; patients self-register only as patients. Every grant is server-checked, recorded in an audit log, and nobody can change their own role. Pattern: **delegated, tenant-scoped administration with claims-based RBAC.** *Demo: /admin — clinic field and "manage only your own clinic".*
- **Per-area staff:** a doctor's patients are bound to that doctor's invitations, and each clinic admin only sees their own clinic's staff — a doctor in one area cannot see another area's list.
- **Before commercial use (honest gaps):** clinic-level record sharing and billing, data-privacy registration and processor agreements (RA 10173), paid hosting tiers, backups/restore tests, monitoring, an independent security test, and measured call capacity. [Q52, Q61, Q72–Q74; capacity-quality-costs brief]

**"How much would it cost a small clinic?"**
Modeled ≈ USD 70/month for ~440 twenty-minute visits (LiveKit Ship + Vercel Pro), excluding AI, backups, support and taxes. Planning estimate, not a quote. [brief]

---

## F. Process questions

**"You used Waterfall but changed code this week?"**
Iteration inside implementation and testing; fixes are documented with dated evidence. [Q49]

**"What would you do with one more month?"**
Staged acceptance tests, measured paired-call capacity, clinician review of AI accuracy, then attachments behind the safeguards. [Q50]

**"What did you change in the manuscript?"**
Same 259 pages and numbering; corrections on 37 pages; objectives and Chapter IV untouched. Register: `page-changes-2026-11-27.md`. [Q60]
