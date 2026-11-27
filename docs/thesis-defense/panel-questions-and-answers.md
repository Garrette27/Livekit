# Panel questions and answers: priority study order

27 November 2026. <!-- priority-order-v1 -->

Start with question 1. This priority order is an engineering judgment based on scope, unsupported claims, privacy, access control and demonstration risk. It is not an empirical prediction of what a panel will ask and does not guarantee a grade. All 81 prior topics are retained, plus administrator, bilingual, retention, lifecycle and responsive-design questions. Read the first 20 before the detailed follow-ups.

Reviewed source: `69f9c85` (role separation, encounter state, responsive layout and deployment-gated appointments). Existing queue evidence is dated and local; neither these answers nor a Ready deployment establish production load, clinical accuracy, security certification or multi-clinic clinical validation. No survey number or objective is changed. The [number map](panel-question-number-map.md) links older Q references to this order. Historical guides may retain those legacy references.

Use a 20-40 second answer: current rule, reason, specific evidence, limitation. Distinguish recorded results from proposed next tests. Provision only synthetic demonstration accounts; never show real patient records.

### 1. How many simultaneous consultations can the whole app handle?

<!-- legacy-question: 27 -->

One doctor and one patient is the intended encounter. Maximum simultaneous pairs remains unmeasured. Provider ceilings, queue configuration and local regression counts cannot substitute for repeated paired-media trials with stated networks, devices, quality and correctness criteria.

### 2. What did you build if LiveKit already handles video?

<!-- legacy-question: 3 -->

We integrated transport with server-owned invitations, authenticated roles/ownership, waiting admission, encounter tracking, consented evidence and clinician-reviewed documentation. We do not claim to have invented WebRTC or a new SFU. Explain one end-to-end user journey to make the integration concrete.

### 3. Why call it secure if you still have limitations?

<!-- legacy-question: 4 -->

Secure describes the design objective and implemented safeguards, supported by specified tests. It is not an absolute guarantee. The two queue defects we disclosed on 25 November — a waiting target that concurrent arrivals could exceed, and queue credentials that could be replayed against a later visit on the same entry — were fixed on 27 November and covered by regression tests and an emulator run. That is tested locally, not a security certification: production deployment of that commit, a staged two-account replay test and an independent review are still release gates. If the panel requests a qualified title, we would seek adviser approval rather than claim certification.

### 4. Does AI make diagnoses or treatment decisions?

<!-- legacy-question: 5 -->

No. AI assists documentation from consented evidence. Output is a draft requiring clinician review; sparse or absent evidence can produce a deterministic insufficient-evidence record without inference. The clinician remains responsible for source review and medical decisions.

### 5. What evidence can we present today?

<!-- legacy-question: 32 -->

Present the pinned source map, the 25 November failing queue-race audit next to the 27 November passing audit and emulator result (`evidence/queue-capacity-fix-2026-11-27/`), dated prior regression/emulator/CI evidence and the bounded document checks. Keep prior test results dated. We do not add a new measured media maximum, clinician time-saving result or production penetration-test claim. Ready deployment status establishes a build/release event, not all acceptance criteria.

### 6. Five dentists — is a weighted mean of 3.51 meaningful?

<!-- legacy-question: 38 -->

It is descriptive for those five purposively chosen people, not generalisable. We report no standard deviation or reliability coefficient (e.g. Cronbach's alpha), so we cannot say how consistent answers were. Chapter V already limits the findings to the selected respondents. A better next step is a larger sample with dispersion and reliability reported.

### 7. You use ISO/IEC 25010:2023 but your questionnaire says "Usability" and "Compatibility". Which is it?

<!-- legacy-question: 37 -->

In the 2023 edition Usability was renamed Interaction Capability, and Portability became Flexibility; Compatibility still exists as a separate characteristic. Our "F. Compatibility" items ask about devices, browsers and environment, which matches Flexibility (adaptability) in the 2023 model. The data is unchanged; the section heading in the instrument uses the older name. Admit the labelling mismatch; do not claim we evaluated Compatibility in the 2023 sense. The validation certificate also lists eight characteristics while the instrument covers six.

### 8. If you sold this to several small clinics, how would accounts be provisioned?

<!-- legacy-question: 79 -->

Delegated, tenant-scoped administration: the platform super admin creates a clinic administrator per clinic; each clinic admin grants doctor accounts only within their clinic (claims carry `clinicId`; the server refuses cross-clinic grants and revocations); doctors invite their own patients; patients self-register only as patients. Doctors in different areas cannot see each other's patients because records are owned by the inviting doctor. Before a commercial launch we would add clinic-level record sharing, billing, DPA/RA 10173 compliance work, backups, monitoring and an independent security test.

### 9. Who is the first administrator? Isn't that a chicken-and-egg problem?

<!-- legacy-question: 73 -->

The server-only SUPER_ADMIN_EMAILS configuration recognizes the owner's provider-verified account. It bootstraps administration without relying on a pre-existing doctor profile or an administrator signup checkbox. The platform owner grants clinic administrators; those administrators manage doctors in their own clinic. Self-change and bootstrap-account guards constrain role commands, but do not make a compromised owner account harmless. Protect the hosting environment and authentication account, and define recovery procedures.

### 10. Why must administrators use a separate doctor account?

<!-- legacy-question: 89 -->

Separation of duties: platform and clinic administrators manage staff access, not consultations. Clinical APIs deny administrator authority even with historical combined doctor/admin claims. New Administrator grants write an administrative role only, and removing it does not restore a legacy doctor profile. A separate clinician identity must be explicitly provisioned. Local Firestore rules also deny administrator clinical access, but require separate deployment. Server-only bootstrap configuration is not visible to those rules, so an environment-only owner's historical doctor claims still need an approved migration. Existing media credentials retain their separate lifecycle; no universal instant revocation is claimed.

### 11. Why did administrator sign-in open the doctor's Invitations page?

<!-- legacy-question: 82 -->

The old /admin entry linked to doctor login, and both doctor-login methods always navigated to Invitations. That was a routing defect, not evidence that authentication had granted administration. Dedicated /admin/login and /admin/signup now preserve administrator intent; the server access projection sends authorized administrators to /admin. Doctor login also checks for administrator access before the doctor workflow. Demonstrate the result with synthetic pre-provisioned accounts; screenshots alone do not prove current claims.

### 12. How is a doctor account created? Show us.

<!-- legacy-question: 72 -->

The clinician first creates a Firebase sign-in identity. An authorized administrator opens /admin, selects the clinic and Doctor role, and submits. The server checks authority, clinic scope and the patient-account guard, writes claims/profile metadata and records a uid-only audit event. Grants do not revoke sessions. The recipient signs in again or explicitly refreshes access to get the new claim. Administrator grants are a different operation available only to the platform owner. Revocation has the separate existing-token window described below.

### 13. Does the new administrator signup let anyone become an administrator?

<!-- legacy-question: 83 -->

No. It creates a Firebase Authentication identity only, without writing a privileged profile or custom claim. Google can establish that identity too. The platform owner separately grants Administrator within a clinic. An unapproved identity receives pending-access guidance and can refresh after approval. Never use a client-selected role or signup URL as authority. Demonstrate an unapproved identity being denied by the admin API as well as the page.

### 14. I clicked Grant role, but the account still opens the doctor workspace. Why?

<!-- legacy-question: 84 -->

Check the selected role and the confirmed result. Doctor grants clinician access only; Administrator adds clinic administration and is restricted to the platform owner. A successful Doctor grant is not a failed Administrator grant. After the correct authorized grant, refresh the recipient's ID token with Check access again or sign in again. Do not silently promote a real account just to make the demonstration look right.

### 15. Why did the configured super administrator appear as a legacy doctor?

<!-- legacy-question: 85 -->

Bootstrap authority and clinical profile history are different facts. The old list displayed only whether doctor custom claims matched a profile. The server now derives a verified configured owner's effective administration level from Firebase identity plus server-only configuration and labels it Server bootstrap. It does not rewrite that person's historical clinical role or expose the environment allowlist to browsers. An ordinary profile that merely contains the owner's email cannot acquire bootstrap authority.

### 16. What do you do when newly granted access does not appear, or the account service is down?

<!-- legacy-question: 86 -->

Refresh the recipient's token and re-query the server access projection; granted claims are not automatically present in an already-issued token. Keep a visible checking, pending or retry state. An Auth lookup outage must not be labeled as a deleted account, and an unsuccessful request must not be shown as an empty account list. No client retry grants a role. Existing-token revocation limits remain separate.

### 17. Can anyone sign up as a doctor?

<!-- legacy-question: 52 -->

No self-service flow may grant a clinician role. Firebase sign-in creates an identity; profile behavior depends on the entry route. Authorized administrators grant privileges through the console or provisioning script. Firestore rules refuse an unclaimed client-created doctor profile. A documented server-read legacy clinician-profile fallback still exists for older accounts; it needs an audited migration before removal. Do not describe current authorization as universally claim-only. Protect Firebase administrative credentials and verify clinician eligibility operationally.

### 18. A patient account wants to become a doctor. Can the admin convert it?

<!-- legacy-question: 74 -->

No. Granting a clinician role to an existing patient account is refused; clinicians use a separate account. This keeps a person's own health history from mixing with clinician access.

### 19. If an administrator revokes a doctor, is access cut immediately?

<!-- legacy-question: 80 -->

Revocation removes claims and revokes refresh tokens; an ID token already issued can remain accepted until its expiry because ordinary token verification does not check revocation on every request. The nominal Firebase ID-token lifetime is about one hour. A user who later signs in is a different case from reuse of an old token. Immediate enforcement requires a reviewed, tested revocation/current-authorization policy, including protected resources, existing LiveKit tokens and performance costs. It is not adequately specified as a one-line edit.

### 20. Are summaries really deleted after 30 days, and which cron does that?

<!-- legacy-question: 90 -->

The Firebase autoDeleteSummaries function runs daily but destructive cleanup is opt-in through RETENTION_ENFORCEMENT_ENABLED=true. Its configurable cutoff defaults to 30 days; one corrected bounded run deletes at most 200 call-summaries documents and 200 scheduled-deletions entries. The earlier 400-document page incorrectly required 800 delete operations. Sessions and other transcript/chat/summary copies are not fully purged. The Vercel daily /api/summary/process-queue cron retries summary work, not deletion. Deployment, enabled policy and successful runs must be verified separately. Age alone is not a deletion receipt.

### 21. Why have a waiting queue when the patient has a valid link?

<!-- legacy-question: 7 -->

A link can be forwarded. It proves possession of a scoped capability, not the holder's identity. Waiting admission lets the owning doctor inspect the visitor's displayed identity provenance and decide whether to grant consultation access. This preserves a guest path without treating typed email as verification.

### 22. Does every patient wait?

<!-- legacy-question: 8 -->

No. A qualifying non-anonymous account with a provider-verified email on the invitation allowlist may enter directly, subject to current invitation/consent/usage checks. Other accepted visitors wait for doctor admission. Since 27 November the waiting target is checked only when an arrival would add a new waiting row, so a full queue no longer refuses a verified direct-entry patient or someone already waiting who refreshes. Invitation expiry, revocation, consent and use limits still apply to everyone.

### 23. Could a guest take over another patient's admission by typing their email?

<!-- legacy-question: 51 -->

Before the fix, yes: queue entries were keyed by email even when the visitor only typed it, so a guest typing an admitted patient's email could inherit that entry and its consultation credential. Now the entry key comes only from a server-verified Firebase uid (or device hashes when there is no session), and the email is only a displayed label with its provenance. A regression test pins it.

### 24. Why can one invitation have multiple history rows, and should history wait for revocation?

<!-- legacy-question: 92 -->

An invitation is a reusable access policy; an encounter is a specific room opening with its own session id. Leaving and rejoining can create separate completed encounters, including doctor-only openings. Revocation closes future invitation access; it is not the sole encounter-completion event. Active encounters should say Not finalized rather than Awaiting summary, and summary generation must require finalization. Keep distinct records instead of merging by reused room name. A no-patient record is nonclinical, not an AI diagnosis or proof a scheduled patient failed to attend.

### 25. Is appointment scheduling implemented, and why is it still deployment-gated?

<!-- legacy-question: 97 -->

Doctor-booked appointments are implemented behind the existing default-off scheduling capability. Separate opaque records store UTC times and a named display timezone; a per-doctor transaction lock prevents overlapping bookings. Rescheduling uses the same id with a version check, cancellation retains the record, and an immutable create receipt makes retries safe. Local unit, browser and emulator cases passed, but production indexes/rules, existing-data and contact-retention review, and signed-in staging acceptance remain release gates. Booking never grants invitation admission, starts transcription or creates an encounter or AI evidence. Self-booking, reminders and calendar sync are excluded. HL7 FHIR's separate Appointment and Encounter resources are a design precedent, not a claim of FHIR interoperability. This is a later implementation, not a feature evaluated by the original survey respondents.

### 26. Can another doctor admit my patient?

<!-- legacy-question: 13 -->

The server derives the acting doctor from verified authorization and checks scope. A doctor id supplied in a query/body cannot grant ownership. Test with two unrelated synthetic doctor accounts in staging rather than inferring safety from hidden buttons.

### 27. Can the patient edit a URL or request to admit themselves?

<!-- legacy-question: 12 -->

Changing browser state is not authority. Admission requires the server to verify clinician permission and ownership plus current row/invitation state. Patient status checks require a signed credential bound to the requested invitation, row **and current visit id**. These controls still need deployment acceptance in staging.

### 28. Can you guarantee the eleventh patient is rejected?

<!-- legacy-question: 17 -->

For a fixed limit of ten on one invitation, a new visitor who needs another waiting place must be refused when ten are already waiting. The reservation checks capacity transactionally. The dated emulator report records two arrivals at nine of ten ending at ten, and 25 arrivals into ten places ending at ten with fifteen refused. These are local invariant tests, not a measured video maximum or production load result. Direct-entry patients and same-visit reconnects do not consume a new waiting place. Lowering a limit does not evict existing rows, so the current count can temporarily exceed a newly lowered limit.

### 29. You already used a transaction before — why was there a race, and why is it gone now?

<!-- legacy-question: 18 -->

The old transaction protected only what it read: the invitation's use counter. The waiting count was read earlier, outside it, so two requests could both pass before either committed. A transaction around one counter is not a transaction around every business rule. Now the count is read inside the transaction, and every reservation also writes the same invitation document. Firestore lets only one of two transactions that write the same document commit; the other retries, re-counts, and sees the first person's row.

### 30. How many patients can wait?

<!-- legacy-question: 16 -->

The waiting-enabled invitation defaults to a target of ten; configured positive finite input is clamped to at most one hundred. Since 27 November the count happens inside the same Firestore transaction that reserves the place. It is a per-invitation admission rule, not a measured application maximum, a global clinic cap or a media connection allowance.

### 31. What happens if the doctor raises or lowers the waiting limit?

<!-- legacy-question: 78 -->

The owning doctor can change it on a live invitation (1–100). The reservation reads the limit inside its transaction, so the change applies to the next arrival. Raising it lets more people wait at once; lowering it removes no one — new arrivals are refused until the queue is below the new limit.

### 32. Is ten waiting the same as ten live video participants?

<!-- legacy-question: 21 -->

No. Waiting rows, issued credentials and connected endpoints differ. Waiting credentials cannot publish or receive media. Until 27 November the waiting page also mounted a hidden LiveKit pre-join screen, which could turn on the camera/microphone preview unseen without ever connecting; we removed it, and a regression test now checks that the waiting page mounts no media room. Devices are requested only on the visible preflight after admission. Connected-endpoint counts still need a controlled measurement.

### 33. Two patients share one invitation link. Can they see each other?

<!-- legacy-question: 41 -->

Not while waiting: waiting credentials cannot publish or subscribe to media, and the waiting page mounts no room. Once the doctor admits both, they are in the same LiveKit room. The intended workflow is one invitation per patient encounter; a multi-patient room is not a validated clinical workflow.

### 34. Is the video end-to-end encrypted?

<!-- legacy-question: 35 -->

No. Media is encrypted in transit (DTLS-SRTP between browser and LiveKit; TLS for signalling and our API), but LiveKit's servers can technically handle the media. LiveKit offers end-to-end encryption; we did not enable it. Chapter II's mention of end-to-end encryption is literature, not an implemented feature.

### 35. Can the AI summary be generated without the patient agreeing to transcription?

<!-- legacy-question: 44 -->

Not from their audio. Each participant opts in separately, the call works with transcription off, and the browser speech fallback is started by the clinician only after verbal consent. Without usable consented transcript, the result is an insufficient-evidence record, not an invented summary.

### 36. Does responsive layout mean the app is proven on every phone and iPad?

<!-- legacy-question: 94 -->

No. Responsive layout adapts forms, navigation and call controls to narrow and tablet viewports. Compact call layouts use on-demand panels rather than fixed sidebars over the video; wider layouts reserve panel space. Report tested viewport dimensions and browser from the current evidence. Synthetic browser sizing is not an actual iPad/Safari audio-video acceptance test. Confirm real device permissions, keyboard operation, orientation changes, network recovery and optional speech support before claiming device compatibility.

### 37. Can patients speak Filipino, Tagalog or Taglish, and what language is the summary?

<!-- legacy-question: 87 -->

The clinician's browser speech-note selector includes fil-PH and en-US; the selected value is passed to browser recognition. Recognition availability and quality depend on the browser/provider and environment. The current summary prompt requests English output and preservation of uncertain names, medicines, measurements and short clinical phrases. A language selector is not a validated Tagalog speech or translation accuracy result. We have not measured Tagalog/Taglish error rates or clinical translation safety.

### 38. How would you validate bilingual AI summaries rather than just demonstrate them?

<!-- legacy-question: 88 -->

Use synthetic or explicitly consented paired Filipino/English scripts reviewed by a qualified clinician and bilingual reviewer. Compare source speech, captured text and generated draft separately. Record recognition errors, omissions, unsupported facts and translation changes to negation, dose, duration and names; assess reviewer agreement and report failures. A few correct examples do not establish accuracy. The current study's acceptability survey is not that experiment, and the clinician must verify the draft.

### 39. Why is transcription consent asked again when the doctor rejoins?

<!-- legacy-question: 93 -->

Consent is encounter-scoped and optional. A new room-page mount begins unchecked; a new encounter must not inherit consent merely because it reused a room name or invitation. Device preflight is also intentional because device availability may have changed. This is a privacy-preserving default, not proof of a broken video route. The call works without transcription. A future same-encounter resume could restore a clearly visible choice only with exact session/participant binding and revocation handling; do not silently restart recording.

### 40. Does OpenAI keep the transcripts?

<!-- legacy-question: 45 -->

We send transcript text to OpenAI's API for the summary. Retention follows the provider's API terms and account settings, which we did not independently audit. A real clinic needs a processor agreement and a privacy impact assessment under RA 10173 before go-live.

### 41. What happens to the data after 30 days?

<!-- legacy-question: 46 -->

Summary deletion runs only if retention enforcement is switched on, and it deletes summaries, not sessions, messages, transcripts or backups. We do not claim everything disappears after 30 days.

### 42. Who can see a consultation's record?

<!-- legacy-question: 47 -->

The owning doctor receives the authorized clinical projection; the patient bound by a verified uid receives their own encounter history, not the clinician's full AI draft. A typed guest email grants no historical ownership. The administrator console now manages staff access metadata; it does not establish shared clinic-wide clinical-record access. Faculty reviewer access remains backend-only and deny-by-default. Privileged Firebase operators are a separate infrastructure trust boundary.

### 43. Is the chat used in the AI summary?

<!-- legacy-question: 63 -->

No. The summary uses consented transcript evidence only. Chat is shown to the clinician in history. Using chat as evidence would need provenance and consent rules first.

### 44. The summary editor showed risk "Low" for a consultation with no evidence. Is the AI inferring risk?

<!-- legacy-question: 64 -->

The earlier editor could display its first option when a stored risk value had no matching option. The current editor includes Unknown and maps unsupported values to it. That UI fix does not prove every historical model result was Unknown or correct. The grounding rules forbid inferring low risk from missing evidence, and the clinician must review the actual record and source.

### 45. Did you do anything about video and audio quality?

<!-- legacy-question: 75 -->

Yes, using standard LiveKit settings rather than custom code: adaptive streaming (each viewer receives a size that fits their screen), dynacast (the sender stops sending layers nobody watches), simulcast (several qualities so weak connections get a lower layer instead of freezing), a 720p capture target, browser echo cancellation, noise suppression and automatic gain, and redundant audio for lossy networks. These improve robustness; they do not guarantee a resolution. We have not measured delivered quality, so we describe the settings and the test we would run (receiver resolution, frames per second, packet loss, jitter, round-trip time).

### 46. Does the doctor count as a verified patient visit?

<!-- legacy-question: 96 -->

No. Creating an invitation, appearing in the direct-entry audience configuration and joining as its owning doctor are not patient visits. Patient counters must be based on reserved patient visits, not the host's presence. Verified-account visits and guests describe identity provenance, not unique people or completed consultations. Reconnects reuse the same active visit. Older invitations may only have a historical aggregate join count; do not invent a verified/guest breakdown for them.

### 47. How many patients used a link, and were they anonymous?

<!-- legacy-question: 77 -->

Each invitation records its visits by identification kind inside the same transaction that admits the visit: verified accounts, unverified accounts and guests (anonymous sessions or typed emails). The card shows e.g. "5 visits · 2 verified accounts · 3 guests"; reconnects are not counted twice. Invitations created before 27 November show only their join count.

### 48. What belongs in the consultation room rather than repeating invitation management?

<!-- legacy-question: 95 -->

Show operational context: room/session identity, waiting occupancy versus its configured cap, verified direct-entry audience count, and participant state. Put captured arrival/admission/departure times and identity provenance in expandable details. Never label self-declared email verified or admission as confirmed media attendance. Teams and Zoom use participant/lobby controls separate from richer attendance reports; that is a useful design precedent, not proof of our app's usability. Hashed invitation emails cannot be recovered for display; show recorded participant identities truthfully and manage the invitation separately.

### 49. Can you reuse that scheduled worker for future attachment retention?

<!-- legacy-question: 91 -->

Reuse the bounded scheduled-worker pattern, not the existing summary query unchanged. Attachment cleanup would need an approved per-object expiry policy, ready/failed/uploading states, storage-object plus metadata deletion, legal-hold rules if required, idempotent retries and reconciliation for partial failure. Never log file content or download tokens. Test dry-run, expiry boundaries, duplicate invocations and orphan cleanup before enabling it. Attachments are disabled today; this is a future plan, not an implemented automatic attachment purge.

### 50. Two guests use the same clinic Wi-Fi and the same browser. Do they get mixed up?

<!-- legacy-question: 81 -->

Distinct unauthenticated tabs that supply different session ids avoid the old same-network/browser fallback collision. With a Firebase session, the verified uid takes precedence, so two tabs sharing that uid are still one principal. Duplicating a tab can copy session storage. The local regression proves the distinct-tab-id fallback case, not universal human identity separation. None of these correlation signals permits direct admission.

### 51. If a guest has no account, how is their queue entry kept across a refresh?

<!-- legacy-question: 42 -->

By the server-verified Firebase uid when a session exists. Without a Firebase session, the fallback combines keyed network/browser signals with the per-tab session id when supplied. Reloading that tab reuses its entry; an email is only a label. A shared Firebase uid still represents one principal across tabs, and duplicated tabs can copy session storage. Do not promise that every tab is a separate person or treat the tab id as identity verification. Use separate browser profiles/accounts for repeatable multi-person testing.

### 52. What happens if the patient refreshes or returns?

<!-- legacy-question: 14 -->

A refresh during the same visit reuses the same queue row and keeps the person's place and visit id. If the visit had ended (left or rejected) and the person reopens the link, the same row starts a **new visit**: new visit id, new arrival time, old end markers cleared. Waiting and admission credentials carry the visit id as a signed claim, and the server refuses a credential from an earlier visit when it polls admission or sends a "left" beacon. Boundary: a consultation credential already issued stays valid until it expires (up to two hours) — the doctor can remove that participant from the room, but we do not claim instant revocation.

### 53. If the patient refreshes, do they use up another invitation use?

<!-- legacy-question: 54 -->

No. A reconnect to a visit that is still open reuses it and spends no use, and an exhausted use limit no longer refuses it. Only a new visit spends a use.

### 54. The patient opened the call on a second device. Does the queue think they left?

<!-- legacy-question: 55 -->

LiveKit disconnects the first device and reports it left. The server now checks whether the same identity is still connected, and whether the departing connection belongs to an earlier visit, before marking the entry left.

### 55. The doctor clicked Admit on an old screen after the patient left and came back. What happens?

<!-- legacy-question: 56 -->

The admit command carries the visit the doctor saw. If the entry has since started a new visit, the server returns a conflict and asks the doctor to refresh and review again.

### 56. Is revocation enough to prove that every prior credential instantly stops working?

<!-- legacy-question: 29 -->

No blanket claim is made here. Server issuance/status checks use current invitation state, but already-issued transport credentials and repeated visit subjects have their own lifecycle. Queue credentials are now visit-bound (answer 52), so an earlier visit's credential cannot obtain admission for a later one. A consultation credential that was already issued remains valid until it expires; the doctor's remove action disconnects that participant. A staged adversarial replay test with two synthetic accounts is the next acceptance step.

### 57. A doctor rejects a visitor. What stops them reopening the link and queueing again?

<!-- legacy-question: 40 -->

Reopening starts a new visit at the back of the queue, and it always waits — even for a verified account on the direct-join list, because the doctor's rejection outranks the list. The doctor sees them again and can reject again. To stop the link entirely, the doctor revokes the invitation, which every token request rechecks. We chose this so one mistaken click does not permanently lock out a real patient, while a removed person can never walk straight back in.

### 58. What if the patient's phone dies after being admitted?

<!-- legacy-question: 43 -->

Short network drops are handled by LiveKit's own reconnection. If the page is lost, a verified allowlisted account that reopens the link rejoins its open admission directly; anyone else reopening goes back to waiting on the same entry and the doctor re-admits them. A dropped call is not treated as a completed or failed consultation by itself.

### 59. Does removing a patient always create a summary?

<!-- legacy-question: 15 -->

No. Removal changes the operational queue and disconnects the selected transport participant. Scoped encounter finalization, eligibility and evidence quality are separate decisions. A summary may be deterministic, unavailable, failed or a draft; the queue action is not an unconditional OpenAI billing switch.

### 60. What load do ten waiting patients create?

<!-- legacy-question: 24 -->

At the nominal interval, ten pages imply roughly 200 admission HTTP checks/minute, before timing effects or other work. That is arithmetic, not measured database reads. Authorization, invitation reads and rate counters can add operations. The number does not measure video capacity or AI throughput.

### 61. Does active-only filtering eliminate archive reads?

<!-- legacy-question: 26 -->

No. It limits the projected result. Some current doctor-list paths fetch the doctor's rows before status/freshness filtering. Large archives therefore need indexed bounded queries and pagination. An empty displayed queue does not prove a zero-read operation.

### 62. Why does consultation history take a while to load?

<!-- legacy-question: 57 -->

Each consultation's chat transcript is a separate Firestore query, so a doctor with ~50 consultations triggered ~50 extra reads before anything showed, plus a serverless cold start. The dashboard now shows the summaries first and adds chat transcripts when they arrive. A paginated history endpoint and measured timings are the next step; we have not published a latency figure.

### 63. How quickly does admission appear?

<!-- legacy-question: 22 -->

The patient checks immediately and then about every three seconds, with overlap protection and cleanup. Network delay, throttling and errors can extend that. It is an implementation interval, not a guaranteed three-second response SLA.

### 64. Are patient and doctor updates both Firestore listeners?

<!-- legacy-question: 23 -->

No. The doctor uses change invalidations that trigger authenticated API re-query, plus a default fifteen-second foreground reconciliation. The patient's waiting page polls the admission API about every three seconds. A loading spinner is not proof of continuous successful synchronization.

### 65. Does the shared coordinator eliminate all duplicate requests?

<!-- legacy-question: 25 -->

It shares an in-flight request and polling scope within one browser runtime. Separate tabs, devices, users and different scopes can still issue requests. Changes/actions can trigger additional refreshes. Do not describe this as a global distributed cache.

### 66. What if Firestore or the network fails?

<!-- legacy-question: 28 -->

Use visible error/retry states and retain the distinction between unknown/stale state and an empty queue. Do not bypass admission to keep a demonstration moving. Database outage behavior is separate from optional AI availability. A real deployment needs monitoring and a recovery process.

### 67. What would most likely break during your demo, and what is your plan?

<!-- legacy-question: 65 -->

Provisioning (doctor must hold the claim), venue network or camera permissions, AI availability, and a duplicate tab replacing a patient's connection. We freeze the build, test on a preview first, keep a one-click rollback to the previous production deployment, use a fresh invitation, and have a hotspot and screenshots as backup. If AI is unavailable, the call still works and the record says so.

### 68. Is the production site running these fixes?

<!-- legacy-question: 66 -->

Answer truthfully for the day: either "yes, merged at commit …, tested on preview first" or "the fixes are on our pull request preview; production runs the evaluated build". Do not claim a deployment you have not verified.

### 69. Why so many fixes the week of the defense — doesn't that undermine your results?

<!-- legacy-question: 59 -->

Distinguish the evaluated build from later maintenance. Report the actual survey date/build if recorded; do not claim respondents tested today's admin console, security fixes or media settings. The original survey results and objectives remain unchanged, while dated engineering evidence describes later changes. Similar-looking screens do not establish that a change has no effect on study validity. Ask the adviser how to present this separation.

### 70. How do you know your tests test the real code and not a copy?

<!-- legacy-question: 48 -->

The regression tests load the actual TypeScript modules and replace only the database and network with synthetic fakes. The queue fix was additionally run against the Firestore emulator's real transaction engine. Neither is a production test.

### 71. Why did you choose this title?

<!-- legacy-question: 1 -->

We chose a title that names the developed application, its engineering scope, the LiveKit transport dependency, AI documentation assistance and the alternative patient-access paths. Our contribution is the integrated workflow and its design decisions. The words do not establish regulatory certification or clinical outcome improvement.

Follow-up to rehearse: identify one source module behind each phrase rather than saying the title sounds modern.

### 72. Does flexible access mean anyone can become a doctor?

<!-- legacy-question: 6 -->

No. Patient admission alternatives are separate from staff role provisioning. Google authenticates an account; trusted provisioning and server permissions authorize clinician actions. The identity provider does not verify a medical license for this application. Real-clinic onboarding and review of existing privileged accounts remain operational gates.

### 73. Chapter I says patients get "device, browser, and location validation". Does the app do that?

<!-- legacy-question: 33 -->

No, and it should not. That sentence describes an early design. The current app does not use device fingerprints, browser checks or IP location to admit anyone, because none of those prove who a person is and they collect personal data. Admission is a verified allowlisted account or the doctor's decision. Table I's ip-api.com row is marked "not used". Ask the adviser to correct the Chapter I sentence (printed page 3).

### 74. Appendix C shows code that reads IP geolocation, stores device fingerprints and asks the AI for "prescriptions" and a Low/Medium/High risk. Is that the system you evaluated?

<!-- legacy-question: 34 -->

Appendix C is labelled as historical excerpts. The current summary code tells the model to use only facts in the transcript, allows "Unknown" risk, and stores a deterministic insufficient-evidence record when there is not enough transcript. Be precise about timing: if respondents evaluated an earlier build, say so; do not claim the survey evaluated today's code.

### 75. Four of five dentists came from other clinics. Does "for Henry Cheung Dental Clinic" still hold?

<!-- legacy-question: 39 -->

The design followed the beneficiary clinic's workflow; the evaluation added outside dentists for broader professional opinion. That supports perceived acceptability among dentists generally, not proof that the beneficiary clinic adopted it.

### 76. Waterfall says each phase is finished before the next. You fixed code during the defense week. Is that still Waterfall?

<!-- legacy-question: 49 -->

In practice we iterated inside the implementation and testing phases. Say that honestly rather than claim a strictly linear process; the fix is documented with dated evidence like any maintenance change.

### 77. What design patterns did you use?

<!-- legacy-question: 67 -->

Deep modules behind small interfaces (invitation access service, queue coordinator); pure decision functions with IO adapters (admission policy, `planWaitingArrival`); transactions for coupled writes (use counting, capacity, queue row); expected-version checks (visit ids); Command/Fact separation for lifecycle; realtime as invalidation with authenticated re-query; adapter around LiveKit; claims-based RBAC.

### 78. What were the architectural risks you found in your own design?

<!-- legacy-question: 68 -->

We found guest-key trust, capacity check/commit races, stale visit commands, and unclear identity-versus-role routing. Specific queue cases have local regressions and emulator evidence. Those fixes do not establish complete replay isolation across every already-issued token or eliminate the documented legacy privileged-profile fallback. Authentication, operational queue state, clinical encounter state and displayed labels must remain separate authorities.

### 79. If you had one more month, what would you do first?

<!-- legacy-question: 50 -->

A staged acceptance run: deploy the fixed commit, run the two-account replay and cross-doctor tests, then paired-call trials at 1, 3 and 5 simultaneous pairs with receiver statistics. Then clinician review of AI summary accuracy. Each produces a measurement we currently do not have.

### 80. Why didn't you add file attachments to chat?

<!-- legacy-question: 62 -->

Attachments are a prepared but disabled capability. Before enabling them we require private storage, type and size limits, malware scanning, download authorization, retention and cross-session denial tests. Adding uploads untested would weaken the security claims and risk the working call. Chat itself is persisted per encounter, length-bounded, retry-safe and visible in history; it is not used as AI evidence.

### 81. A patient wants to send a photo of their tooth or an X-ray. Why can't they attach it in chat?

<!-- legacy-question: 69 -->

Because file attachments are a prepared but disabled capability, by design. A clinical image is sensitive personal information, and a safe upload path needs: private storage tied to one encounter, an allow-list of file types and a size limit, malware/content scanning, download only by the owning doctor and that patient, audit events, a retention and deletion rule, and tests proving another encounter cannot read the file. None of that is evaluated in this study, so we did not switch it on. Today the patient can show the tooth on camera or share their screen; the image is not stored. Attachments are listed as future work with those gates.

### 82. Wouldn't attachments make your summaries better?

<!-- legacy-question: 70 -->

Possibly, but only if the extracted content is trusted: the summary code is designed to accept attachment evidence only when an extraction is marked `ready` after scanning. Without that, an uploaded file could inject untrusted text into a clinical draft. So the evidence path exists in the design, and stays off until the safeguards are built and tested.

### 83. Could you add attachments on Firebase's free tier?

<!-- legacy-question: 76 -->

Plan for Cloud Storage for Firebase billing eligibility and region/bucket-specific quotas, not an unlimited free upload service. Confirm current official requirements before enabling it. Putting images into Firestore documents is not a safe substitute. Attachments remain disabled until private storage, permission checks, file limits, scanning, audit, retention and isolation tests are implemented. See the attachment plan for the proposed boundary, not a shipped feature.

### 84. Anyone with a link can create a patient account. Isn't that a security risk?

<!-- legacy-question: 71 -->

Open identity registration is a deliberate least-privilege entry path, not a claim of zero risk. A patient can read only records actually bound to their verified uid; registration must not grant clinician access or adopt a guest's history by typed email. A valid invitation and admission policy still control call entry. Abuse, account quotas, verification, recovery and monitoring need controls before clinic use. A claim of impossible privilege escalation would require broader independent testing than this study provides.

### 85. How does a doctor assign a patient?

<!-- legacy-question: 53 -->

The invitation is the admission assignment. It belongs to the doctor and one room; emails in "Patients who can join directly" let those verified accounts skip the queue. Everyone else with the link waits for that doctor. The encounter, summary and history are owned by that doctor; the patient sees only their own records. The later, deployment-gated appointment module plans a time; it does not replace that policy or prove attendance. It was not evaluated in the original survey.

### 86. Why did View queue show patients for an expired invitation?

<!-- legacy-question: 58 -->

It showed an empty live-queue panel for a closed link, and on narrow screens the panel sat below a long list. Expired or revoked invitations now show "Queue closed" details, and the panel stays in view (sticky on wide screens, scrolled into view on phones).

### 87. Is this first-in-first-out scheduling?

<!-- legacy-question: 9 -->

The list sorts oldest arrivals first, by the arrival time of the visitor's *current* visit. (Before 27 November a visitor who left and came back kept their first arrival time and could jump to the top; a new visit now gets a new arrival time.) The doctor chooses whom to admit, so it is an admission worklist rather than an automatic FIFO dispatcher. The software does not enforce an appointment schedule or guarantee a treatment order.

### 88. Does the queue perform emergency triage?

<!-- legacy-question: 10 -->

No. It does not validate symptom urgency or calculate clinical priority. An emergency workflow needs explicit clinician processes and separate validation. Display order must not be described as a medical decision.

### 89. What does admitted mean?

<!-- legacy-question: 11 -->

The server granted permission to enter the consultation. It does not prove that the patient clicked Join, published media, stayed online or completed a visit. Queue state, LiveKit connection state and encounter lifecycle are separate records/signals.

### 90. What was the old overshoot, and what does the fix not cover?

<!-- legacy-question: 19 -->

The old eleven was one example, not an upper bound. The fix covers one invitation's waiting target. It does not create a room-wide or clinic-wide cap (see 91), it does not limit how many people are admitted, and very heavy contention on one invitation would make some arrivals wait for a retry or get an error — which we tested only on the emulator.

### 91. Can one room have several invitations?

<!-- legacy-question: 20 -->

Yes. Per-invitation counts do not establish a combined room/clinic cap. If the product needs an aggregate room admission budget, it must explicitly own and enforce that separate invariant. Separate clinical encounters also need confidentiality and evidence isolation.

### 92. Why not fix everything the night before defense?

<!-- legacy-question: 30 -->

The initial queue repair was small and additive: a transaction, a signed claim, a queue-row field and removal of a hidden component. Later maintenance added role separation, lifecycle safeguards and a tested but deployment-gated appointment module. These checkpoints do not rewrite the original study results. We preserved the call's security boundary, optional consent, official title and AI model; attachments remain disabled. A passing build is not a reason to bypass release gates or enable unverified production features.

### 93. Which manuscript pages changed for this topic?

<!-- legacy-question: 31 -->

The latest follow-up concerns PDF 66, 71, 75, 106 and 111 / printed 54, 59, 63, 94 and 99: role separation, retention/future attachment cleanup, encounter finalization, responsive context/consent and deployment-gated scheduling. Earlier queue corrections also cover PDF 85, 86, 101 and 102. The complete register lists 45 bounded edits on 37 physical pages. The official title, 259-page count, numbering, expenses and reported survey data remain unchanged. Public privacy masks are separate from research corrections.

### 94. Which manuscript pages changed?

<!-- legacy-question: 60 -->

37 physical pages, same 259 pages and numbering; the register lists each page, edit and reason. Objectives and Chapter IV numbers were not edited.

### 95. What stops a patient opening the patient room URL directly?

<!-- legacy-question: 36 -->

Not the Referer header — it is optional and spoofable, and the middleware comment says so. The room needs a signed, room-scoped LiveKit credential that only the server issues after invitation validation or doctor admission.

### 96. Where is doctor and patient provisioning, and what pattern is it?

<!-- legacy-question: 61 -->

Doctors: administrator provisioning with claims-based RBAC — an administrator grants the role in the **/admin** console (or with `scripts/admin/provision-role.mjs`); Firestore rules allow a doctor profile only for an account holding that claim, and the server reads the claim first (legacy doctor profiles are honoured transitionally and audited). Registered patients: self-service just-in-time provisioning of the lowest role (always `patient`) plus versioned consent. Guests: a capability link plus doctor admission. No self-service path leads to a privileged role.

### 97. Is the study-book title your thesis title?

<!-- legacy-question: 2 -->

No. The official title begins "TeleConsole: Design and Development of a Secure Telehealth Video Communication System" and continues with LiveKit, AI summarization and flexible access. The 60,000-word book is a separate study resource. Rehearsal document labels do not rename the approved thesis.

## Three-writer rehearsal

Writer 1 explains contribution, research scope and evidence. Writer 2 explains authorization, admission and privacy. Writer 3 explains load units, AI/language limits and failure recovery. Everyone rehearses questions 1-20, then rotates roles. For every demo step, name whether it proves UI behavior, a server denial, a local invariant or a measured production result.
