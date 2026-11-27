# Panel Q&A: start here

27 November 2026. Source: `ec6803a`. This is the short rehearsal route; the [complete priority bank](panel-questions-and-answers.md) contains **97 questions**, retaining all 81 earlier topics and 16 additions. [Old-to-new number map](panel-question-number-map.md). Ranking reflects preparation risk and engineering judgment, not measured panel-question frequency or a guarantee of passing.

## First five answers everyone must know

### 1. How many consultations can the system handle at once?

One doctor and one patient is the intended encounter. The maximum number of simultaneous pairs has not been measured. A waiting limit and a provider connection allowance are different quantities. Our next experiment is controlled 1, 3 and 5 simultaneous pairs, with receiver quality, failures and service usage measured. Do not present that proposed experiment as a passed result.

### 2. What did you contribute if LiveKit already handles video?

The integrated workflow: server-owned invitation policy, clinician-controlled admission, encounter ownership, consented evidence and clinician-reviewed AI drafts. We did not invent WebRTC, an SFU or a diagnostic model. Show one complete synthetic patient journey.

### 3. Why does the title say secure?

It names the design goal and implemented controls, not a certification. Name a tested authorization or transaction case and its environment. We still require signed-in staging acceptance, broader adversarial testing and operational/privacy work before real-clinic release.

### 4. Does AI diagnose or prescribe?

No. It drafts from usable consented transcript evidence; the clinician must verify and edit it. Missing evidence can yield a deterministic insufficient-evidence record without a model call. Unknown risk is valid. A successful example does not establish clinical accuracy.

### 5. What can your evidence actually prove?

The survey describes perceived quality of the evaluated build. The latest follow-up passed 118 local regressions, a synthetic Chromium test across six phone/tablet/desktop sizes and local Firestore rule cases. The previous administrator-entry checkpoint had three signed-out browser checks. None measures a safe production call maximum or bilingual clinical accuracy. State the actual deployed commit and the build respondents evaluated if recorded.

## Access and administration demo

### Who grants staff access?

The provider-verified platform owner grants clinic administrators; they manage doctors only within their clinic. Both kinds of administrator are non-clinical and need a separate provisioned doctor identity for consultations. New Administrator grants no longer write Doctor authority. Existing combined claims are denied by clinical APIs and by the proposed Firestore rules once deployed. Environment-only bootstrap identities still need historical-claim migration for the direct Firestore boundary. Existing media credentials have a separate lifecycle. Patient accounts are not converted to clinicians.

### Why did administrator sign-in open Invitations?

The old entry linked to doctor login, whose successful paths always opened Invitations. Dedicated `/admin/login` now preserves administrator intent. The server access projection routes an authorized administrator to `/admin`; the UI cannot grant the role.

### Can anyone use administrator signup to become an admin?

No. `/admin/signup` creates a sign-in identity only. The owner must separately grant Administrator. An unapproved account receives pending-access guidance, not permission. Do not demonstrate self-promotion as a shortcut.

### Why did a granted account still behave like a doctor?

Check the selected role and the confirmed result. Doctor grants clinician access only; Administrator is a separate owner-only grant. Refresh the recipient's ID token with Check access again or sign in again after the correct grant. No live role is silently changed by a UI repair.

### Why did the owner show as a legacy doctor?

The old list conflated doctor provisioning with bootstrap authority. Effective Super administrator / Server bootstrap labeling now uses the verified Auth identity and server configuration. A historical doctor profile can still exist; that is a different fact. A profile email alone cannot bootstrap authority.

## Admission, AI and language follow-ups

### Is the waiting limit the call limit?

No. The default ten, editable from 1-100, is a per-invitation waiting rule. It is checked transactionally; the dated emulator report shows 25 arrivals into ten places ending at ten waiting with fifteen refused. Lowering a limit does not remove existing visitors. This does not validate a multi-patient clinical room or a global clinic cap.

### Does everyone wait, and is the queue FIFO?

Verified allowlisted accounts may enter directly; other accepted visitors need the doctor's decision. The list displays oldest first but the doctor selects whom to admit. It performs no clinical triage. Admitted means permission, not confirmed connection or completed care.

### Can two tabs represent different patients?

Distinct unauthenticated per-tab ids separate the fallback case, but a shared Firebase uid remains one principal and duplicated tabs can copy state. Use separate synthetic browser profiles/accounts for a repeatable multi-person demo. Typed email and network signals never establish patient identity.

### Is Tagalog/Taglish supported and validated?

The speech-note selector includes Filipino/Tagalog and English settings passed to browser recognition. Actual support and accuracy depend on browser/provider and environment. The current summary prompt requests English and preserves uncertain source terms. We have not measured bilingual error rates or clinical translation safety. Review negation, doses, names and durations against the source.

### Does chat enter the AI prompt?

No, not in the current active summary path. Chat is encounter history. Consented transcript evidence feeds the current summary path; attachments remain disabled. A rendered history chat panel is not proof of prompt provenance.

### Does revoking a role instantly stop all access?

No. Refresh tokens and claims change, but an already-issued Firebase ID token can remain accepted until expiry under ordinary verification. Existing LiveKit tokens have a separate lifecycle. A reviewed immediate-revocation policy needs end-to-end tests, not an untested one-line edit.

## History, consent, retention and responsive design

An invitation is reusable access policy, not one immutable encounter. Leaving and reopening can produce separate session records, including doctor-only openings. Do not merge by room name. Active encounters say **Not finalized** and cannot generate a summary; revocation is not the only completion event. No patient joined is a factual operational outcome, not a clinical diagnosis or proof of a scheduled no-show.

Each new entry starts transcription unchecked. Device preflight and fresh optional consent are intentional; reusing a room name must not silently restart capture. The call works without transcription.

The Firebase daily deletion worker is **opt-in**, defaulting to a 30-day cutoff. The corrected bounded page is 200 summaries plus 200 schedule entries. The Vercel daily cron retries summary work; it does not delete summaries. Other session/transcript/chat copies and backups are not fully purged. Age alone cannot prove deletion; the history label now says an older summary is unavailable. Production enablement and successful runs are unverified. Future attachments could reuse the bounded, idempotent worker pattern only after separate expiry, storage deletion and reconciliation tests; uploads remain disabled.

The compact call layout uses on-demand panels, with reserved panel space on wider screens. Expand participant details for captured arrival/admission/departure times and identity provenance; a self-declared email is not verified identity. Hashed invitation addresses cannot be recovered for display. Report viewport checks separately from real iPad/Safari media acceptance. The host is excluded from new direct-entry audience counts and cannot reserve a patient visit on the host account.

Scheduling remains disabled. The user selected doctor-booked appointments as the next bounded feature, with separate appointment records, timezone-aware times, overlap prevention and cancellation/rescheduling. An appointment must not grant consultation access or create clinical evidence. The design is not an implemented or surveyed result. See the [proposed design](../superpowers/specs/2026-11-27-doctor-booked-appointments-design.md).

## Demo sequence tied to questions

1. Open administrator entry with an approved synthetic account; show its effective authority and lack of clinical Invitations access.
2. Demonstrate the distinction between Doctor and Administrator grants, clinic scope and refreshed access. Do not alter real accounts during rehearsal.
3. Create a fresh invitation with a waiting target of two. Use separate synthetic visitor contexts; show a third new waiting arrival refused.
4. Raise the limit to three and retry. Explain that lowering it never evicts existing waiting visitors.
5. Admit one reviewed visitor, or show verified allowlist entry. Explain waiting/admitted/connected separately.
6. Conduct one synthetic patient encounter. Demonstrate optional consented speech notes and the language setting without claiming measured accuracy.
7. Show **Not finalized**, then end the encounter and show available evidence and draft/review state. If AI is unavailable, explain the actual state rather than pretending a live generation succeeded. Resize to phone/tablet and open/close the panels. Explain retention from the policy; do not run destructive cleanup during the demo.

For a five-minute team briefing use slides 2, 3, 4, 7, 9 and 11. Writer 1 covers scope/evidence, writer 2 access/queue, writer 3 numbers/AI/recovery; rotate once. The supplement does not replace institutional methodology and results slides.

## Manuscript and deployment boundaries

The manuscript remains **259 pages** with unchanged official title, numbering, objectives, survey data and project expenses. This follow-up updates printed **54, 59, 63 and 94** / PDF **66, 71, 75 and 106** for role separation, retention/future attachments, encounters and responsive call context. The historical consent qualifier remains printed **93** / PDF **105**. See the [exact page register](page-change-register.md). Public privacy masks and private submission boundaries remain separate.

A Ready deployment means a build/release event. Verify the actual frontend commit and signed-in behavior separately. The new administrator pages have not yet had signed-in production acceptance in this checkpoint. Do not claim the entire system is commercially ready or that other theses failed for a single universal reason. Remaining work and a bounded Claude prompt are in [the handoff](admin-entry-findings-and-claude-handoff.md).
