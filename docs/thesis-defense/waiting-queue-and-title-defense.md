# TeleConsole: waiting queue and thesis-title defense

25 November 2026, Asia/Singapore. Reviewed source: `9d53610`. This is a supplement to the existing defense pack, not a new clinical validation study. It introduces no application behavior change and does not establish a maximum concurrent workload. The accompanying slides and panel answers use synthetic examples only.

> **Update, 27 November 2026.** Three findings in this guide were fixed in code afterwards; where the text below says otherwise, this note wins. (1) The per-invitation waiting target is now enforced inside the reservation transaction — the "9 + 2 = 11" race no longer reproduces, and a Firestore emulator run kept 25 simultaneous arrivals to exactly 10 (`evidence/queue-capacity-fix-2026-11-27/`). A full queue no longer refuses a verified direct entry or someone already waiting. (2) Queue credentials carry a signed visit id; a credential from an earlier visit on the same entry cannot poll admission or mark the current visit as left, and a returning visitor gets a new arrival time. (3) The waiting page no longer mounts a hidden LiveKit pre-join screen. The slides and PDFs generated on 25 November still describe the earlier state. See [panel-questions-and-answers.md](panel-questions-and-answers.md) for the updated answers.

## The official title, exactly as submitted

**TeleConsole: Design and Development of a Secure Telehealth Video Communication System Using LiveKit with AI Summarization and Flexible User Access Design**

This is the title on physical PDF page 1. Keep it unchanged unless the adviser approves a formal title revision. The 60,000-word book, *Understanding, Investigating and Defending a Teleconsultation System*, is a separate learning resource. It is neither the approved thesis title nor a new experimental result. The labels on these rehearsal documents are teaching labels only.

## Why this title fits the project

The following is a defensible rationale derived from the artifact and study scope. It does not claim to reconstruct an undocumented historical conversation among the authors.

| Phrase | What the team can explain | Evidence boundary |
| --- | --- | --- |
| TeleConsole | The project name identifies the developed teleconsultation application. | A brand name is not evidence of effectiveness. |
| Design and Development | The contribution is an implemented system and the design decisions connecting access, transport and documentation. | Do not describe the study as a randomized trial or a proof of clinical outcome improvement. |
| Secure | The design includes server authorization, scoped invitations, ownership, consent and privacy controls. | Security is a design objective supported by specific tests, not an absolute guarantee. Queue capacity and unique-visit replay gaps remain explicit. |
| Telehealth Video Communication System | The artifact supports a remote consultation workflow, including media and supporting records. | It does not replace every physical examination, emergency service or specialty-specific clinical assessment. The evaluated setting is dental-oriented. |
| Using LiveKit | LiveKit supplies WebRTC media transport; the team integrates it with the application workflow. | The authors did not invent WebRTC or build a new SFU. Integration and policy composition are the claimed work. |
| With AI Summarization | AI can assist documentation from consented, attributed evidence. | It produces a clinician-reviewed draft, not an autonomous diagnosis. Evidence gates can skip inference. |
| Flexible User Access Design | Verified allowlisted patients may enter directly; other valid invite holders use clinician admission. | Flexible access does not allow self-assigned doctor privileges or treat a forwarded link as identity. |

### A forty-second title answer

"We chose this title because it identifies the artifact, its engineering contribution and its boundaries. TeleConsole is the application. Design and development describes building the complete workflow. LiveKit provides the video transport, while our server controls invitation and record access. AI assists documentation from consented evidence and requires clinician review. Flexible access means verified allowlisted entry or clinician-controlled waiting admission. We use secure as a design objective with specific safeguards and tests, not a claim that the prototype has no vulnerabilities or is certified for clinical deployment."

If the panel asks whether *secure* is too strong, acknowledge the concern. Explain the tested controls and unresolved findings. Offer adviser-approved wording changes only if required; do not rename the thesis overnight or silently promise a certification that was never obtained. The strongest defense is precision, not arguing that the word itself proves security.

## Why the waiting queue exists

A valid invitation proves that the holder has a scoped capability. It does not establish that the person is the intended patient. A clinician-controlled waiting step lets the doctor inspect the displayed identity provenance and choose whether to issue consultation-room access. It also supports visitors who cannot complete account verification before a demonstration or appointment.

It is useful to describe this as an **admission worklist with oldest-arrival display order**. The software sorts rows by `joinedAt`, but the doctor chooses which row to admit. There is no automatic FIFO dispatcher, validated clinical triage engine, appointment scheduler or waiting-time prediction. Do not claim that it guarantees first-come-first-served treatment or identifies medical urgency.

The direct-admission exception is important. Only a non-anonymous authenticated identity whose provider-verified email matches the invitation allowlist may skip manual waiting. A typed address, copied link, IP address, private browser window or device resemblance cannot provide that assurance. Email verification proves account control, not a legal identity or medical qualification. Applicable consent and current invitation checks still apply.

## Admission flow in plain language

1. The doctor creates an invitation under the doctor's room ownership.
2. The backend verifies the signed invitation against its stored record, expiry and current status. It resolves the visitor's authenticated identity and applicable consent.
3. The existing usage/capacity pre-check runs. An observed full queue can refuse access before the later direct/reconnect branch as well; do not promise those branches bypass every capacity refusal.
4. A qualifying verified allowlist match can receive consultation-room access. Other accepted visitors get a waiting row and a token scoped to the waiting room.
5. The owning doctor admits a specific current waiting row. The server rechecks ownership, room and current invitation/row state transactionally before granting consultation access.
6. The patient learns of admission and reaches the visible device preflight. Actual media connection is a separate event.
7. Queue departure/removal updates the operational worklist. Authenticated encounter tracking and trustworthy transport events handle clinical finalization. A reusable queue row must not select and close the room's newest clinical record.

Source map: `lib/invitations/validate-service.ts`, `lib/invitations/invitation-use-reservation.ts`, `lib/services/invitation-access/invitation-access-core.ts`, `lib/services/shared/waiting-room-auth.ts`, and `app/api/waiting-room/{list,admit,reject,check-admission,mark-left}/route.ts`. The list route derives the doctor id from verified authorization; a caller-supplied query id is not authority.

## Queue state, media state and encounter state are different

| Object/state | What it means | What it does not prove |
| --- | --- | --- |
| Waiting row: waiting | A visitor awaits the doctor's decision. | Camera permission, connected media, medical urgency or a fixed service time. |
| Waiting row: admitted | The server granted admission. | The patient clicked Join, sent media, stayed connected or completed a consultation. |
| Waiting row: left/rejected | Operational departure or refusal/removal. | An atomic purge of records or successful AI generation. |
| LiveKit connection | An endpoint established transport. | Correct encounter ownership, useful clinical evidence or a completed appointment. |
| Consultation session | A clinical encounter record with lifecycle/evidence references. | A room name alone uniquely identifies every visit. |
| Summary: ready/reviewed | A generated draft / clinician-reviewed content. | Queue admission alone supplied enough clinical evidence. |

The visible label is now **Admitted**, not a reliable attendance count. An old screenshot labeled "In Room" does not change that distinction. A count of rows and a count of connected endpoints answer different questions.

There is an additional implementation caveat: the invitation waiting branch mounts a hidden `PatientLiveKitRoom` when allowed; that wrapper uses `RoomShell`, which starts at PreJoin with no submitted choices. A misleading source comment about patients seeing each other is not evidence of actual media sharing. Do not claim either that all waiting rows connect to LiveKit or that waiting always consumes zero device/provider resources. Hidden preflight/device initialization deserves a privacy/UX review before clinic use. Observe actual connections and device behavior during a controlled test; token issuance and a hidden component are not measurements.

## What "10 waiting" really means

Invitation creation defaults `maxPatients` to 10 for a waiting-enabled invitation and clamps a positive finite configured value to at most 100. This is a configured **per-invitation waiting target**. It is neither a measured 10-person video capacity nor a project-wide cap on all room participants. Multiple invitations can refer to the same room, and admitted visitors are a different state.

The pre-check counts rows matching room, invitation and status `waiting`. It runs outside the reservation transaction. The transaction atomically protects invitation-use counting and associated writes, but it does not re-count capacity or reserve a remaining waiting slot. These are different correctness properties.

A local reproduction used the actual extracted pre-check and actual reservation function with synthetic IO: start with nine waiting rows and a target of ten; let two distinct visitors both pass the pre-check; then serialize their reservations. Both succeed and the adapter ends with eleven rows. This establishes a possible interleaving in the reviewed source. It is **not a production incident, a cloud benchmark or a fixed overshoot bound**. More concurrent requests can behave differently. See [source-audit.json](evidence/queue-title-2026-11-25/source-audit.json) and `scripts/thesis/audit-queue-contract.mjs`.

Therefore the hard atomic-capacity claim is **NOT PASSED**. Documentation must not call this an enforced ten-patient concurrency guarantee. A future fix needs transactionally owned capacity/slot accounting, idempotent reconnect handling, and release paths for admission, rejection, departure and expiry. Testing only the counter increment is insufficient. This document-only request does not implement that app change.

## How the queue refreshes

The doctor hook uses `subscribeToDoctorQueueChanges` to receive Firestore change invalidations, then re-queries the authenticated API projection. Snapshot contents do not directly become the displayed clinical state. A shared coordinator deduplicates in-flight identical requests and polling within one browser runtime/scope. The default doctor foreground refresh interval is fifteen seconds; hidden tabs stop periodic reconciliation and refresh when visible again. These optimizations do not share a global cache across every tab, device or doctor.

The patient waiting page checks admission immediately and then approximately every three seconds. It guards against overlapping requests and aborts/cleans up on effect teardown. Network latency, browser throttling and backend errors can delay it. This is not a three-second service-level guarantee. It is inaccurate to say the patient's spinner proves continuous Firestore-listener synchronization.

For planning only, ten waiting pages at one request every three seconds imply about 200 admission checks/minute before timing effects, retries or other requests. One foreground doctor polling scope at fifteen seconds implies about four periodic refreshes/minute, plus event/action-triggered refreshes. Those are modeled HTTP request rates, not measured Firestore reads. Each operation may perform several document reads, and listeners themselves can cost reads.

`activeOnly` produces an expiry/freshness-filtered output, not proof that the database fetched only active rows. In particular, the current doctor branch with multiple statuses reads the doctor's rows before filtering. A large archive can therefore still cost reads. An indexed status-specific query, bounded pages, debounced invalidation and measured read budgets are sensible scale work. Do not claim unlimited queue history or zero-cost real-time updates.

## Security and failure questions the team must expect

Server ownership controls prevent one doctor from admitting another doctor's row. The patient status route requires a signed patient credential bound to the requested invitation/row and room policy. Expiry and revocation matter even when a token signature remains valid. A displayed email is a label with provenance; a self-declared email must not gain a verified-account privilege.

The queue is not the only privacy boundary. The prior checkpoint documents incomplete unique-visit credential/replay isolation when a principal/queue key recurs across visits. This remains a release gate. Do not substitute oldest-first display, signed tokens or the new different-principal check for proof of immutable visit binding. Use synthetic controlled accounts and separate rooms for a demonstration, while making clear that this precaution is not the missing security fix.

If a list refresh fails, a spinner or an empty count is not evidence that no patients exist. Read the error and last-update state; retry through the authorized surface. If the doctor loses connection, do not bypass server admission by granting a broad token. If a patient leaves before admission, a deterministic not-admitted/no-show record may be appropriate only under the existing encounter/evidence rules. Queue removal is not an unconditional OpenAI billing switch.

## A five-minute explanation for three teammates

**Writer 1, about one minute:** "The title names the application, the engineering task and the scope. We developed a teleconsultation workflow using LiveKit transport. The study is dental-oriented. Secure refers to explicit safeguards and their tests, not a guarantee or certification. AI supports clinician-reviewed documentation."

**Writer 2, about two minutes:** "A link is a capability, not identity. Verified allowlisted patients may enter directly; other accepted visitors wait for a doctor decision. The server checks ownership before admission. The list displays oldest arrivals first, but the doctor selects a patient, so this is not automatic FIFO or clinical triage. Admitted means permission to join. It does not mean the patient is connected or has completed a visit."

**Writer 3, about one minute:** "Ten is the default waiting target for one invitation, not a measured call limit. The current capacity pre-check can race with concurrent reservations, so we do not claim a hard ten-person ceiling. Patient admission checks run about every three seconds, while the doctor view uses change invalidation and a fifteen-second foreground refresh. We must measure actual request/read load and media quality separately."

**All, final minute:** Each writer answers one question: Why the title? Does admitted equal connected? Is ten a proven maximum? Finish with: "We can explain the implemented controls and show specific local evidence. We cannot claim an unmeasured maximum, a guaranteed wait time or complete production security."

## Messenger message to send

Team, same official title tayo. LiveKit is the media provider; our contribution is the integrated consultation/access/documentation workflow. Flexible access means verified allowlisted entry OR doctor admission, hindi unrestricted access. Queue is an admission worklist: oldest-first ang display pero doctor ang pumipili, hindi automatic FIFO or medical triage. "Admitted" means allowed to join, hindi necessarily connected. Default 10 is per invitation waiting target, hindi measured video limit; may concurrent-capacity race pa, so no hard-cap claim. Read the panel Q&A and slide notes. Use synthetic demo accounts only and keep the limitations consistent.

## What to show in PowerPoint

Use the editable fourteen-slide supplement. Explain the title first, show the admission diagram, distinguish the three state models, then discuss queue target, refresh/load and remaining limits. The synthetic nine-plus-two example demonstrates why an atomic use counter does not prove atomic waiting capacity. It is not a chart of production users.

For a five-minute version use slides 1, 3, 4, 6, 8 and 13. For a fuller twelve-to-fifteen-minute rehearsal use every slide and its notes, with pauses for the three writers. The deck is a supplement to the institution's full defense deck; it does not replace methodology/results slides or the unchanged questionnaire findings.

## Manuscript changes

Keep the official title and budget unchanged. The follow-up corrects printed pages **54, 73, 74, 89, 90 and 94**, corresponding to physical PDF pages **66, 85, 86, 101, 102 and 106**. These address unconditional summary language, the direct-admission exception, the actual clinician navigation, patient polling versus doctor invalidation, and waiting/admitted/capacity distinctions. See [the page register](page-change-register.md) and the updated manifest for exact text. Preserve the existing historical screenshots, with public privacy masks, rather than manufacturing a new production screenshot.

## Rehearsal stop conditions

Stop and correct anyone who says all patients must wait, the queue performs medical triage, ten means tested video capacity, the spinner proves live media, every leave calls OpenAI, Google grants a doctor license, or a Ready deployment proves complete security. Ask for units, scope, tested environment and evidence. A precise limitation is more defensible than an invented rebuttal.
