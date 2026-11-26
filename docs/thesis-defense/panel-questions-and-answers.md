# Panel rehearsal: title, waiting queue and system boundaries

Updated 27 November 2026 (first written 25 November). Use these as practice answers, not a script for hiding defects or a guarantee of a passing grade. Source baseline: `ed4f7a9` plus the 27 November queue fix (atomic waiting target, visit-bound queue credentials, no hidden waiting-room media). Evidence is local: a synthetic source audit and a Firestore **emulator** run, not production load. Answers 4, 8, 9, 12, 14, 16–19, 21, 29, 30 and 32 changed because the code changed; questions 33–50 are new. Later the same day (PR #9) a review found more queue bugs; they were fixed and answers 40 and 42 changed, with questions 51–60 added. See also the [one-day guide](one-day-defense-guide.md). The [complete queue/title guide](waiting-queue-and-title-defense.md) supplies implementation references and teaching detail. Each writer should answer in their own words, then state the boundary without prompting.

## Title and contribution

### 1. Why did you choose this title?

We chose a title that names the developed application, its engineering scope, the LiveKit transport dependency, AI documentation assistance and the alternative patient-access paths. Our contribution is the integrated workflow and its design decisions. The words do not establish regulatory certification or clinical outcome improvement.

Follow-up to rehearse: identify one source module behind each phrase rather than saying the title sounds modern.

### 2. Is the study-book title your thesis title?

No. The official title begins "TeleConsole: Design and Development of a Secure Telehealth Video Communication System" and continues with LiveKit, AI summarization and flexible access. The 60,000-word book is a separate study resource. Rehearsal document labels do not rename the approved thesis.

### 3. What did you build if LiveKit already handles video?

We integrated transport with server-owned invitations, authenticated roles/ownership, waiting admission, encounter tracking, consented evidence and clinician-reviewed documentation. We do not claim to have invented WebRTC or a new SFU. Explain one end-to-end user journey to make the integration concrete.

### 4. Why call it secure if you still have limitations?

Secure describes the design objective and implemented safeguards, supported by specified tests. It is not an absolute guarantee. The two queue defects we disclosed on 25 November — a waiting target that concurrent arrivals could exceed, and queue credentials that could be replayed against a later visit on the same entry — were fixed on 27 November and covered by regression tests and an emulator run. That is tested locally, not a security certification: production deployment of that commit, a staged two-account replay test and an independent review are still release gates. If the panel requests a qualified title, we would seek adviser approval rather than claim certification.

### 5. Does AI make diagnoses or treatment decisions?

No. AI assists documentation from consented evidence. Output is a draft requiring clinician review; sparse or absent evidence can produce a deterministic insufficient-evidence record without inference. The clinician remains responsible for source review and medical decisions.

### 6. Does flexible access mean anyone can become a doctor?

No. Patient admission alternatives are separate from staff role provisioning. Google authenticates an account; trusted provisioning and server permissions authorize clinician actions. The identity provider does not verify a medical license for this application. Real-clinic onboarding and review of existing privileged accounts remain operational gates.

## Queue purpose and policy

### 7. Why have a waiting queue when the patient has a valid link?

A link can be forwarded. It proves possession of a scoped capability, not the holder's identity. Waiting admission lets the owning doctor inspect the visitor's displayed identity provenance and decide whether to grant consultation access. This preserves a guest path without treating typed email as verification.

### 8. Does every patient wait?

No. A qualifying non-anonymous account with a provider-verified email on the invitation allowlist may enter directly, subject to current invitation/consent/usage checks. Other accepted visitors wait for doctor admission. Since 27 November the waiting target is checked only when an arrival would add a new waiting row, so a full queue no longer refuses a verified direct-entry patient or someone already waiting who refreshes. Invitation expiry, revocation, consent and use limits still apply to everyone.

### 9. Is this first-in-first-out scheduling?

The list sorts oldest arrivals first, by the arrival time of the visitor's *current* visit. (Before 27 November a visitor who left and came back kept their first arrival time and could jump to the top; a new visit now gets a new arrival time.) The doctor chooses whom to admit, so it is an admission worklist rather than an automatic FIFO dispatcher. The software does not enforce an appointment schedule or guarantee a treatment order.

### 10. Does the queue perform emergency triage?

No. It does not validate symptom urgency or calculate clinical priority. An emergency workflow needs explicit clinician processes and separate validation. Display order must not be described as a medical decision.

### 11. What does admitted mean?

The server granted permission to enter the consultation. It does not prove that the patient clicked Join, published media, stayed online or completed a visit. Queue state, LiveKit connection state and encounter lifecycle are separate records/signals.

### 12. Can the patient edit a URL or request to admit themselves?

Changing browser state is not authority. Admission requires the server to verify clinician permission and ownership plus current row/invitation state. Patient status checks require a signed credential bound to the requested invitation, row **and current visit id**. These controls still need deployment acceptance in staging.

### 13. Can another doctor admit my patient?

The server derives the acting doctor from verified authorization and checks scope. A doctor id supplied in a query/body cannot grant ownership. Test with two unrelated synthetic doctor accounts in staging rather than inferring safety from hidden buttons.

### 14. What happens if the patient refreshes or returns?

A refresh during the same visit reuses the same queue row and keeps the person's place and visit id. If the visit had ended (left or rejected) and the person reopens the link, the same row starts a **new visit**: new visit id, new arrival time, old end markers cleared. Waiting and admission credentials carry the visit id as a signed claim, and the server refuses a credential from an earlier visit when it polls admission or sends a "left" beacon. Boundary: a consultation credential already issued stays valid until it expires (up to two hours) — the doctor can remove that participant from the room, but we do not claim instant revocation.

### 15. Does removing a patient always create a summary?

No. Removal changes the operational queue and disconnects the selected transport participant. Scoped encounter finalization, eligibility and evidence quality are separate decisions. A summary may be deterministic, unavailable, failed or a draft; the queue action is not an unconditional OpenAI billing switch.

## Capacity and performance

### 16. How many patients can wait?

The waiting-enabled invitation defaults to a target of ten; configured positive finite input is clamped to at most one hundred. Since 27 November the count happens inside the same Firestore transaction that reserves the place. It is a per-invitation admission rule, not a measured application maximum, a global clinic cap or a media connection allowance.

### 17. Can you guarantee the eleventh patient is rejected?

For one invitation, yes, and we have tested it — with stated scope. On 25 November our own audit showed the old check ran outside the transaction, so nine waiting plus two simultaneous arrivals ended at eleven. We fixed it: `reserveWaitingVisit` counts waiting rows inside the reservation transaction. In the Firestore emulator, two simultaneous arrivals at 9 of 10 gave 10 waiting and one "Waiting room is full"; 25 simultaneous arrivals into an empty queue of 10 gave exactly 10 waiting and 15 refused, and refused arrivals did not use up the invitation. Scope: emulator on one machine, not a production load test.

### 18. You already used a transaction before — why was there a race, and why is it gone now?

The old transaction protected only what it read: the invitation's use counter. The waiting count was read earlier, outside it, so two requests could both pass before either committed. A transaction around one counter is not a transaction around every business rule. Now the count is read inside the transaction, and every reservation also writes the same invitation document. Firestore lets only one of two transactions that write the same document commit; the other retries, re-counts, and sees the first person's row.

### 19. What was the old overshoot, and what does the fix not cover?

The old eleven was one example, not an upper bound. The fix covers one invitation's waiting target. It does not create a room-wide or clinic-wide cap (see 20), it does not limit how many people are admitted, and very heavy contention on one invitation would make some arrivals wait for a retry or get an error — which we tested only on the emulator.

### 20. Can one room have several invitations?

Yes. Per-invitation counts do not establish a combined room/clinic cap. If the product needs an aggregate room admission budget, it must explicitly own and enforce that separate invariant. Separate clinical encounters also need confidentiality and evidence isolation.

### 21. Is ten waiting the same as ten live video participants?

No. Waiting rows, issued credentials and connected endpoints differ. Waiting credentials cannot publish or receive media. Until 27 November the waiting page also mounted a hidden LiveKit pre-join screen, which could turn on the camera/microphone preview unseen without ever connecting; we removed it, and a regression test now checks that the waiting page mounts no media room. Devices are requested only on the visible preflight after admission. Connected-endpoint counts still need a controlled measurement.

### 22. How quickly does admission appear?

The patient checks immediately and then about every three seconds, with overlap protection and cleanup. Network delay, throttling and errors can extend that. It is an implementation interval, not a guaranteed three-second response SLA.

### 23. Are patient and doctor updates both Firestore listeners?

No. The doctor uses change invalidations that trigger authenticated API re-query, plus a default fifteen-second foreground reconciliation. The patient's waiting page polls the admission API about every three seconds. A loading spinner is not proof of continuous successful synchronization.

### 24. What load do ten waiting patients create?

At the nominal interval, ten pages imply roughly 200 admission HTTP checks/minute, before timing effects or other work. That is arithmetic, not measured database reads. Authorization, invitation reads and rate counters can add operations. The number does not measure video capacity or AI throughput.

### 25. Does the shared coordinator eliminate all duplicate requests?

It shares an in-flight request and polling scope within one browser runtime. Separate tabs, devices, users and different scopes can still issue requests. Changes/actions can trigger additional refreshes. Do not describe this as a global distributed cache.

### 26. Does active-only filtering eliminate archive reads?

No. It limits the projected result. Some current doctor-list paths fetch the doctor's rows before status/freshness filtering. Large archives therefore need indexed bounded queries and pagination. An empty displayed queue does not prove a zero-read operation.

### 27. How many simultaneous consultations can the whole app handle?

One doctor and one patient is the intended encounter. Maximum simultaneous pairs remains unmeasured. Provider ceilings, queue configuration and local regression counts cannot substitute for repeated paired-media trials with stated networks, devices, quality and correctness criteria.

## Failure, evidence and defense preparation

### 28. What if Firestore or the network fails?

Use visible error/retry states and retain the distinction between unknown/stale state and an empty queue. Do not bypass admission to keep a demonstration moving. Database outage behavior is separate from optional AI availability. A real deployment needs monitoring and a recovery process.

### 29. Is revocation enough to prove that every prior credential instantly stops working?

No blanket claim is made here. Server issuance/status checks use current invitation state, but already-issued transport credentials and repeated visit subjects have their own lifecycle. Queue credentials are now visit-bound (answer 14), so an earlier visit's credential cannot obtain admission for a later one. A consultation credential that was already issued remains valid until it expires; the doctor's remove action disconnects that participant. A staged adversarial replay test with two synthetic accounts is the next acceptance step.

### 30. Why not fix everything the night before defense?

We fixed the two queue defects because each fix was small and additive: one transaction, one extra signed claim, one new field on the queue row, and the removal of a hidden component. We did not change the call flow, the token format LiveKit relies on, or the stored data shape destructively; old rows still work until their next visit. Typecheck, lint, the regression suites and a production build passed. What we deliberately did not do the night before: rename the thesis, rewrite consent, add attachments or scheduling, or change the AI model.

### 31. Which manuscript pages changed for this topic?

Printed 54, 73, 74, 89, 90 and 94; physical PDF 66, 85, 86, 101, 102 and 106. The official title, page count, numbering, financial amounts and reported survey data remain unchanged. The page register and manifest give exact replacements. Public privacy masks remain separate from research corrections.

### 32. What evidence can we present today?

Present the pinned source map, the 25 November failing queue-race audit next to the 27 November passing audit and emulator result (`evidence/queue-capacity-fix-2026-11-27/`), dated prior regression/emulator/CI evidence and the bounded document checks. Keep prior test results dated. We do not add a new measured media maximum, clinician time-saving result or production penetration-test claim. Ready deployment status establishes a build/release event, not all acceptance criteria.

## Questions we had not rehearsed

These came from rereading the manuscript against the current code. Several point at places where the manuscript and the app disagree; the honest answer is to say which one is current and that the manuscript needs an adviser-approved correction.

### 33. Chapter I says patients get "device, browser, and location validation". Does the app do that?

No, and it should not. That sentence describes an early design. The current app does not use device fingerprints, browser checks or IP location to admit anyone, because none of those prove who a person is and they collect personal data. Admission is a verified allowlisted account or the doctor's decision. Table I's ip-api.com row is marked "not used". Ask the adviser to correct the Chapter I sentence (printed page 3).

### 34. Appendix C shows code that reads IP geolocation, stores device fingerprints and asks the AI for "prescriptions" and a Low/Medium/High risk. Is that the system you evaluated?

Appendix C is labelled as historical excerpts. The current summary code tells the model to use only facts in the transcript, allows "Unknown" risk, and stores a deterministic insufficient-evidence record when there is not enough transcript. Be precise about timing: if respondents evaluated an earlier build, say so; do not claim the survey evaluated today's code.

### 35. Is the video end-to-end encrypted?

No. Media is encrypted in transit (DTLS-SRTP between browser and LiveKit; TLS for signalling and our API), but LiveKit's servers can technically handle the media. LiveKit offers end-to-end encryption; we did not enable it. Chapter II's mention of end-to-end encryption is literature, not an implemented feature.

### 36. What stops a patient opening the patient room URL directly?

Not the Referer header — it is optional and spoofable, and the middleware comment says so. The room needs a signed, room-scoped LiveKit credential that only the server issues after invitation validation or doctor admission.

### 37. You use ISO/IEC 25010:2023 but your questionnaire says "Usability" and "Compatibility". Which is it?

In the 2023 edition Usability was renamed Interaction Capability, and Portability became Flexibility; Compatibility still exists as a separate characteristic. Our "F. Compatibility" items ask about devices, browsers and environment, which matches Flexibility (adaptability) in the 2023 model. The data is unchanged; the section heading in the instrument uses the older name. Admit the labelling mismatch; do not claim we evaluated Compatibility in the 2023 sense. The validation certificate also lists eight characteristics while the instrument covers six.

### 38. Five dentists — is a weighted mean of 3.51 meaningful?

It is descriptive for those five purposively chosen people, not generalisable. We report no standard deviation or reliability coefficient (e.g. Cronbach's alpha), so we cannot say how consistent answers were. Chapter V already limits the findings to the selected respondents. A better next step is a larger sample with dispersion and reliability reported.

### 39. Four of five dentists came from other clinics. Does "for Henry Cheung Dental Clinic" still hold?

The design followed the beneficiary clinic's workflow; the evaluation added outside dentists for broader professional opinion. That supports perceived acceptability among dentists generally, not proof that the beneficiary clinic adopted it.

### 40. A doctor rejects a visitor. What stops them reopening the link and queueing again?

Reopening starts a new visit at the back of the queue, and it always waits — even for a verified account on the direct-join list, because the doctor's rejection outranks the list. The doctor sees them again and can reject again. To stop the link entirely, the doctor revokes the invitation, which every token request rechecks. We chose this so one mistaken click does not permanently lock out a real patient, while a removed person can never walk straight back in.

### 41. Two patients share one invitation link. Can they see each other?

Not while waiting: waiting credentials cannot publish or subscribe to media, and the waiting page mounts no room. Once the doctor admits both, they are in the same LiveKit room. The intended workflow is one invitation per patient encounter; a multi-patient room is not a validated clinical workflow.

### 42. If a guest has no account, how is their queue entry kept across a refresh?

By their Firebase session (anonymous or signed in) when they have one; only with no session at all, by a keyed hash of network and browser. Neither is identity, and an email is never used — a typed email used to be part of the key, which let one guest land on another patient's entry; that was fixed. Two session-less guests behind the same network and browser could still share an entry, so such an entry that is already admitted starts a fresh waiting visit instead of passing the admission on.

### 43. What if the patient's phone dies after being admitted?

Short network drops are handled by LiveKit's own reconnection. If the page is lost, a verified allowlisted account that reopens the link rejoins its open admission directly; anyone else reopening goes back to waiting on the same entry and the doctor re-admits them. A dropped call is not treated as a completed or failed consultation by itself.

### 44. Can the AI summary be generated without the patient agreeing to transcription?

Not from their audio. Each participant opts in separately, the call works with transcription off, and the browser speech fallback is started by the clinician only after verbal consent. Without usable consented transcript, the result is an insufficient-evidence record, not an invented summary.

### 45. Does OpenAI keep the transcripts?

We send transcript text to OpenAI's API for the summary. Retention follows the provider's API terms and account settings, which we did not independently audit. A real clinic needs a processor agreement and a privacy impact assessment under RA 10173 before go-live.

### 46. What happens to the data after 30 days?

Summary deletion runs only if retention enforcement is switched on, and it deletes summaries, not sessions, messages, transcripts or backups. We do not claim everything disappears after 30 days.

### 47. Who can see a consultation's record?

The owning doctor and the patient bound to that encounter by their verified account, through server routes that check ownership. A guest's typed email does not attach history to anyone's account. The admin and faculty_reviewer roles exist in policy but have no screens.

### 48. How do you know your tests test the real code and not a copy?

The regression tests load the actual TypeScript modules and replace only the database and network with synthetic fakes. The queue fix was additionally run against the Firestore emulator's real transaction engine. Neither is a production test.

### 49. Waterfall says each phase is finished before the next. You fixed code during the defense week. Is that still Waterfall?

In practice we iterated inside the implementation and testing phases. Say that honestly rather than claim a strictly linear process; the fix is documented with dated evidence like any maintenance change.

### 50. If you had one more month, what would you do first?

A staged acceptance run: deploy the fixed commit, run the two-account replay and cross-doctor tests, then paired-call trials at 1, 3 and 5 simultaneous pairs with receiver statistics. Then clinician review of AI summary accuracy. Each produces a measurement we currently do not have.

## Questions from the second review (27 November, PR #9)

### 51. Could a guest take over another patient's admission by typing their email?
Before the fix, yes: queue entries were keyed by email even when the visitor only typed it, so a guest typing an admitted patient's email could inherit that entry and its consultation credential. Now the entry key comes only from a server-verified Firebase uid (or device hashes when there is no session), and the email is only a displayed label with its provenance. A regression test pins it.

### 52. Can anyone sign up as a doctor?
No. Signing in with Google creates at most a patient profile. Doctor, reviewer and admin roles come only from a custom claim that an administrator sets with `scripts/admin/provision-role.mjs`. Firestore rules refuse a client-created doctor profile unless the account already holds the claim. Doctor accounts created before claims existed are still honoured, logged, and listed by the script's audit so each can be granted a claim; we tried claim-only enforcement on 27 November and it locked out our own doctor, so we kept a transitional fallback rather than break the working call. Boundary: whoever holds the Firebase admin credential is trusted; protect it.

### 53. How does a doctor assign a patient?
The invitation is the assignment. It belongs to the doctor and one room; emails in "Patients who can join directly" let those verified accounts skip the queue. Everyone else with the link waits for that doctor. The encounter, summary and history are owned by that doctor; the patient sees only their own records. There is no scheduling module by design.

### 54. If the patient refreshes, do they use up another invitation use?
No. A reconnect to a visit that is still open reuses it and spends no use, and an exhausted use limit no longer refuses it. Only a new visit spends a use.

### 55. The patient opened the call on a second device. Does the queue think they left?
LiveKit disconnects the first device and reports it left. The server now checks whether the same identity is still connected, and whether the departing connection belongs to an earlier visit, before marking the entry left.

### 56. The doctor clicked Admit on an old screen after the patient left and came back. What happens?
The admit command carries the visit the doctor saw. If the entry has since started a new visit, the server returns a conflict and asks the doctor to refresh and review again.

### 57. Why does consultation history take a while to load?
Each consultation's chat transcript is a separate Firestore query, so a doctor with ~50 consultations triggered ~50 extra reads before anything showed, plus a serverless cold start. The dashboard now shows the summaries first and adds chat transcripts when they arrive. A paginated history endpoint and measured timings are the next step; we have not published a latency figure.

### 58. Why did View queue show patients for an expired invitation?
It showed an empty live-queue panel for a closed link, and on narrow screens the panel sat below a long list. Expired or revoked invitations now show "Queue closed" details, and the panel stays in view (sticky on wide screens, scrolled into view on phones).

### 59. Why so many fixes the week of the defense — doesn't that undermine your results?
The survey evaluated perceived quality of the demonstrated build; the fixes harden edge cases found by our own review and do not change the evaluated workflow or the objectives. Every fix has a regression test, and the manuscript states the current behaviour on the same pages.

### 60. Which manuscript pages changed?
37 physical pages, same 259 pages and numbering; the register lists each page, edit and reason. Objectives and Chapter IV numbers were not edited.

### 61. Where is doctor and patient provisioning, and what pattern is it?
Doctors: administrator provisioning with claims-based RBAC — an administrator grants the role in the **/admin** console (or with `scripts/admin/provision-role.mjs`); Firestore rules allow a doctor profile only for an account holding that claim, and the server reads the claim first (legacy doctor profiles are honoured transitionally and audited). Registered patients: self-service just-in-time provisioning of the lowest role (always `patient`) plus versioned consent. Guests: a capability link plus doctor admission. No self-service path leads to a privileged role.

### 62. Why didn't you add file attachments to chat?
Attachments are a prepared but disabled capability. Before enabling them we require private storage, type and size limits, malware scanning, download authorization, retention and cross-session denial tests. Adding uploads untested would weaken the security claims and risk the working call. Chat itself is persisted per encounter, length-bounded, retry-safe and visible in history; it is not used as AI evidence.

### 63. Is the chat used in the AI summary?
No. The summary uses consented transcript evidence only. Chat is shown to the clinician in history. Using chat as evidence would need provenance and consent rules first.

### 64. The summary editor showed risk "Low" for a consultation with no evidence. Is the AI inferring risk?
No. The model returned Unknown; the editor's dropdown had no Unknown option, so the browser displayed the first option. We fixed the editor to show "Unknown (not established)". Risk is never inferred from missing evidence.

### 65. What would most likely break during your demo, and what is your plan?
Provisioning (doctor must hold the claim), venue network or camera permissions, AI availability, and a duplicate tab replacing a patient's connection. We freeze the build, test on a preview first, keep a one-click rollback to the previous production deployment, use a fresh invitation, and have a hotspot and screenshots as backup. If AI is unavailable, the call still works and the record says so.

### 66. Is the production site running these fixes?
Answer truthfully for the day: either "yes, merged at commit …, tested on preview first" or "the fixes are on our pull request preview; production runs the evaluated build". Do not claim a deployment you have not verified.

### 67. What design patterns did you use?
Deep modules behind small interfaces (invitation access service, queue coordinator); pure decision functions with IO adapters (admission policy, `planWaitingArrival`); transactions for coupled writes (use counting, capacity, queue row); expected-version checks (visit ids); Command/Fact separation for lifecycle; realtime as invalidation with authenticated re-query; adapter around LiveKit; claims-based RBAC.

### 68. What were the architectural risks you found in your own design?
Keys derived from self-asserted data (fixed), checks outside the transaction that protects them (fixed), stale events acting on newer state (fixed), and authority read from editable profile data (fixed). The general lesson: authority must come from verified, server-held facts and be checked where it is committed.

### 69. A patient wants to send a photo of their tooth or an X-ray. Why can't they attach it in chat?
Because file attachments are a prepared but disabled capability, by design. A clinical image is sensitive personal information, and a safe upload path needs: private storage tied to one encounter, an allow-list of file types and a size limit, malware/content scanning, download only by the owning doctor and that patient, audit events, a retention and deletion rule, and tests proving another encounter cannot read the file. None of that is evaluated in this study, so we did not switch it on. Today the patient can show the tooth on camera or share their screen; the image is not stored. Attachments are listed as future work with those gates.

### 70. Wouldn't attachments make your summaries better?
Possibly, but only if the extracted content is trusted: the summary code is designed to accept attachment evidence only when an extraction is marked `ready` after scanning. Without that, an uploaded file could inject untrusted text into a clinical draft. So the evidence path exists in the design, and stays off until the safeguards are built and tested.

### 71. Anyone with a link can create a patient account. Isn't that a security risk?
No, because creating an account grants nothing clinical. Self-registration only ever produces the lowest role, `patient`, which can read that patient's own records and nothing else. Possessing a link still only lets someone *ask* to enter: they wait until the doctor admits them, unless their provider-verified account is on that invitation's list. This is the standard patient-portal pattern: open registration of a least-privilege role, with authorization checked per record and per encounter. What would be a risk — self-registering as a doctor — is impossible: clinician roles come only from an administrator.

### 72. How is a doctor account created? Show us.
An administrator opens **/admin**, enters the clinician's email (they must have signed in once) and grants "Doctor". The server re-checks that the caller is an administrator, sets the role claim, updates the profile, signs the account out of other sessions so the role applies at next sign-in, and records an audit event with user ids. Revoking reverses it. Pattern: administrator provisioning with claims-based role-based access control, least privilege and an audit trail.

### 73. Who is the first administrator? Isn't that a chicken-and-egg problem?
It is solved with a "break-glass" bootstrap: the server-only setting `SUPER_ADMIN_EMAILS` names the owner's provider-verified email. A super admin can grant doctors and administrators; an administrator can grant doctors only; nobody can change their own role, so one compromised account cannot escalate itself or lock everyone out. The setting lives in the hosting environment, not in the browser.

### 74. A patient account wants to become a doctor. Can the admin convert it?
No. Granting a clinician role to an existing patient account is refused; clinicians use a separate account. This keeps a person's own health history from mixing with clinician access.

### 75. Did you do anything about video and audio quality?
Yes, using standard LiveKit settings rather than custom code: adaptive streaming (each viewer receives a size that fits their screen), dynacast (the sender stops sending layers nobody watches), simulcast (several qualities so weak connections get a lower layer instead of freezing), a 720p capture target, browser echo cancellation, noise suppression and automatic gain, and redundant audio for lossy networks. These improve robustness; they do not guarantee a resolution. We have not measured delivered quality, so we describe the settings and the test we would run (receiver resolution, frames per second, packet loss, jitter, round-trip time).

### 76. Could you add attachments on Firebase's free tier?
Not on the free Spark plan: Cloud Storage for Firebase now requires the pay-as-you-go Blaze plan, which still includes a no-cost quota (about 5 GB stored and 1 GB downloaded per day). Putting images in Firestore documents is not a safe workaround. Our plan is in `attachment-plan.md`: private bucket, signed upload/download URLs issued after ownership checks, type and size limits, malware scanning before a file is usable, audit, retention, and cross-session denial tests.

### 77. How many patients used a link, and were they anonymous?
Each invitation records its visits by identification kind inside the same transaction that admits the visit: verified accounts, unverified accounts and guests (anonymous sessions or typed emails). The card shows e.g. "5 visits · 2 verified accounts · 3 guests"; reconnects are not counted twice. Invitations created before 27 November show only their join count.

### 78. What happens if the doctor raises or lowers the waiting limit?
The owning doctor can change it on a live invitation (1–100). The reservation reads the limit inside its transaction, so the change applies to the next arrival. Raising it lets more people wait at once; lowering it removes no one — new arrivals are refused until the queue is below the new limit.

### 79. If you sold this to several small clinics, how would accounts be provisioned?
Delegated, tenant-scoped administration: the platform super admin creates a clinic administrator per clinic; each clinic admin grants doctor accounts only within their clinic (claims carry `clinicId`; the server refuses cross-clinic grants and revocations); doctors invite their own patients; patients self-register only as patients. Doctors in different areas cannot see each other's patients because records are owned by the inviting doctor. Before a commercial launch we would add clinic-level record sharing, billing, DPA/RA 10173 compliance work, backups, monitoring and an independent security test.

### 80. If an administrator revokes a doctor, is access cut immediately?
New sessions are cut immediately (their refresh tokens are revoked, and the role claim is removed). An ID token already issued stays valid for up to one hour, so the server could still accept it during that window; checking revocation on every request is a one-line change we deferred because it adds a network call to every API request. We state the window rather than claim instant revocation.

### 81. Two guests use the same clinic Wi-Fi and the same browser. Do they get mixed up?
Not any more. A guest's queue entry is keyed by their Firebase session if they have one, otherwise by network, browser and a random per-tab id, so two tabs or two devices are separate visitors. A reload in the same tab keeps its place. None of these signals admits anyone; they only keep entries apart.

## Practice method for three writers

Writer 1 answers title/contribution questions 1-6 and research-method questions 37-39 and 49-50. Writer 2 answers admission/security questions 7-15, 28-30, 33-36, 40-47, 51-56, 61-65, 69-74 and 76. Writer 3 answers capacity/refresh questions 16-27, the page/evidence questions 31-32, 48, 57-60 and 66-68 and 75. Rotate once so nobody knows only their own section. Give each answer in 20-40 seconds, then handle one follow-up.

Use the four-part response: state the current rule, explain its reason, name the evidence, and state the limitation. If a number appears, give its units and scope. Do not argue with a panelist by substituting a provider limit for a missing experiment. An accurate limitation and a concrete next test are valid engineering answers; they do not guarantee an examination outcome.
