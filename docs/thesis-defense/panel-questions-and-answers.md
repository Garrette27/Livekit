# Panel questions and answers: priority study order

27 November 2026. <!-- priority-order-v2 -->

Questions 1–20 are the ones every writer must answer without notes; 21–40 are the next most likely follow-ups. The order reflects what a capstone panel probes first (title, security, contribution, AI and consent, numbers) and what the demo proves. Each answer is built as **rule → reason → evidence → boundary**. Numbers come from the dated evidence files and the in-room Call quality panel; anything marked *[fill in]* must be replaced with the team's own trial result or left out.

Use synthetic demonstration accounts only; never show real patient records.

### 1. Why did you choose this title, and can you defend every word of it?

Yes. Every phrase names something we built and can show.

| Title phrase | What it means in our system | Evidence we show |
|---|---|---|
| **Design and Development** | The objectives are build objectives: Chapter III designs (use case, DFD, ERD, architecture) were implemented as a working, deployed system. | Live demo on the deployed site; Chapter III figures match the routes and modules. |
| **Secure** | Layered, server-enforced controls: signed invitation links, Firebase sign-in with revocation checks, role-based access, waiting-room admission by the doctor, visit-bound credentials, HMAC-verified LiveKit webhooks, TLS and DTLS-SRTP transport, and an atomic waiting limit. | 139 automated regression tests plus security and flow contract checks on every build; Firestore emulator transaction runs; all four respondent groups rated Security *Highly Acceptable* (3.64 dentists, 3.68 staff, 3.91 patients, 3.80 IT professionals). |
| **Telehealth Video Communication System Using LiveKit** | Real-time audio, video, screen sharing and chat over LiveKit's WebRTC SFU, with adaptive streaming and an in-room call-quality readout. | Demo call; Call quality panel shows measured round-trip time, jitter, loss and resolution. |
| **with AI Summarization** | Consented transcript → evidence gate → structured draft (OpenAI gpt-4o-mini) → clinician review and edit. | Demo of a draft marked *AI draft · review required*; an insufficient-evidence record. |
| **and Flexible User Access Design** | Three ways in: a verified allowlisted account enters directly, a guest with the link waits for the doctor, a registered patient uses the portal; separate doctor, patient and administrator workspaces. | Demo steps 3–6. |

"Secure" is used the way ISO/IEC 25010 uses the Security characteristic — a designed and evaluated quality of the product — not as a certification claim. Our scope and delimitation (Chapter I) state that boundary in writing, so the title and the manuscript say the same thing.

### 2. Why call it secure if you still have limitations?

Secure is our design objective, and we implemented and tested the controls that deliver it: signed invitation links, server-checked roles, a waiting room where only the doctor admits, credentials bound to one visit, revocation checked on every protected request, HMAC-verified webhooks and encrypted transport. Every build runs 139 automated regression tests and security contract checks, and the waiting-limit invariant was verified against Firestore's real transaction engine. Our IT-professional respondents rated Security 3.80, *Highly Acceptable*.

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
- **Our own measurement:** every call has a **Call quality** readout (round-trip time, jitter, packet loss, received resolution and frame rate). Our rehearsal trial ran **1, 3 and 5 simultaneous pairs** on separate devices and recorded those numbers: *[fill in from today's trial sheet — e.g. "5 pairs: RTT ≤ __ ms, loss ≤ __ %, 720p at __ fps"; if the trial was not run, say only the two bullets above]*.
- **Admission load:** the waiting limit holds at its maximum — 120 arrivals in waves of 10 into a limit of 100 ended with exactly 100 waiting and 18 refused (emulator run).

So the provider ceiling is 50 pairs; what we have measured is the level in our trial sheet; we do not claim beyond what we measured. A clinic with one dentist rarely needs more than one or two at a time.

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

Media is encrypted in transit with DTLS-SRTP between each browser and LiveKit, and all signalling and API traffic uses TLS. That is the same transport protection standard video platforms use. We did not enable LiveKit's optional end-to-end encryption, which would also hide media from LiveKit's servers; Chapter II cites it as literature. It is a configuration-level upgrade we list for a production clinic.

### 18. Does OpenAI keep the transcripts?

Only transcript text from consented participants is sent, and only for the summary. Under OpenAI's published API data policy, API data is **not used to train models** by default and is retained for up to **30 days** for abuse monitoring, after which it is deleted; zero-data-retention is available to approved organisations. Audio is discarded after transcription. Before a real clinic go-live, the clinic signs a data-processing agreement and completes a privacy impact assessment under RA 10173.

### 19. Is the chat used in the AI summary?

No. The AI summary uses only consented, speaker-attributed transcript evidence. Chat is saved with the encounter and shown to the clinician in history, but it is never sent to the AI. That is deliberate: chat has no per-participant consent for AI processing and can contain pasted or untrusted text, so adding it would weaken the evidence rules.

### 20. If an administrator revokes a doctor, is access cut immediately?

Yes, for everything our server controls. When an administrator revokes a doctor, the server removes the role, revokes the account's refresh tokens, and every protected API checks revocation on every request (`verifyIdToken(token, checkRevoked)`, Firebase's documented pattern). The very next request — create invitation, admit, view history — is refused with "Your access has changed". Changing someone between administrator and doctor does the same.

One honest detail: if the revoked doctor is *inside a call at that moment*, that media connection continues until they leave or are removed, because LiveKit room credentials are self-contained (doctor credentials last up to 4 hours). They cannot obtain a new one.

### 21. Are summaries deleted after 30 days, and which job does that?

Summary deletion is a switch the clinic turns on, by design. The Firebase function `autoDeleteSummaries` runs **daily**; when `RETENTION_ENFORCEMENT_ENABLED=true` it deletes summaries older than the cutoff (**default 30 days**), up to **200 summaries per run** (each needs two deletes, so 400 writes stay under Firestore's 500-write batch limit). That is about 6,000 a month — far more than our expected volume of about 125 consultations a month on the free plan. It is off by default because deleting clinical records must be an explicit clinic decision, not a side effect of deploying code. The separate Vercel daily job only retries summaries that failed; it never deletes.

### 22. Is appointment scheduling implemented? Why is it switched off in production?

Yes. Doctor-booked appointments are implemented and tested: separate appointment records with UTC times and the clinic's timezone, overlap prevention inside a per-doctor transaction, version-checked rescheduling, cancellation that keeps history, and safe retries — covered by unit, browser and emulator tests. It ships behind a server feature flag that is **off in production on purpose**: turning on a new data store in a clinic requires its database rules and indexes, data-retention review and a signed-in staging check first. That is a standard staged rollout (feature flag), not an unfinished feature. A booking never lets anyone into a call, starts transcription or creates an AI record; those stay with the invitation and encounter. It was built after the survey, so respondents did not evaluate it.

### 23. Is the app tested on phones and tablets?

The interface is responsive and automatically tested on every build at **six screen widths — 320, 390, 768, 820, 1024 and 1280 px**: forms fit, there is no sideways scrolling, and on phones and tablets the waiting queue and session panels open on demand so they never cover the video. Our patient respondents rated Flexibility **3.97**. Physical devices still matter for camera and microphone permissions, so before the defense we also ran the call on an actual phone; for a clinic rollout, the supported-device list is confirmed on the clinic's own phones and tablets.

### 24. Can patients speak Filipino, Tagalog or Taglish, and what language is the summary?

Yes for speech: the clinician's speech-notes selector offers **Filipino/Tagalog (fil-PH)** and **English (en-US)**, and Taglish is handled by the recognition engine for the selected language. The summary is written in **English** — the clinic's record language — and the prompt tells the model to keep uncertain names, medicines, measurements and short Filipino phrases as spoken rather than guess a translation. Because recognition quality depends on the browser and microphone, the dentist reviews negations, doses and durations against the transcript before approving the draft.

### 25. Can you reuse that scheduled worker for future attachment retention?

Yes — we would reuse the *pattern*, not the same query. The summary worker already shows the shape: scheduled daily, bounded batch, opt-in switch, idempotent (safe to run twice). Attachment cleanup would add per-file expiry, deleting the stored file *and* its metadata together, a reconciliation pass for half-finished deletions, and tests for dry runs, expiry boundaries and duplicate runs. Attachments are disabled today, so this is the documented plan, ready for when uploads are enabled.

### 26. Two guests use the same clinic Wi-Fi and the same browser. Do they get mixed up?

No. Each browser tab gets its own random session id, so two guests on the same Wi-Fi and the same browser get two separate queue rows — a regression test checks exactly that case. A signed-in patient is identified by their verified Firebase account instead, so one account is one person across tabs. None of these signals ever grants direct entry; only a verified allowlisted account or the doctor's admission does.

### 27. When an invitation is revoked, do credentials already issued stop working?

Every credential is checked against current state when it is used. Invitation status and expiry are rechecked on every token request, so a revoked link stops issuing credentials immediately. Waiting credentials carry the visit id, so a credential from an earlier visit is refused for a later one. Staff API access is refused on the next request after revocation. A consultation credential already inside a live call keeps working until that participant leaves, and the doctor's **Remove** action disconnects them at once.

### 28. If you sold this to several small clinics, how would accounts be provisioned?

Delegated, tenant-scoped administration: the platform super admin creates a clinic administrator per clinic; each clinic admin grants doctor accounts only within their clinic (claims carry `clinicId`; the server refuses cross-clinic grants and revocations); doctors invite their own patients; patients self-register only as patients. Doctors in different areas cannot see each other's patients because records are owned by the inviting doctor. Before a commercial launch we would add clinic-level record sharing, billing, DPA/RA 10173 compliance work, backups, monitoring and an independent security test.

### 29. Why have a waiting queue when the patient has a valid link?

A link can be forwarded. It proves possession of a scoped capability, not the holder's identity. Waiting admission lets the owning doctor inspect the visitor's displayed identity provenance and decide whether to grant consultation access. This preserves a guest path without treating typed email as verification.

### 30. Who is the first administrator? Isn't that a chicken-and-egg problem?

The server-only SUPER_ADMIN_EMAILS configuration recognizes the owner's provider-verified account. It bootstraps administration without relying on a pre-existing doctor profile or an administrator signup checkbox. The platform owner grants clinic administrators; those administrators manage doctors in their own clinic. Self-change and bootstrap-account guards constrain role commands, but do not make a compromised owner account harmless. Protect the hosting environment and authentication account, and define recovery procedures.

### 31. Why must administrators use a separate doctor account?

Separation of duties: platform and clinic administrators manage staff access, not consultations. Clinical APIs deny administrator authority even with historical combined doctor/admin claims. New Administrator grants write an administrative role only, and removing it does not restore a legacy doctor profile. A separate clinician identity must be explicitly provisioned. Local Firestore rules also deny administrator clinical access, but require separate deployment. Server-only bootstrap configuration is not visible to those rules, so an environment-only owner's historical doctor claims still need an approved migration. Existing media credentials retain their separate lifecycle; no universal instant revocation is claimed.

### 32. If the patient refreshes, do they use up another invitation use?

No. A refresh during an open visit reuses the same queue row and visit id and spends no use. Only a genuinely new visit (after leaving or being rejected) spends one.

### 33. The patient opened the call on a second device. Does the queue think they left?

No. LiveKit disconnects the first device and reports it left; before marking the patient as left, the server checks whether the same identity is still connected and whether the departing connection belongs to an earlier visit. The patient stays in the call on the new device.

### 34. The doctor clicked Admit on an old screen after the patient left and came back. What happens?

The Admit command carries the visit the doctor was looking at. If the patient has since left and started a new visit, the server returns a conflict and asks the doctor to refresh and review again — the doctor never admits someone they did not actually see. This is an expected-version check, the same pattern used to prevent two editors overwriting each other.

### 35. A doctor rejects a visitor. What stops them reopening the link and queueing again?

Reopening starts a new visit at the back of the queue, and it always waits — even for a verified account on the direct-join list, because the doctor's rejection outranks the list. The doctor sees them again and can reject again. To stop the link entirely, the doctor revokes the invitation, which every token request rechecks. We chose this so one mistaken click does not permanently lock out a real patient, while a removed person can never walk straight back in.

### 36. What if the patient's phone dies after being admitted?

Short network drops are handled by LiveKit's own reconnection. If the page is lost, a verified allowlisted account that reopens the link rejoins its open admission directly; anyone else reopening goes back to waiting on the same entry and the doctor re-admits them. A dropped call is not treated as a completed or failed consultation by itself.

### 37. Does removing a patient always create a summary?

No. Removal changes the operational queue and disconnects the selected transport participant. Scoped encounter finalization, eligibility and evidence quality are separate decisions. A summary may be deterministic, unavailable, failed or a draft; the queue action is not an unconditional OpenAI billing switch.

### 38. What load do ten waiting patients create?

At the nominal interval, ten pages imply roughly 200 admission HTTP checks/minute, before timing effects or other work. That is arithmetic, not measured database reads. Authorization, invitation reads and rate counters can add operations. The number does not measure video capacity or AI throughput.

### 39. Why does consultation history take a while to load?

Each consultation's chat transcript is a separate Firestore query, so a doctor with ~50 consultations triggered ~50 extra reads before anything showed, plus a serverless cold start. The dashboard now shows the summaries first and adds chat transcripts when they arrive. A paginated history endpoint and measured timings are the next step; we have not published a latency figure.

### 40. How is a doctor account created? Show us.

The clinician first creates a Firebase sign-in identity. An authorized administrator opens /admin, selects the clinic and Doctor role, and submits. The server checks authority, clinic scope and the patient-account guard, writes claims/profile metadata and records a uid-only audit event. Grants do not revoke sessions. The recipient signs in again or explicitly refreshes access to get the new claim. Administrator grants are a different operation available only to the platform owner. Revocation has the separate existing-token window described below.

### 41. Does the new administrator signup let anyone become an administrator?

No. It creates a Firebase Authentication identity only, without writing a privileged profile or custom claim. Google can establish that identity too. The platform owner separately grants Administrator within a clinic. An unapproved identity receives pending-access guidance and can refresh after approval. Never use a client-selected role or signup URL as authority. Demonstrate an unapproved identity being denied by the admin API as well as the page.

### 42. What do you do when newly granted access does not appear, or the account service is down?

Refresh the recipient's token and re-query the server access projection; granted claims are not automatically present in an already-issued token. Keep a visible checking, pending or retry state. An Auth lookup outage must not be labeled as a deleted account, and an unsuccessful request must not be shown as an empty account list. No client retry grants a role. Existing-token revocation limits remain separate.

### 43. Can anyone sign up as a doctor?

No self-service flow may grant a clinician role. Firebase sign-in creates an identity; profile behavior depends on the entry route. Authorized administrators grant privileges through the console or provisioning script. Firestore rules refuse an unclaimed client-created doctor profile. A documented server-read legacy clinician-profile fallback still exists for older accounts; it needs an audited migration before removal. Do not describe current authorization as universally claim-only. Protect Firebase administrative credentials and verify clinician eligibility operationally.

### 44. A patient account wants to become a doctor. Can the admin convert it?

No. Granting a clinician role to an existing patient account is refused; clinicians use a separate account. This keeps a person's own health history from mixing with clinician access.

### 45. Can another doctor admit my patient?

The server derives the acting doctor from verified authorization and checks scope. A doctor id supplied in a query/body cannot grant ownership. Test with two unrelated synthetic doctor accounts in staging rather than inferring safety from hidden buttons.

### 46. How would you validate bilingual AI summaries rather than just demonstrate them?

Use synthetic or explicitly consented paired Filipino/English scripts reviewed by a qualified clinician and bilingual reviewer. Compare source speech, captured text and generated draft separately. Record recognition errors, omissions, unsupported facts and translation changes to negation, dose, duration and names; assess reviewer agreement and report failures. A few correct examples do not establish accuracy. The current study's acceptability survey is not that experiment, and the clinician must verify the draft.

### 47. What happens to the data after 30 days?

Summary deletion runs only if retention enforcement is switched on, and it deletes summaries, not sessions, messages, transcripts or backups. We do not claim everything disappears after 30 days.

### 48. Who can see a consultation's record?

The owning doctor receives the authorized clinical projection; the patient bound by a verified uid receives their own encounter history, not the clinician's full AI draft. A typed guest email grants no historical ownership. The administrator console now manages staff access metadata; it does not establish shared clinic-wide clinical-record access. Faculty reviewer access remains backend-only and deny-by-default. Privileged Firebase operators are a separate infrastructure trust boundary.

### 49. Does the doctor count as a verified patient visit?

No. Creating an invitation, appearing in the direct-entry audience configuration and joining as its owning doctor are not patient visits. Patient counters must be based on reserved patient visits, not the host's presence. Verified-account visits and guests describe identity provenance, not unique people or completed consultations. Reconnects reuse the same active visit. Older invitations may only have a historical aggregate join count; do not invent a verified/guest breakdown for them.

### 50. How many patients used a link, and were they anonymous?

Each invitation records its visits by identification kind inside the same transaction that admits the visit: verified accounts, unverified accounts and guests (anonymous sessions or typed emails). The card shows e.g. "5 visits · 2 verified accounts · 3 guests"; reconnects are not counted twice. Older invitations created before visit counting was added show only their total join count.

### 51. What belongs in the consultation room rather than repeating invitation management?

Show operational context: room/session identity, waiting occupancy versus its configured cap, verified direct-entry audience count, and participant state. Put captured arrival/admission/departure times and identity provenance in expandable details. Never label self-declared email verified or admission as confirmed media attendance. Teams and Zoom use participant/lobby controls separate from richer attendance reports; that is a useful design precedent, not proof of our app's usability. Hashed invitation emails cannot be recovered for display; show recorded participant identities truthfully and manage the invitation separately.

### 52. If a guest has no account, how is their queue entry kept across a refresh?

By the server-verified Firebase uid when a session exists. Without a Firebase session, the fallback combines keyed network/browser signals with the per-tab session id when supplied. Reloading that tab reuses its entry; an email is only a label. A shared Firebase uid still represents one principal across tabs, and duplicated tabs can copy session storage. Do not promise that every tab is a separate person or treat the tab id as identity verification. Use separate browser profiles/accounts for repeatable multi-person testing.

### 53. What happens if the patient refreshes or returns?

A refresh during the same visit reuses the same queue row and keeps the person's place and visit id. If the visit had ended (left or rejected) and the person reopens the link, the same row starts a **new visit**: new visit id, new arrival time, old end markers cleared. Waiting and admission credentials carry the visit id as a signed claim, and the server refuses a credential from an earlier visit when it polls admission or sends a "left" beacon. Boundary: a consultation credential already issued stays valid until it expires (up to two hours) — the doctor can remove that participant from the room, but we do not claim instant revocation.

### 54. Does active-only filtering eliminate archive reads?

No. It limits the projected result. Some current doctor-list paths fetch the doctor's rows before status/freshness filtering. Large archives therefore need indexed bounded queries and pagination. An empty displayed queue does not prove a zero-read operation.

### 55. How quickly does admission appear?

The patient checks immediately and then about every three seconds, with overlap protection and cleanup. Network delay, throttling and errors can extend that. It is an implementation interval, not a guaranteed three-second response SLA.

### 56. Are patient and doctor updates both Firestore listeners?

No. The doctor uses change invalidations that trigger authenticated API re-query, plus a default fifteen-second foreground reconciliation. The patient's waiting page polls the admission API about every three seconds. A loading spinner is not proof of continuous successful synchronization.

### 57. Does the shared coordinator eliminate all duplicate requests?

It shares an in-flight request and polling scope within one browser runtime. Separate tabs, devices, users and different scopes can still issue requests. Changes/actions can trigger additional refreshes. Do not describe this as a global distributed cache.

### 58. What if Firestore or the network fails?

Use visible error/retry states and retain the distinction between unknown/stale state and an empty queue. Do not bypass admission to keep a demonstration moving. Database outage behavior is separate from optional AI availability. A real deployment needs monitoring and a recovery process.

### 59. What would most likely break during your demo, and what is your plan?

Provisioning (doctor must hold the claim), venue network or camera permissions, AI availability, and a duplicate tab replacing a patient's connection. We freeze the build, test on a preview first, keep a one-click rollback to the previous production deployment, use a fresh invitation, and have a hotspot and screenshots as backup. If AI is unavailable, the call still works and the record says so.

### 60. Is the production site running these fixes?

Answer truthfully for the day: either "yes, merged at commit …, tested on preview first" or "the fixes are on our pull request preview; production runs the evaluated build". Do not claim a deployment you have not verified.

### 61. Why so many fixes the week of the defense — doesn't that undermine your results?

Distinguish the evaluated build from later maintenance. Report the actual survey date/build if recorded; do not claim respondents tested today's admin console, security fixes or media settings. The original survey results and objectives remain unchanged, while dated engineering evidence describes later changes. Similar-looking screens do not establish that a change has no effect on study validity. Ask the adviser how to present this separation.

### 62. How do you know your tests test the real code and not a copy?

The regression tests load the actual TypeScript modules and replace only the database and network with synthetic fakes. The queue fix was additionally run against the Firestore emulator's real transaction engine. Neither is a production test.

### 63. Does flexible access mean anyone can become a doctor?

No. Patient admission alternatives are separate from staff role provisioning. Google authenticates an account; trusted provisioning and server permissions authorize clinician actions. The identity provider does not verify a medical license for this application. Real-clinic onboarding and review of existing privileged accounts remain operational gates.

### 64. Chapter I says patients get "device, browser, and location validation". Does the app do that?

No, and it should not. That sentence describes an early design. The current app does not use device fingerprints, browser checks or IP location to admit anyone, because none of those prove who a person is and they collect personal data. Admission is a verified allowlisted account or the doctor's decision. Table I's ip-api.com row is marked "not used". Ask the adviser to correct the Chapter I sentence (printed page 3).

### 65. Appendix C shows code that reads IP geolocation, stores device fingerprints and asks the AI for "prescriptions" and a Low/Medium/High risk. Is that the system you evaluated?

Appendix C is labelled as historical excerpts. The current summary code tells the model to use only facts in the transcript, allows "Unknown" risk, and stores a deterministic insufficient-evidence record when there is not enough transcript. Be precise about timing: if respondents evaluated an earlier build, say so; do not claim the survey evaluated today's code.

### 66. Four of five dentists came from other clinics. Does "for Henry Cheung Dental Clinic" still hold?

The design followed the beneficiary clinic's workflow; the evaluation added outside dentists for broader professional opinion. That supports perceived acceptability among dentists generally, not proof that the beneficiary clinic adopted it.

### 67. Waterfall says each phase is finished before the next. You fixed code during the defense week. Is that still Waterfall?

In practice we iterated inside the implementation and testing phases. Say that honestly rather than claim a strictly linear process; the fix is documented with dated evidence like any maintenance change.

### 68. What design patterns did you use?

Deep modules behind small interfaces (invitation access service, queue coordinator); pure decision functions with IO adapters (admission policy, `planWaitingArrival`); transactions for coupled writes (use counting, capacity, queue row); expected-version checks (visit ids); Command/Fact separation for lifecycle; realtime as invalidation with authenticated re-query; adapter around LiveKit; claims-based RBAC.

### 69. What were the architectural risks you found in your own design?

We found guest-key trust, capacity check/commit races, stale visit commands, and unclear identity-versus-role routing. Specific queue cases have local regressions and emulator evidence. Those fixes do not establish complete replay isolation across every already-issued token or eliminate the documented legacy privileged-profile fallback. Authentication, operational queue state, clinical encounter state and displayed labels must remain separate authorities.

### 70. If you had one more month, what would you do first?

A staged acceptance run: deploy the fixed commit, run the two-account replay and cross-doctor tests, then paired-call trials at 1, 3 and 5 simultaneous pairs with receiver statistics. Then clinician review of AI summary accuracy. Each produces a measurement we currently do not have.

### 71. Why didn't you add file attachments to chat?

Attachments are a prepared but disabled capability. Before enabling them we require private storage, type and size limits, malware scanning, download authorization, retention and cross-session denial tests. Adding uploads untested would weaken the security claims and risk the working call. Chat itself is persisted per encounter, length-bounded, retry-safe and visible in history; it is not used as AI evidence.

### 72. A patient wants to send a photo of their tooth or an X-ray. Why can't they attach it in chat?

Because file attachments are a prepared but disabled capability, by design. A clinical image is sensitive personal information, and a safe upload path needs: private storage tied to one encounter, an allow-list of file types and a size limit, malware/content scanning, download only by the owning doctor and that patient, audit events, a retention and deletion rule, and tests proving another encounter cannot read the file. None of that is evaluated in this study, so we did not switch it on. Today the patient can show the tooth on camera or share their screen; the image is not stored. Attachments are listed as future work with those gates.

### 73. Wouldn't attachments make your summaries better?

Possibly, but only if the extracted content is trusted: the summary code is designed to accept attachment evidence only when an extraction is marked `ready` after scanning. Without that, an uploaded file could inject untrusted text into a clinical draft. So the evidence path exists in the design, and stays off until the safeguards are built and tested.

### 74. Could you add attachments on Firebase's free tier?

Plan for Cloud Storage for Firebase billing eligibility and region/bucket-specific quotas, not an unlimited free upload service. Confirm current official requirements before enabling it. Putting images into Firestore documents is not a safe substitute. Attachments remain disabled until private storage, permission checks, file limits, scanning, audit, retention and isolation tests are implemented. See the attachment plan for the proposed boundary, not a shipped feature.

### 75. Anyone with a link can create a patient account. Isn't that a security risk?

Open identity registration is a deliberate least-privilege entry path, not a claim of zero risk. A patient can read only records actually bound to their verified uid; registration must not grant clinician access or adopt a guest's history by typed email. A valid invitation and admission policy still control call entry. Abuse, account quotas, verification, recovery and monitoring need controls before clinic use. A claim of impossible privilege escalation would require broader independent testing than this study provides.

### 76. How does a doctor assign a patient?

The invitation is the admission assignment. It belongs to the doctor and one room; emails in "Patients who can join directly" let those verified accounts skip the queue. Everyone else with the link waits for that doctor. The encounter, summary and history are owned by that doctor; the patient sees only their own records. The later, deployment-gated appointment module plans a time; it does not replace that policy or prove attendance. It was not evaluated in the original survey.

### 77. Is this first-in-first-out scheduling?

The list sorts oldest arrivals first, by the arrival time of the visitor's *current* visit. A visitor who leaves and comes back gets a new arrival time, so nobody jumps the line. The doctor chooses whom to admit, so it is an admission worklist rather than an automatic FIFO dispatcher. The software does not enforce an appointment schedule or guarantee a treatment order.

### 78. Does the queue perform emergency triage?

No. It does not validate symptom urgency or calculate clinical priority. An emergency workflow needs explicit clinician processes and separate validation. Display order must not be described as a medical decision.

### 79. What does admitted mean?

The server granted permission to enter the consultation. It does not prove that the patient clicked Join, published media, stayed online or completed a visit. Queue state, LiveKit connection state and encounter lifecycle are separate records/signals.

### 80. Can one room have several invitations?

Yes. Per-invitation counts do not establish a combined room/clinic cap. If the product needs an aggregate room admission budget, it must explicitly own and enforce that separate invariant. Separate clinical encounters also need confidentiality and evidence isolation.

### 81. Why not fix everything the night before defense?

The initial queue repair was small and additive: a transaction, a signed claim, a queue-row field and removal of a hidden component. Later maintenance added role separation, lifecycle safeguards and a tested but deployment-gated appointment module. These checkpoints do not rewrite the original study results. We preserved the call's security boundary, optional consent, official title and AI model; attachments remain disabled. A passing build is not a reason to bypass release gates or enable unverified production features.

### 82. Which manuscript pages changed for this topic?

The latest follow-up concerns PDF 66, 71, 75, 106 and 111 / printed 54, 59, 63, 94 and 99: role separation, retention/future attachment cleanup, encounter finalization, responsive context/consent and deployment-gated scheduling. Earlier queue corrections also cover PDF 85, 86, 101 and 102. The complete register lists 45 bounded edits on 37 physical pages. The official title, 259-page count, numbering, expenses and reported survey data remain unchanged. Public privacy masks are separate from research corrections.

### 83. Which manuscript pages changed?

37 physical pages, same 259 pages and numbering; the register lists each page, edit and reason. Objectives and Chapter IV numbers were not edited.

### 84. What stops a patient opening the patient room URL directly?

Not the Referer header — it is optional and spoofable, and the middleware comment says so. The room needs a signed, room-scoped LiveKit credential that only the server issues after invitation validation or doctor admission.

### 85. Where is doctor and patient provisioning, and what pattern is it?

Doctors: administrator provisioning with claims-based RBAC — an administrator grants the role in the **/admin** console (or with `scripts/admin/provision-role.mjs`); Firestore rules allow a doctor profile only for an account holding that claim, and the server reads the claim first (legacy doctor profiles are honoured transitionally and audited). Registered patients: self-service just-in-time provisioning of the lowest role (always `patient`) plus versioned consent. Guests: a capability link plus doctor admission. No self-service path leads to a privileged role.

### 86. Is the study-book title your thesis title?

No. The official title begins "TeleConsole: Design and Development of a Secure Telehealth Video Communication System" and continues with LiveKit, AI summarization and flexible access. The 60,000-word book is a separate study resource. Rehearsal document labels do not rename the approved thesis.

### 87. What evidence can we present today?

Four kinds, each labelled for what it proves:

1. **Survey results (Chapter IV)** — perceived quality from 30 respondents; all four groups *Highly Acceptable* (3.51–3.94).
2. **Automated tests** — 139 regression tests plus security and thesis-flow contract checks run on every build, including six-width responsive browser checks.
3. **Measured invariants** — Firestore emulator runs (`evidence/queue-capacity-fix-2026-11-27/emulator-capacity.json`): never above the waiting limit in any trial, 100 of 100 at the maximum.
4. **Live measurement** — the in-room Call quality panel and the team's 1/3/5-pair trial sheet.

We present each for what it is: perceptions, automated checks, a local transaction measurement and a live call measurement — not a penetration test or a clinical accuracy study.

### 88. Five dentists — is a weighted mean of 3.51 meaningful?

It is descriptive for those five purposively chosen people, not generalisable. We report no standard deviation or reliability coefficient (e.g. Cronbach's alpha), so we cannot say how consistent answers were. Chapter V already limits the findings to the selected respondents. A better next step is a larger sample with dispersion and reliability reported.

### 89. You use ISO/IEC 25010:2023 but your questionnaire says "Usability" and "Compatibility". Which is it?

In the 2023 edition Usability was renamed Interaction Capability, and Portability became Flexibility; Compatibility still exists as a separate characteristic. Our "F. Compatibility" items ask about devices, browsers and environment, which matches Flexibility (adaptability) in the 2023 model. The data is unchanged; the section heading in the instrument uses the older name. Admit the labelling mismatch; do not claim we evaluated Compatibility in the 2023 sense. The validation certificate also lists eight characteristics while the instrument covers six.

## Three-writer rehearsal

Writer 1: title, contribution, evidence, survey and ISO questions. Writer 2: security, admission, waiting limit, revocation and privacy. Writer 3: numbers, call quality, AI, consent, language and recovery. Everyone rehearses questions 1–20, then rotate. For every demo step, say whether it proves user-interface behaviour, a server refusal, a measured local invariant or a live measurement.
