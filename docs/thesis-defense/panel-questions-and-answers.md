# Panel questions and answers: priority study order

28 November 2026. <!-- priority-order-v3 -->

Current bank: **100 questions**, re-ranked by importance on 28 November 2026 (priority-order-v3). Q1-Q20 are unchanged; scheduling, super-administrator privacy, clinic isolation, staff login routes and the device-menu fix moved into the Q21-Q40 follow-up band. Old numbers map to new ones in [panel-priority-order-v3-map.json](panel-priority-order-v3-map.json).

Questions 1–20 are the ones every writer must answer without notes; 21–40 are the next most likely follow-ups. The order reflects what a capstone panel probes first (title, security, contribution, AI and consent, numbers) and what the demo proves. Each answer is built as **rule → reason → evidence → boundary**. Numbers come from the dated evidence files and the in-room Call quality panel; anything marked *[fill in]* must be replaced with the team's own trial result or left out.

Use synthetic demonstration accounts only; never show real patient records.

### 1. Why did you choose this title, and can you defend every word of it?

Yes. Every phrase names something we built and can show.

| Title phrase | What it means in our system | Evidence we show |
|---|---|---|
| **Design and Development** | The objectives are build objectives: Chapter III designs (use case, DFD, ERD, architecture) were implemented as a working, deployed system. | Live demo on the deployed site; Chapter III figures match the routes and modules. |
| **Secure** | Layered, server-enforced controls: signed invitation links, Firebase sign-in with revocation checks, role-based access, waiting-room admission by the doctor, visit-bound credentials, HMAC-verified LiveKit webhooks, TLS and DTLS-SRTP transport, and an atomic waiting limit. | Dated automated regression/security-contract evidence and Firestore emulator transaction runs; all four respondent groups rated Security *Highly Acceptable* (3.64 dentists, 3.68 staff, 3.91 patients, 3.80 IT professionals). |
| **Telehealth Video Communication System Using LiveKit** | Real-time audio, video, screen sharing and chat over LiveKit's WebRTC SFU, with adaptive streaming and an in-room call-quality readout. | Demo call; Call quality panel shows measured round-trip time, jitter, loss and resolution. |
| **with AI Summarization** | Consented transcript → evidence gate → structured draft (OpenAI gpt-4o-mini) → clinician review and edit. | Demo of a draft marked *AI draft · review required*; an insufficient-evidence record. |
| **and Flexible User Access Design** | Three ways in: a verified allowlisted account enters directly, a guest with the link waits for the doctor, a registered patient uses the portal; separate doctor, patient and administrator workspaces. | Demo steps 3–6. |

"Secure" is used the way ISO/IEC 25010 uses the Security characteristic — a designed and evaluated quality of the product — not as a certification claim. Our scope and delimitation (Chapter I) state that boundary in writing, so the title and the manuscript say the same thing.

### 2. Why call it secure if you still have limitations?

Secure is our design objective, and we implemented and tested the controls that deliver it: signed invitation links, server-checked roles, a waiting room where only the doctor admits, credentials bound to one visit, revocation checked on every protected request, HMAC-verified webhooks and encrypted transport. Dated local regression/security-contract checks and Firestore emulator runs cover specific implemented invariants; they do not establish a penetration test or universal safety. Our IT-professional respondents rated Security 3.80, *Highly Acceptable*.

What "secure" does not mean is "certified" or "impossible to attack" — no honest system claims that. Chapter I's delimitation says exactly this: no penetration test or compliance certification was part of the study. The next step for a real clinic is an independent penetration test and a privacy impact assessment under RA 10173.

### 3. What did you build if LiveKit already handles video?

We built the healthcare workflow around the video. LiveKit moves audio and video; it has no idea who the patient is, who the doctor is, or who may enter. Our contribution is the part a clinic actually needs: doctor-owned signed invitations, verified direct entry or doctor admission through a waiting room, an atomic waiting limit, visit-bound credentials, per-encounter consultation records, optional consented transcription, and an AI draft the dentist reviews — with separate doctor, patient and administrator workspaces. We did not invent WebRTC or an SFU, in the same way a hospital system does not invent the network it runs on.

### 4. Does AI make diagnoses or treatment decisions?

No. AI assists documentation from consented evidence. Output is a draft requiring clinician review; sparse or absent evidence can produce a deterministic insufficient-evidence record without inference. The clinician remains responsible for source review and medical decisions.

### 5. Can the AI summary be generated without the patient agreeing to transcription?

No. Transcription is opt-in for each participant, separately, every encounter. The patient's audio is never transcribed unless the patient ticks the consent box; the doctor cannot consent for them. The browser speech-notes fallback is started only by the clinician after confirming verbal consent, and it is labelled as such. If there is no usable consented transcript, the system stores a deterministic *insufficient evidence* record without calling the AI at all — it never invents a summary. The call works the same with transcription off.

### 6. Why can one invitation have several history rows? Is that a proven design?

Yes — it is the standard way healthcare systems model visits, and it is what AGENTS.md requires.

**The one-line idea: an invitation is a door key; an encounter is each time someone actually walks through the door.**

- The **invitation** is an access policy: *this room, these verified patients may enter directly, everyone else waits, valid for 24 hours.* It can be reused until it expires or the doctor revokes it.
- An **encounter** is one actual consultation: the room opened, people joined, talked, and left. Each encounter gets its own session id, its own transcript, its own summary and its own review status.

**A concrete day with one 24-hour invitation**

| Time | What happens | History row |
|---|---|---|
| 09:00 | Doctor creates the invitation (Active) | — |
| 09:05–09:20 | Patient consults, then leaves | **Encounter A** — finalized, summary drafted, dentist reviews it |
| 09:30 | Doctor reopens the room alone to test the camera | **Encounter B** — "No patient joined" (non-clinical) |
| 14:00–14:15 | Patient returns for a follow-up | **Encounter C** — its own summary |
| 18:00 | Invitation still Active until it expires | Three rows, one invitation |

While someone is still in the room, that encounter shows **Not finalized** and cannot be summarized yet.

**Why not merge them into one row per invitation?** Because merging would break three rules:
1. A dentist's **reviewed** summary for A would be overwritten when C is generated — AGENTS.md says reviewed content must never be overwritten.
2. The follow-up's evidence would be mixed into the first visit's record, so a summary could cite something said at a different visit.
3. The doctor's camera test would look like a missed patient appointment.

**Where this pattern comes from.** HL7 FHIR, the international health-data standard, keeps *Appointment* (the plan) and *Encounter* (each actual interaction) as separate records. Zoom does the same: one recurring meeting ID, but every time it is started it gets its own instance and its own attendance report. Revoking the invitation stops *future* entry; it does not decide when a past consultation ended.

### 7. Why is transcription consent asked again when the doctor rejoins?

Because consent belongs to the encounter, not to the person forever. The doctor agreed to transcription for the *previous* encounter; leaving the room ended it. Re-entering starts a new encounter — possibly with a different patient — so the box starts unticked and asks again. It costs one click.

This is the established pattern: Zoom and Microsoft Teams announce recording at the start of every meeting, and the Data Privacy Act (RA 10173) requires consent that is specific, informed and freely given — a tick for yesterday's visit is not consent for today's. AGENTS.md makes the same rule explicit: each participant opts in for the session, and the call works with transcription off. Device preflight also reappears on purpose, because the camera or microphone may have changed since the last visit.

### 8. How many simultaneous consultations can the whole app handle?

We designed for one doctor with one patient per encounter, and the numbers we can state are:

- **Provider ceiling:** our LiveKit Build plan allows **100 concurrent connections** — at most **50 doctor–patient pairs** at one instant, and **5,000 participant-minutes** a month, which is about **125 twenty-minute consultations** a month.
- **Our own measurement:** every call has a **Call quality** readout (round-trip time, jitter, packet loss, received resolution and frame rate). A proposed rehearsal trial would run **1, 3 and 5 simultaneous pairs** on separate devices; claim results only if the team actually recorded them: *[fill in from today's trial sheet — e.g. "5 pairs: RTT ≤ __ ms, loss ≤ __ %, 720p at __ fps"; if the trial was not run, say only the two bullets above]*.
- **Admission load:** the waiting limit holds at its maximum — 120 arrivals in waves of 10 into a limit of 100 ended with exactly 100 waiting and 18 refused (emulator run).

So the provider ceiling is 50 pairs; what we have measured is the level in our trial sheet; we do not claim beyond what we measured. The clinic must measure its own workload before selecting an operating plan.

### 9. Did you do anything about video and audio quality?

Yes, using LiveKit's built-in quality features rather than custom code: **adaptive streaming** (each viewer receives the size that fits their screen), **dynacast** (the sender stops sending layers nobody watches), **simulcast** (weak connections get a lower layer instead of freezing), a **720p** capture target, browser **echo cancellation, noise suppression and automatic gain**, and **redundant audio (RED)** for lossy networks.

We also added a **Call quality** panel inside the room that shows the live measured numbers — round-trip time in ms, jitter in ms, packet loss %, and the resolution and frame rate actually being received and sent — with a *Copy measurement* button for trial logs. So when asked "how good is the video?", we open the panel and read the real numbers instead of guessing.

### 10. How many patients can wait?

Each invitation has a waiting limit the doctor sets: **default 10, allowed 1 to 100**. The limit is checked inside the same database transaction that creates the waiting place, so it cannot be overshot. Measured on Firestore's transaction engine (emulator):

| Trial | Limit | Arrivals | Result |
|---|---|---|---|
| Two arrive together at 9 of 10 | 10 | 2 at once | exactly 10 waiting, 1 refused |
| Burst | 10 | 25 at once | exactly 10 waiting, 15 refused |
| Maximum, realistic | 100 | 12 waves of 10 | exactly 100 waiting, 18 refused, 2 asked to retry |
| Maximum, extreme | 100 | 150 in the same instant | never above 100; most were asked to retry |

Evidence: `docs/thesis-defense/evidence/queue-capacity-fix-2026-11-27/emulator-capacity.json`. The limit is per invitation — an admission rule, not a video-call limit.

### 11. Can you guarantee the eleventh patient is rejected?

Yes — for one invitation with a limit of ten, the eleventh new visitor who needs a waiting place is refused with "Waiting room is full". The check and the reservation happen in one transaction, so two people cannot both take the last place. Measured: 2 visitors arriving together at 9 of 10 ended at exactly 10; 25 arriving at once into 10 places ended at exactly 10 with 15 refused.

Two people are deliberately *not* counted as new: a patient who is already waiting and refreshes keeps their place, and a verified allowlisted patient who enters directly never takes a waiting place. If the doctor lowers the limit below the current count, nobody is removed; new arrivals wait until the queue falls below the new limit.

### 12. What happens if the doctor raises or lowers the waiting limit?

The owning doctor changes it on a live invitation (View queue → waiting limit → Save limit, 1–100). The reservation reads the limit inside its transaction, so the change applies to the very next arrival. Measured in the emulator: limit 2 with three arrivals → 2 waiting, 1 refused; raised to 3 → the next arrival got in; lowered back to 2 → the next arrival was refused and **all 3 already waiting stayed**. Lowering never removes anyone.

### 13. You use a database transaction. How does that guarantee the limit under simultaneous arrivals?

The transaction does two things together: it **counts** the people waiting and it **writes** the invitation document as part of reserving a place. Firestore allows only one of two transactions that write the same document to commit; the other is automatically retried, re-counts, and now sees the first person's place. So the count and the reservation behave as one indivisible step. The rule we follow is simple: every business rule the decision depends on — here, the waiting count — must be read inside the same transaction that commits the decision. The emulator trials in question 10 show the result: never above the limit, in any trial.

### 14. Does every patient wait?

No. A patient whose **verified** account (Google or a provider-verified email) is on the invitation's direct-entry list — up to **50 addresses** per invitation — enters immediately. Everyone else who opens the link waits for the doctor, including anyone the link was forwarded to and anyone who only *types* an email. A full waiting room does not block either the verified patient or someone already waiting who refreshes; it only blocks a new person who would need a new place. Expiry, revocation and consent apply to everyone.

### 15. Is ten waiting the same as ten live video participants?

No. Waiting and being in the call are different things. A waiting patient holds a *waiting* credential that cannot publish or receive any audio or video, and the waiting page does not open a media connection or turn on the camera at all — devices are requested only on the visible preflight after the doctor admits. So ten waiting patients use zero video connections. Only admitted participants count toward LiveKit's 100-connection plan limit.

### 16. Two patients share one invitation link. Can they see each other?

Not while waiting: waiting credentials carry no media permissions, and the waiting page opens no room. The doctor admits each person individually. Our workflow is one invitation per patient encounter, so the doctor sees one patient at a time; if a doctor deliberately admitted two people from one link, they would be in the same room, which is why the doctor reviews each visitor's identity before admitting.

### 17. Is the video end-to-end encrypted?

**Yes.** Every audio frame, video frame and chat message is encrypted in the browser with AES-GCM before it leaves the device, using LiveKit's end-to-end encryption. LiveKit's servers forward only ciphertext they cannot read. This sits on top of DTLS-SRTP and TLS in transit.

- **Who gets the key:** our server derives one key per room from a secret that LiveKit never sees. It releases the key only to someone holding a valid consultation credential for that room. Waiting-room visitors never get it, so they cannot see or hear the consultation even in principle.
- **Evidence:** in our trial, a real LiveKit server ran with four browsers. The doctor and patient decoded each other's video (506 frames) with zero decrypt errors. An eavesdropper with a wrong key decoded **0** frames, and so did one without encryption. Rerun with `scripts/thesis/e2ee-media-trial.mjs`; the result is in `evidence/e2ee-trial-2026-11-27/`. In a call, the **Call quality** panel reads *End-to-end encrypted*.
- **No silent fallback:** a browser that cannot encrypt is told to use current Chrome, Edge, Safari or Firefox. It is never joined in plaintext.
- **Boundary:** this hides media from the video provider, not from our own application server, which could derive the key but never receives media. The manuscript describes transport encryption; end-to-end encryption was added afterwards as hardening. AI transcription still works because each browser transcribes its own microphone before encryption, and only with consent.
- **Check before answering:** the Call quality panel must read *End-to-end encrypted*. If it reads *In transit (DTLS-SRTP / TLS)*, then `LIVEKIT_E2EE_SECRET` is not set in production. In that case the honest answer is transport encryption only, with E2EE built and tested but switched off.

### 18. Does OpenAI keep the transcripts?

Only transcript text from consented participants is sent, and only for the summary. Under OpenAI's published API data policy, API data is **not used to train models** by default and is retained for up to **30 days** for abuse monitoring, after which it is deleted; zero-data-retention is available to approved organisations. Audio is discarded after transcription. Before a real clinic go-live, the clinic signs a data-processing agreement and completes a privacy impact assessment under RA 10173.

### 19. Is the chat used in the AI summary?

No. The AI summary uses only consented, speaker-attributed transcript evidence. Chat is saved with the encounter and shown to the clinician in history, but it is never sent to the AI. That is deliberate: chat has no per-participant consent for AI processing and can contain pasted or untrusted text, so adding it would weaken the evidence rules.

### 20. If an administrator revokes a doctor, is access cut immediately?

Yes, for everything our server controls. When an administrator revokes a doctor, the server removes the role, revokes the account's refresh tokens, and every protected API checks revocation on every request (`verifyIdToken(token, checkRevoked)`, Firebase's documented pattern). The very next request — create invitation, admit, view history — is refused with "Your access has changed". Changing someone between administrator and doctor does the same.

One honest detail: if the revoked doctor is *inside a call at that moment*, that media connection continues until they leave or are removed, because LiveKit room credentials are self-contained (doctor credentials last up to 4 hours). They cannot obtain a new one.

### 21. Is appointment scheduling implemented, and what happens when a booking is cancelled?

Yes. Doctors book, reschedule and cancel their own visits at `/doctor/appointments`; **Prepare invitation** opens the invitation form with a room derived from the booking id (no patient name or email in the link). The server owns ownership, UTC + named-zone times (nonexistent/ambiguous daylight-saving times refused), a per-doctor lock plus overlap query in one Firestore transaction, idempotent create retries and versioned reschedule/cancel. Cancelling follows the calendar-cancel pattern: the appointment becomes `cancelled` with FHIR-style metadata (cancellation time, the doctor, a coded reason such as *Patient request*, never free text) and the server revokes that doctor's active invitations for the visit room, removing anyone waiting, so a cancelled visit no longer has an open door. The record is kept, struck through, with that metadata. Booking itself grants no admission or consent; no reminders are sent. The survey did not evaluate this module.

### 22. Where is consultation scheduling in the demo, and why is it separate from invitations?

Show it after the invitation flow: book a synthetic visit, try an overlapping time to show the refusal, then choose **Prepare invitation** and issue the link as usual. Planning (Appointment), admission (invitation) and what actually happened (Encounter) are separate records, following HL7 FHIR's separate Appointment and Encounter resources as a design precedent, not a claim of FHIR conformance. Keeping them separate means rescheduling never changes who may enter, and a revoked invitation never rewrites the schedule. If the deployment flag is off the menu is hidden; say so rather than enabling it live. Reminders, recurrence, patient self-booking and calendar sync remain future work.

### 23. Are summaries deleted after 30 days, and which job does that?

Yes, when the clinic switches it on. A daily Vercel cron (`/api/maintenance/summary-retention`, 03:00 UTC) deletes AI summaries whose `createdAt` is older than the window (default **30 days**), at most **200 per run** plus each summary's schedule row, so 400 writes stay under Firestore's 500-write batch limit (about 6,000 a month, far above our ~125 consultations a month). It moved from a Firebase scheduled function to Vercel because scheduled functions need the paid Blaze plan. Deletion is opt-in (`RETENTION_ENFORCEMENT_ENABLED=true`); otherwise each run is a dry run that only counts. Every run writes a metadata-only receipt (window, cutoff, counts) shown in the super-admin oversight panel, which is our evidence that deletion ran. Consultation records, chat, transcripts and provider backups are outside this job.

### 24. Why not give the super admin access to every consultation and summary?

Platform responsibility does not establish a treatment relationship or ownership. Routine provisioning, configuration and reliability work can use bounded metadata. Server clinician permissions continue to deny administrators. Any exceptional support access would need an explicit purpose, narrow/time-limited authorization, approval, auditing and privacy review; no blanket clinical grant or patient-data export is proposed. This applies [OWASP least privilege and per-object authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### 25. Is a clinic id in the URL enough to isolate clinics?

No. The server derives the caller's clinic from verified authority and checks action, target clinic and ownership on every request. A browser-supplied id or hidden navigation is not authorization. Clinic administrators cannot manage another clinic or grant administrator authority; clinical records remain doctor-owned. Current staff-scoping preparation is not evidence that all future tenant data is isolated. New endpoints need explicit cross-clinic denial tests. [OWASP resource and tenant checks](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html).

### 26. Why three staff login pages if Firebase signs in everyone?

They express three different tasks and prevent an administrator from landing in a clinician workspace: `/doctor/login`, `/admin/login` for a clinic administrator and `/super-admin/login` for the platform owner. The two administrator entries reuse one implementation and the same server-scoped `/admin` workspace. Authentication establishes the account; trusted claims/configuration authorize its work. A wrong-audience account is rejected/signed out; signup grants no privileged role. The pages neither create three authentication systems nor replace API checks.

### 27. Why must administrators use a separate doctor account?

Separation of duties: administrative identity manages staff, while a separately provisioned doctor identity owns clinical work. `/doctor/login` rejects administrator identities, `/admin/login` admits clinic administrators and `/super-admin/login` admits the configured platform owner; Google/password authentication must pass the same server-derived role checks. Both administrator levels reuse `/admin` with server scope. The route is guidance; APIs and Firestore Rules remain the boundary. Legacy mixed claims/profile fallback and already-issued media credentials retain their documented migration/expiry limits. We accept another sign-in for people doing both jobs to avoid turning staff-management access into clinical ownership.

### 28. If you sold this to several small clinics, how would accounts be provisioned?

Use **delegated, tenant-scoped administration**: the platform operator grants clinic administrators; each clinic administrator manages doctors only in their verified clinic; doctors own their encounters. This follows the provider control-plane/tenant application distinction described by [AWS](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/control-plane-vs.-application-plane.html). The source already has `clinicId` role checks and separate administrative/clinical identities. A tenant catalog, complete staff pagination, billing and aggregate oversight remain future work. The thesis evaluated a single clinic; staff scope preparation does not prove commercial multi-clinic readiness or clinical sharing.

### 29. Is the super-admin/clinic pattern based on a proven company architecture?

Yes as an architectural precedent: AWS separates a provider control plane from the tenant application, and Azure distinguishes global and tenant administration. We adapt that to platform oversight, clinic-scoped staff administration and doctor-owned clinical work. It is a researched design choice, not proof of healthcare compliance or an endorsement. Current provisioning implements part of it; the full oversight dashboard is proposed. [AWS](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/control-plane-vs.-application-plane.html), [Azure](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/control-planes).

### 30. When an invitation is revoked, do credentials already issued stop working?

Every credential is checked against current state when it is used. Invitation status and expiry are rechecked on every token request, so a revoked link stops issuing credentials immediately. Waiting credentials carry the visit id, so a credential from an earlier visit is refused for a later one. Staff API access is refused on the next request after revocation. A consultation credential already inside a live call keeps working until that participant leaves, and the doctor's **Remove** action disconnects them at once.

### 31. What caused the microphone/camera menu, layout and blinking bugs, and how were they fixed?

One root cause. LiveKit scopes its component styles and layout variables (`--lk-bg2`, `--lk-control-bar-height`, `--lk-grid-gap`) under a `data-lk-theme` root, which LiveKit's docs place on `<LiveKitRoom>`. Our in-call room never had it; old `!important` overrides hid that until they were removed. Without it the device popup was transparent with dark bulleted options on the black stage, the tile grid's height calculation was invalid so tiles collapsed to the top leaving empty space, and the grid kept re-measuring (blinking). The fix adds `data-lk-theme="default"` to the in-call `LiveKitRoom`, pinned by a regression test. Earlier, a CSS rule had also clipped the popup, and a browser that *blocks* camera/microphone shows an empty list; the room now explains that case. A separate *video* flicker on a single-PC test is still under investigation: a controlled two-browser reproduction with the same SDK, E2EE, VP8 simulcast and room options showed 0 freezes and 0 dropped frames, so we do not claim a root cause yet. The room has opt-in diagnostics (per-second WebRTC deltas and track lifecycle, redacted) to test camera sharing, devices and background tabs one variable at a time. See the [video stability note](../livekit-video-stability.md). Physical-device acceptance on the deployment is done by a person. See the [device-menu design](../livekit-device-menu-design.md).

### 32. Is the app tested on phones and tablets?

The interface is responsive and automatically tested on every build at **six screen widths — 320, 390, 768, 820, 1024 and 1280 px**: forms fit, there is no sideways scrolling, and on phones and tablets the waiting queue and session panels open on demand so they never cover the video. Our patient respondents rated Flexibility **3.97**. Physical devices still matter for camera and microphone permissions, so before the defense we also ran the call on an actual phone; for a clinic rollout, the supported-device list is confirmed on the clinic's own phones and tablets.

### 33. Can patients speak Filipino, Tagalog or Taglish, and what language is the summary?

Yes for speech: the clinician's speech-notes selector offers **Filipino/Tagalog (fil-PH)** and **English (en-US)**, and Taglish is handled by the recognition engine for the selected language. The summary is written in **English** — the clinic's record language — and the prompt tells the model to keep uncertain names, medicines, measurements and short Filipino phrases as spoken rather than guess a translation. Because recognition quality depends on the browser and microphone, the dentist reviews negations, doses and durations against the transcript before approving the draft.

### 34. Why have a waiting queue when the patient has a valid link?

A link can be forwarded. It proves possession of a scoped capability, not the holder's identity. Waiting admission lets the owning doctor inspect the visitor's displayed identity provenance and decide whether to grant consultation access. This preserves a guest path without treating typed email as verification.

### 35. Who is the first administrator? Isn't that a chicken-and-egg problem?

The server-only SUPER_ADMIN_EMAILS configuration recognizes the owner's provider-verified account. It bootstraps administration without relying on a pre-existing doctor profile or an administrator signup checkbox. The platform owner grants clinic administrators; those administrators manage doctors in their own clinic. Self-change and bootstrap-account guards constrain role commands, but do not make a compromised owner account harmless. Protect the hosting environment and authentication account, and define recovery procedures.

### 36. Two guests use the same clinic Wi-Fi and the same browser. Do they get mixed up?

No. Each browser tab gets its own random session id, so two guests on the same Wi-Fi and the same browser get two separate queue rows — a regression test checks exactly that case. A signed-in patient is identified by their verified Firebase account instead, so one account is one person across tabs. None of these signals ever grants direct entry; only a verified allowlisted account or the doctor's admission does.

### 37. Can you reuse that scheduled worker for future attachment retention?

Yes — we would reuse the *pattern*, not the same query. The summary worker already shows the shape: scheduled daily, bounded batch, opt-in switch, idempotent (safe to run twice). Attachment cleanup would add per-file expiry, deleting the stored file *and* its metadata together, a reconciliation pass for half-finished deletions, and tests for dry runs, expiry boundaries and duplicate runs. Attachments are disabled today, so this is the documented plan, ready for when uploads are enabled.

### 38. If the patient refreshes, do they use up another invitation use?

No. A refresh during an open visit reuses the same queue row and visit id and spends no use. Only a genuinely new visit (after leaving or being rejected) spends one.

### 39. The patient opened the call on a second device. Does the queue think they left?

No. LiveKit disconnects the first device and reports it left; before marking the patient as left, the server checks whether the same identity is still connected and whether the departing connection belongs to an earlier visit. The patient stays in the call on the new device.

### 40. The doctor clicked Admit on an old screen after the patient left and came back. What happens?

The Admit command carries the visit the doctor was looking at. If the patient has since left and started a new visit, the server returns a conflict and asks the doctor to refresh and review again — the doctor never admits someone they did not actually see. This is an expected-version check, the same pattern used to prevent two editors overwriting each other.

### 41. A doctor rejects a visitor. What stops them reopening the link and queueing again?

Reopening starts a new visit at the back of the queue, and it always waits — even for a verified account on the direct-join list, because the doctor's rejection outranks the list. The doctor sees them again and can reject again. To stop the link entirely, the doctor revokes the invitation, which every token request rechecks. We chose this so one mistaken click does not permanently lock out a real patient, while a removed person can never walk straight back in.

### 42. What if the patient's phone dies after being admitted?

Short network drops are handled by LiveKit's own reconnection. If the page is lost, a verified allowlisted account that reopens the link rejoins its open admission directly; anyone else reopening goes back to waiting on the same entry and the doctor re-admits them. A dropped call is not treated as a completed or failed consultation by itself.

### 43. Does removing a patient, or a visit where no patient joined, call the AI?

No, not automatically. Removal changes the queue; encounter finalization, eligibility and evidence quality are separate decisions. When no patient was present (no-show) or nobody was admitted, the server writes a deterministic *No patient joined* / *Patient not admitted* record and returns **before** any AI entitlement check or OpenAI request; a regression test pins that order. Insufficient transcript evidence likewise produces a deterministic record with no AI call. OpenAI is called only for an attended encounter with enough consented evidence, and its output is a draft that requires clinician review.

### 44. What load do ten waiting patients create?

At the nominal interval, ten pages imply roughly 200 admission HTTP checks/minute, before timing effects or other work. That is arithmetic, not measured database reads. Authorization, invitation reads and rate counters can add operations. The number does not measure video capacity or AI throughput.

### 45. Why does consultation history take a while to load?

Each consultation's chat transcript is a separate Firestore query, so a doctor with ~50 consultations triggered ~50 extra reads before anything showed, plus a serverless cold start. The dashboard now shows the summaries first and adds chat transcripts when they arrive. A paginated history endpoint and measured timings are the next step; we have not published a latency figure.

### 46. How is a doctor account created? Show us.

The clinician first creates a Firebase sign-in identity. An authorized administrator opens /admin, selects the clinic and Doctor role, and submits. The server checks authority, clinic scope and the patient-account guard, writes claims/profile metadata and records a uid-only audit event. Grants do not revoke sessions. The recipient signs in again or explicitly refreshes access to get the new claim. Administrator grants are a different operation available only to the platform owner. Revocation has the separate existing-token window described below.

### 47. Does the new administrator signup let anyone become an administrator?

No. It creates a Firebase Authentication identity only, without writing a privileged profile or custom claim. Google can establish that identity too. The platform owner separately grants Administrator within a clinic. An unapproved identity receives pending-access guidance and can refresh after approval. Never use a client-selected role or signup URL as authority. Demonstrate an unapproved identity being denied by the admin API as well as the page.

### 48. What do you do when newly granted access does not appear, or the account service is down?

Refresh the recipient's token and re-query the server access projection; granted claims are not automatically present in an already-issued token. Keep a visible checking, pending or retry state. An Auth lookup outage must not be labeled as a deleted account, and an unsuccessful request must not be shown as an empty account list. No client retry grants a role. Existing-token revocation limits remain separate.

### 49. Can anyone sign up as a doctor?

No self-service flow may grant a clinician role. Firebase sign-in creates an identity; profile behavior depends on the entry route. Authorized administrators grant privileges through the console or provisioning script. Firestore rules refuse an unclaimed client-created doctor profile. A documented server-read legacy clinician-profile fallback still exists for older accounts; it needs an audited migration before removal. Do not describe current authorization as universally claim-only. Protect Firebase administrative credentials and verify clinician eligibility operationally.

### 50. A patient account wants to become a doctor. Can the admin convert it?

No. Granting a clinician role to an existing patient account is refused; clinicians use a separate account. This keeps a person's own health history from mixing with clinician access.

### 51. Can another doctor admit my patient?

The server derives the acting doctor from verified authorization and checks scope. A doctor id supplied in a query/body cannot grant ownership. Test with two unrelated synthetic doctor accounts in staging rather than inferring safety from hidden buttons.

### 52. How would you validate bilingual AI summaries rather than just demonstrate them?

Use synthetic or explicitly consented paired Filipino/English scripts reviewed by a qualified clinician and bilingual reviewer. Compare source speech, captured text and generated draft separately. Record recognition errors, omissions, unsupported facts and translation changes to negation, dose, duration and names; assess reviewer agreement and report failures. A few correct examples do not establish accuracy. The current study's acceptability survey is not that experiment, and the clinician must verify the draft.

### 53. What happens to the data after 30 days?

Only the AI summary is deleted, and only when retention enforcement is switched on; the daily run's receipt records how many were deleted. Consultation records, messages, transcripts and provider backups are not deleted by this job, so we do not claim everything disappears after 30 days. A clinic would approve a full record-retention schedule before real patient use.

### 54. Who can see a consultation's record?

The owning doctor receives the authorized clinical projection; the patient bound by a verified uid receives their own encounter history, not the clinician's full AI draft. A typed guest email grants no historical ownership. The administrator console now manages staff access metadata; it does not establish shared clinic-wide clinical-record access. Faculty reviewer access remains backend-only and deny-by-default. Privileged Firebase operators are a separate infrastructure trust boundary.

### 55. Does the doctor count as a verified patient visit?

No. Creating an invitation, appearing in the direct-entry audience configuration and joining as its owning doctor are not patient visits. Patient counters must be based on reserved patient visits, not the host's presence. Verified-account visits and guests describe identity provenance, not unique people or completed consultations. Reconnects reuse the same active visit. Older invitations may only have a historical aggregate join count; do not invent a verified/guest breakdown for them.

### 56. How many patients used a link, and were they anonymous?

Each invitation records its visits by identification kind inside the same transaction that admits the visit: verified accounts, unverified accounts and guests (anonymous sessions or typed emails). The card shows e.g. "5 visits · 2 verified accounts · 3 guests"; reconnects are not counted twice. Older invitations created before visit counting was added show only their total join count.

### 57. What belongs in the consultation room rather than repeating invitation management?

Show operational context: room/session identity, waiting occupancy versus its configured cap, verified direct-entry audience count, and participant state. Put captured arrival/admission/departure times and identity provenance in expandable details. Never label self-declared email verified or admission as confirmed media attendance. Teams and Zoom use participant/lobby controls separate from richer attendance reports; that is a useful design precedent, not proof of our app's usability. Hashed invitation emails cannot be recovered for display; show recorded participant identities truthfully and manage the invitation separately.

### 58. If a guest has no account, how is their queue entry kept across a refresh?

By the server-verified Firebase uid when a session exists. Without a Firebase session, the fallback combines keyed network/browser signals with the per-tab session id when supplied. Reloading that tab reuses its entry; an email is only a label. A shared Firebase uid still represents one principal across tabs, and duplicated tabs can copy session storage. Do not promise that every tab is a separate person or treat the tab id as identity verification. Use separate browser profiles/accounts for repeatable multi-person testing.

### 59. What happens if the patient refreshes or returns?

A refresh during the same visit reuses the same queue row and keeps the person's place and visit id. If the visit had ended (left or rejected) and the person reopens the link, the same row starts a **new visit**: new visit id, new arrival time, old end markers cleared. Waiting and admission credentials carry the visit id as a signed claim, and the server refuses a credential from an earlier visit when it polls admission or sends a "left" beacon. Boundary: a consultation credential already issued stays valid until it expires (up to two hours) — the doctor can remove that participant from the room, but we do not claim instant revocation.

### 60. Does active-only filtering eliminate archive reads?

No. It limits the projected result. Some current doctor-list paths fetch the doctor's rows before status/freshness filtering. Large archives therefore need indexed bounded queries and pagination. An empty displayed queue does not prove a zero-read operation.

### 61. How quickly does admission appear?

The patient checks immediately and then about every three seconds, with overlap protection and cleanup. Network delay, throttling and errors can extend that. It is an implementation interval, not a guaranteed three-second response SLA.

### 62. Are patient and doctor updates both Firestore listeners?

No. The doctor uses change invalidations that trigger authenticated API re-query, plus a default fifteen-second foreground reconciliation. The patient's waiting page polls the admission API about every three seconds. A loading spinner is not proof of continuous successful synchronization.

### 63. Does the shared coordinator eliminate all duplicate requests?

It shares an in-flight request and polling scope within one browser runtime. Separate tabs, devices, users and different scopes can still issue requests. Changes/actions can trigger additional refreshes. Do not describe this as a global distributed cache.

### 64. What if Firestore or the network fails?

Use visible error/retry states and retain the distinction between unknown/stale state and an empty queue. Do not bypass admission to keep a demonstration moving. Database outage behavior is separate from optional AI availability. A real deployment needs monitoring and a recovery process.

### 65. What would most likely break during your demo, and what is your plan?

Provisioning (doctor must hold the claim), venue network or camera permissions, AI availability, and a duplicate tab replacing a patient's connection. We freeze the build, test on a preview first, keep a one-click rollback to the previous production deployment, use a fresh invitation, and have a hotspot and screenshots as backup. If AI is unavailable, the call still works and the record says so.

### 66. Is the production site running these fixes?

Answer truthfully for the day: either "yes, merged at commit …, tested on preview first" or "the fixes are on our pull request preview; production runs the evaluated build". Do not claim a deployment you have not verified.

### 67. Why so many fixes the week of the defense — doesn't that undermine your results?

Distinguish the evaluated build from later maintenance. Report the actual survey date/build if recorded; do not claim respondents tested today's admin console, security fixes or media settings. The original survey results and objectives remain unchanged, while dated engineering evidence describes later changes. Similar-looking screens do not establish that a change has no effect on study validity. Ask the adviser how to present this separation.

### 68. How do you know your tests test the real code and not a copy?

The regression tests load the actual TypeScript modules and replace only the database and network with synthetic fakes. The queue fix was additionally run against the Firestore emulator's real transaction engine. Neither is a production test.

### 69. Does flexible access mean anyone can become a doctor?

No. Patient admission alternatives are separate from staff role provisioning. Google authenticates an account; trusted provisioning and server permissions authorize clinician actions. The identity provider does not verify a medical license for this application. Real-clinic onboarding and review of existing privileged accounts remain operational gates.

### 70. Chapter I says patients get "device, browser, and location validation". Does the app do that?

No, and it should not. That sentence describes an early design. The current app does not use device fingerprints, browser checks or IP location to admit anyone, because none of those prove who a person is and they collect personal data. Admission is a verified allowlisted account or the doctor's decision. Table I's ip-api.com row is marked "not used". Ask the adviser to correct the Chapter I sentence (printed page 3).

### 71. Appendix C shows code that reads IP geolocation, stores device fingerprints and asks the AI for "prescriptions" and a Low/Medium/High risk. Is that the system you evaluated?

Appendix C is labelled as historical excerpts. The current summary code tells the model to use only facts in the transcript, allows "Unknown" risk, and stores a deterministic insufficient-evidence record when there is not enough transcript. Be precise about timing: if respondents evaluated an earlier build, say so; do not claim the survey evaluated today's code.

### 72. Four of five dentists came from other clinics. Does "for Henry Cheung Dental Clinic" still hold?

The design followed the beneficiary clinic's workflow; the evaluation added outside dentists for broader professional opinion. That supports perceived acceptability among dentists generally, not proof that the beneficiary clinic adopted it.

### 73. Waterfall says each phase is finished before the next. You fixed code during the defense week. Is that still Waterfall?

In practice we iterated inside the implementation and testing phases. Say that honestly rather than claim a strictly linear process; the fix is documented with dated evidence like any maintenance change.

### 74. What design patterns did you use?

Deep modules behind small interfaces (invitation access service, queue coordinator); pure decision functions with IO adapters (admission policy, `planWaitingArrival`); transactions for coupled writes (use counting, capacity, queue row); expected-version checks (visit ids); Command/Fact separation for lifecycle; realtime as invalidation with authenticated re-query; adapter around LiveKit; claims-based RBAC.

### 75. What were the architectural risks you found in your own design?

We found guest-key trust, capacity check/commit races, stale visit commands, and unclear identity-versus-role routing. Specific queue cases have local regressions and emulator evidence. Those fixes do not establish complete replay isolation across every already-issued token or eliminate the documented legacy privileged-profile fallback. Authentication, operational queue state, clinical encounter state and displayed labels must remain separate authorities.

### 76. If you had one more month, what would you do first?

A staged acceptance run: deploy the fixed commit, run the two-account replay and cross-doctor tests, then paired-call trials at 1, 3 and 5 simultaneous pairs with receiver statistics. Then clinician review of AI summary accuracy. Each produces a measurement we currently do not have.

### 77. Why didn't you add file attachments to chat?

Attachments are a prepared but disabled capability. Before enabling them we require private storage, type and size limits, malware scanning, download authorization, retention and cross-session denial tests. Adding uploads untested would weaken the security claims and risk the working call. Chat itself is persisted per encounter, length-bounded, retry-safe and visible in history; it is not used as AI evidence.

### 78. A patient wants to send a photo of their tooth or an X-ray. Why can't they attach it in chat?

Because file attachments are a prepared but disabled capability, by design. A clinical image is sensitive personal information, and a safe upload path needs: private storage tied to one encounter, an allow-list of file types and a size limit, malware/content scanning, download only by the owning doctor and that patient, audit events, a retention and deletion rule, and tests proving another encounter cannot read the file. None of that is evaluated in this study, so we did not switch it on. Today the patient can show the tooth on camera or share their screen; the image is not stored. Attachments are listed as future work with those gates.

### 79. Wouldn't attachments make your summaries better?

Possibly, but only if the extracted content is trusted: the summary code is designed to accept attachment evidence only when an extraction is marked `ready` after scanning. Without that, an uploaded file could inject untrusted text into a clinical draft. So the evidence path exists in the design, and stays off until the safeguards are built and tested.

### 80. Could you add attachments on Firebase's free tier?

Plan for Cloud Storage for Firebase billing eligibility and region/bucket-specific quotas, not an unlimited free upload service. Confirm current official requirements before enabling it. Putting images into Firestore documents is not a safe substitute. Attachments remain disabled until private storage, permission checks, file limits, scanning, audit, retention and isolation tests are implemented. See the attachment plan for the proposed boundary, not a shipped feature.

### 81. Anyone with a link can create a patient account. Isn't that a security risk?

Open identity registration is a deliberate least-privilege entry path, not a claim of zero risk. A patient can read only records actually bound to their verified uid; registration must not grant clinician access or adopt a guest's history by typed email. A valid invitation and admission policy still control call entry. Abuse, account quotas, verification, recovery and monitoring need controls before clinic use. A claim of impossible privilege escalation would require broader independent testing than this study provides.

### 82. How does a doctor assign a patient?

The invitation is the admission assignment. It belongs to the doctor and one room; emails in "Patients who can join directly" let those verified accounts skip the queue. Everyone else with the link waits for that doctor. The encounter, summary and history are owned by that doctor; the patient sees only their own records. The later, deployment-gated appointment module plans a time; it does not replace that policy or prove attendance. It was not evaluated in the original survey.

### 83. Is this first-in-first-out scheduling?

The list sorts oldest arrivals first, by the arrival time of the visitor's *current* visit. A visitor who leaves and comes back gets a new arrival time, so nobody jumps the line. The doctor chooses whom to admit, so it is an admission worklist rather than an automatic FIFO dispatcher. The software does not enforce an appointment schedule or guarantee a treatment order.

### 84. Does the queue perform emergency triage?

No. It does not validate symptom urgency or calculate clinical priority. An emergency workflow needs explicit clinician processes and separate validation. Display order must not be described as a medical decision.

### 85. What does admitted mean?

The server granted permission to enter the consultation. It does not prove that the patient clicked Join, published media, stayed online or completed a visit. Queue state, LiveKit connection state and encounter lifecycle are separate records/signals.

### 86. Can one room have several invitations?

Yes. Per-invitation counts do not establish a combined room/clinic cap. If the product needs an aggregate room admission budget, it must explicitly own and enforce that separate invariant. Separate clinical encounters also need confidentiality and evidence isolation.

### 87. Why not fix everything the night before defense?

The initial queue repair was small and additive: a transaction, a signed claim, a queue-row field and removal of a hidden component. Later maintenance added role separation, lifecycle safeguards and a tested but deployment-gated appointment module. These checkpoints do not rewrite the original study results. We preserved the call's security boundary, optional consent, official title and AI model; attachments remain disabled. A passing build is not a reason to bypass release gates or enable unverified production features.

### 88. Which manuscript pages changed for this topic?

The 28 November follow-up changes physical PDF pages **66, 86, 98, 106 and 111**, whose printed chapter numbers are **54, 74, 86, 94 and 99**. It clarifies separate doctor/clinic/platform entry, server role checks, administrative oversight as future work and hidden scheduling release gates, plus the media-device popup correction. The cumulative manifest has 48 bounded edits across the same 37 physical pages; this update adds three regions and revises two existing regions. The official title, 259-page count, numbering, budget and survey data are preserved. See [exact register](page-change-register.md); public privacy masks are separate.

### 89. Which manuscript pages changed?

The current manuscript has 37 cumulatively edited physical pages and remains 259 pages. This follow-up changes five of those pages: physical 66/86/98/106/111, printed 54/74/86/94/99. The [page register](page-change-register.md) records both numbering systems and every reason. Objectives, reported Chapter IV findings and expenses were not changed.

### 90. What stops a patient opening the patient room URL directly?

Not the Referer header — it is optional and spoofable, and the middleware comment says so. The room needs a signed, room-scoped LiveKit credential that only the server issues after invitation validation or doctor admission.

### 91. Where is doctor and patient provisioning, and what pattern is it?

Doctors: administrator provisioning with claims-based RBAC — an administrator grants the role in the **/admin** console (or with `scripts/admin/provision-role.mjs`); Firestore rules allow a doctor profile only for an account holding that claim, and the server reads the claim first (legacy doctor profiles are honoured transitionally and audited). Registered patients: self-service just-in-time provisioning of the lowest role (always `patient`) plus versioned consent. Guests: a capability link plus doctor admission. No self-service path leads to a privileged role.

### 92. Is the study-book title your thesis title?

No. The official title begins "TeleConsole: Design and Development of a Secure Telehealth Video Communication System" and continues with LiveKit, AI summarization and flexible access. The 60,000-word book is a separate study resource. Rehearsal document labels do not rename the approved thesis.

### 93. What evidence can we present today?

Four kinds, each labelled for what it proves:

1. **Survey results (Chapter IV)** — perceived quality from 30 respondents; all four groups *Highly Acceptable* (3.51–3.94).
2. **Automated checks** — dated local regression, security/thesis-flow and browser evidence for the named source and environment. The 28 November focused login checks and real-component synthetic device tests are separate from earlier six-width viewport evidence; no fixed count is a clinical-quality measure.
3. **Measured invariants** — Firestore emulator runs (`evidence/queue-capacity-fix-2026-11-27/emulator-capacity.json`): never above the waiting limit in any trial, 100 of 100 at the maximum.
4. **Live measurement** — the in-room Call quality panel and the team's 1/3/5-pair trial sheet **only if those trials were actually run and recorded**.

We present each for what it is: perceptions, automated checks, a local transaction measurement and a live call measurement — not a penetration test or a clinical accuracy study.

### 94. Five dentists — is a weighted mean of 3.51 meaningful?

It is descriptive for those five purposively chosen people, not generalisable. We report no standard deviation or reliability coefficient (e.g. Cronbach's alpha), so we cannot say how consistent answers were. Chapter V already limits the findings to the selected respondents. A better next step is a larger sample with dispersion and reliability reported.

### 95. You use ISO/IEC 25010:2023 but your questionnaire says "Usability" and "Compatibility". Which is it?

In the 2023 edition Usability was renamed Interaction Capability, and Portability became Flexibility; Compatibility still exists as a separate characteristic. Our "F. Compatibility" items ask about devices, browsers and environment, which matches Flexibility (adaptability) in the 2023 model. The data is unchanged; the section heading in the instrument uses the older name. Admit the labelling mismatch; do not claim we evaluated Compatibility in the 2023 sense. The validation certificate also lists eight characteristics while the instrument covers six.

### 96. What should a platform owner monitor without reading patient records?

Aggregates, not records. The super-admin **Oversight** panel on `/admin` shows dated counts: provisioned doctors, clinic administrators, patient accounts, active invitations, encounters and summaries in the last 30 days, AI drafts awaiting clinician review, failed summary jobs in the retry queue, upcoming appointments, and the last retention run. Each number is a Firestore `count()` aggregation, so no document or patient field is read. This follows the SaaS control-plane pattern (AWS/Azure): operate the service from metadata, keep clinical work in the doctor's workspace. Cost/quota and spend stay in the provider consoles; small-group suppression and time-series charts are future work.

### 97. What belongs in an audit event, and do you already have an audit dashboard?

Yes, a first version. Each server-written event stores an opaque id, time, clinic, actor id, action, role and target id; never names, emails, tokens or clinical text. The Oversight panel lists the newest 50 events; a clinic administrator's query is filtered to their verified clinic inside Firestore (composite index `clinicId, at`), and the platform owner sees all clinics. Staff ids are shown with the staff name already on the admin page. Today only role grants/revocations are recorded; sign-in, denial and invitation-lifecycle events, filters and cursor paging are next. Pattern: Microsoft Entra-style audit fields, privacy-minimized per OWASP logging guidance.

### 98. How would that audit dashboard preserve privacy and database budget?

Scope is applied in the query from the verified token, never from a URL or form field; non-administrators get 403. The panel uses `count()` aggregations (about one read per 1,000 index entries) and one bounded page of at most 50 events, so a visit costs a few dozen reads. Responses are `private, no-store`. Clinical drill-through is deliberately absent: an administrator who needs clinical access must use a separately provisioned doctor identity. Regression tests check clinic scoping, the empty view for an unassigned clinic administrator, the page bound and that extra stored fields never leak into the response.

### 99. Can an administration dashboard guarantee low costs or prove the business is profitable?

No. A future dashboard should show bounded usage rollups, quota pressure and dated estimated costs, with alerts and retry backoff. Configuration needs allowlisted fields, safe ranges, versions and audit receipts; secrets stay server-only. Provider usage estimates are not invoices, revenue or profit, and an alert is not a hard spend cap. The PHP 7,856.69 thesis development budget stays separate. No billing/analytics product or commercial capacity measurement is claimed.

### 100. What evidence makes these administration answers defensible today?

Three distinct things: official AWS/Azure/OWASP/Firebase sources justify the pattern; repository source shows the current role/scope boundary; fresh local regressions/browser checks show only the cases and environment actually tested. Future audit/metrics screens are a design roadmap, not a demo claim. The regenerated manuscript is separately checked for 259 pages, exact changed regions and preserved unrelated pages. Production identity acceptance, provider deployment and multi-clinic/security/clinical validation require their own evidence. Use the [design note](../admin-oversight-design.md) and current test record; never carry an old passing count into a new build.

## Three-writer rehearsal

Writer 1: title, contribution, evidence, survey and ISO questions. Writer 2: security, admission, waiting limit, revocation and privacy. Writer 3: numbers, call quality, AI, consent, language and recovery. Everyone rehearses questions 1–20, then rotate. For every demo step, say whether it proves user-interface behaviour, a server refusal, a measured local invariant or a live measurement.
