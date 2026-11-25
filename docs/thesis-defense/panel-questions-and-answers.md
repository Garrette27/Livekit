# Panel rehearsal: title, waiting queue and system boundaries

25 November 2026. Use these as practice answers, not a script for hiding defects or a guarantee of a passing grade. Source baseline `9d53610`; the local queue audit is synthetic. The [complete queue/title guide](waiting-queue-and-title-defense.md) supplies implementation references and teaching detail. Each writer should answer in their own words, then state the boundary without prompting.

## Title and contribution

### 1. Why did you choose this title?

We chose a title that names the developed application, its engineering scope, the LiveKit transport dependency, AI documentation assistance and the alternative patient-access paths. Our contribution is the integrated workflow and its design decisions. The words do not establish regulatory certification or clinical outcome improvement.

Follow-up to rehearse: identify one source module behind each phrase rather than saying the title sounds modern.

### 2. Is the study-book title your thesis title?

No. The official title begins "TeleConsole: Design and Development of a Secure Telehealth Video Communication System" and continues with LiveKit, AI summarization and flexible access. The 60,000-word book is a separate study resource. Rehearsal document labels do not rename the approved thesis.

### 3. What did you build if LiveKit already handles video?

We integrated transport with server-owned invitations, authenticated roles/ownership, waiting admission, encounter tracking, consented evidence and clinician-reviewed documentation. We do not claim to have invented WebRTC or a new SFU. Explain one end-to-end user journey to make the integration concrete.

### 4. Why call it secure if you still have limitations?

Secure describes the design objective and implemented safeguards, supported by specified tests. It is not an absolute guarantee. The current record includes unresolved unique-visit replay binding and non-atomic waiting-capacity accounting. We disclose those and require further remediation/acceptance before unrestricted clinic operation. If the panel requests a qualified title, we would seek adviser approval rather than claim certification.

### 5. Does AI make diagnoses or treatment decisions?

No. AI assists documentation from consented evidence. Output is a draft requiring clinician review; sparse or absent evidence can produce a deterministic insufficient-evidence record without inference. The clinician remains responsible for source review and medical decisions.

### 6. Does flexible access mean anyone can become a doctor?

No. Patient admission alternatives are separate from staff role provisioning. Google authenticates an account; trusted provisioning and server permissions authorize clinician actions. The identity provider does not verify a medical license for this application. Real-clinic onboarding and review of existing privileged accounts remain operational gates.

## Queue purpose and policy

### 7. Why have a waiting queue when the patient has a valid link?

A link can be forwarded. It proves possession of a scoped capability, not the holder's identity. Waiting admission lets the owning doctor inspect the visitor's displayed identity provenance and decide whether to grant consultation access. This preserves a guest path without treating typed email as verification.

### 8. Does every patient wait?

No. A qualifying non-anonymous account with a provider-verified email on the invitation allowlist may enter directly, subject to current invitation/consent/usage checks. Other accepted visitors wait for doctor admission. An observed full queue can still refuse validation before the direct/reconnect branch in current code, so this exception is not a promise to bypass every capacity check.

### 9. Is this first-in-first-out scheduling?

The list sorts oldest arrivals first. The doctor chooses whom to admit, so it is an admission worklist rather than an automatic FIFO dispatcher. The software does not enforce an appointment schedule or guarantee a treatment order.

### 10. Does the queue perform emergency triage?

No. It does not validate symptom urgency or calculate clinical priority. An emergency workflow needs explicit clinician processes and separate validation. Display order must not be described as a medical decision.

### 11. What does admitted mean?

The server granted permission to enter the consultation. It does not prove that the patient clicked Join, published media, stayed online or completed a visit. Queue state, LiveKit connection state and encounter lifecycle are separate records/signals.

### 12. Can the patient edit a URL or request to admit themselves?

Changing browser state is not authority. Admission requires the server to verify clinician permission and ownership plus current row/invitation state. Patient status checks require a signed credential bound to the requested invitation/row. These controls still need deployment acceptance and do not establish complete unique-visit replay isolation.

### 13. Can another doctor admit my patient?

The server derives the acting doctor from verified authorization and checks scope. A doctor id supplied in a query/body cannot grant ownership. Test with two unrelated synthetic doctor accounts in staging rather than inferring safety from hidden buttons.

### 14. What happens if the patient refreshes or returns?

The design tries to reuse an active row instead of creating duplicates, using derived invitation/patient keys and reconnect paths. A returning person is not automatically a new authenticated visit. Reused identifiers are precisely why immutable visit-bound credentials remain needed; do not claim every possible return/replay case is solved.

### 15. Does removing a patient always create a summary?

No. Removal changes the operational queue and disconnects the selected transport participant. Scoped encounter finalization, eligibility and evidence quality are separate decisions. A summary may be deterministic, unavailable, failed or a draft; the queue action is not an unconditional OpenAI billing switch.

## Capacity and performance

### 16. How many patients can wait?

The waiting-enabled invitation defaults to a target of ten; configured positive finite input is clamped to at most one hundred. The check counts waiting rows for that invitation and room. It is not a measured application maximum, a global clinic cap or a media connection allowance.

### 17. Can you guarantee the eleventh patient is rejected?

Not under all concurrent arrivals in current code. The capacity pre-check occurs outside the reservation transaction. With nine rows, two distinct visitors can both pass and then reserve, producing eleven in the local synthetic reproduction. We disclose this as a failed hard-capacity guarantee. We have not fixed it in this documentation-only change.

### 18. But you use a transaction, so why is there a race?

The transaction protects the values it reads and updates, including invitation-use counting and related writes. It does not read or reserve waiting capacity. Two requests can pass an earlier capacity check before either commits. A transaction around one counter is not a transaction around every business invariant.

### 19. Is eleven the maximum overshoot?

No. Eleven is one synthetic two-arrival example, not an upper bound or production observation. More simultaneous arrivals can create other interleavings. A capacity fix must define and atomically enforce the intended invariant, then test it under contention.

### 20. Can one room have several invitations?

Yes. Per-invitation counts do not establish a combined room/clinic cap. If the product needs an aggregate room admission budget, it must explicitly own and enforce that separate invariant. Separate clinical encounters also need confidentiality and evidence isolation.

### 21. Is ten waiting the same as ten live video participants?

No. Waiting rows, issued credentials and connected endpoints differ. Current waiting UI polls status and also mounts a hidden RoomShell preflight path, so do not infer actual device/media behavior from row count or a source comment. Measure connected endpoints and inspect preflight behavior in a controlled test.

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

No blanket claim is made here. Server issuance/status checks use current invitation state, but already-issued transport credentials and repeated visit subjects have their own lifecycle. Complete grant revocation/replay behavior needs a reviewed visit-bound protocol and adversarial tests.

### 30. Why not fix everything the night before defense?

Large token/schema/lifecycle changes can break the working call and invalidate evidence. This scope corrects claims and supplies a reproducible finding; it does not label the defect fixed. Before real-clinic release, capacity accounting and immutable visit grants must be remediated and tested. A deadline is not a reason to hide either limitation.

### 31. Which manuscript pages changed for this topic?

Printed 54, 73, 74, 89, 90 and 94; physical PDF 66, 85, 86, 101, 102 and 106. The official title, page count, numbering, financial amounts and reported survey data remain unchanged. The page register and manifest give exact replacements. Public privacy masks remain separate from research corrections.

### 32. What evidence can we present today?

Present the pinned source map, the local synthetic queue-race result, dated prior regression/emulator/CI evidence and the bounded document checks. Keep prior test results dated. We do not add a new measured media maximum, clinician time-saving result or production penetration-test claim. Ready deployment status establishes a build/release event, not all acceptance criteria.

## Practice method for three writers

Writer 1 answers title/contribution questions 1-6. Writer 2 answers admission/security questions 7-15 and 28-30. Writer 3 answers capacity/refresh questions 16-27 and the page/evidence questions 31-32. Rotate once so nobody knows only their own section. Give each answer in 20-40 seconds, then handle one follow-up.

Use the four-part response: state the current rule, explain its reason, name the evidence, and state the limitation. If a number appears, give its units and scope. Do not argue with a panelist by substituting a provider limit for a missing experiment. An accurate limitation and a concrete next test are valid engineering answers; they do not guarantee an examination outcome.
