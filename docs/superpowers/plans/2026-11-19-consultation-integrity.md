# Consultation integrity remediation plan

**Goal:** Close the two demonstrated Firestore consultation-write bypasses without breaking supported participant reads or server lifecycle writes.

**Architecture:** Keep consultation commands server-owned. Firebase client rules deny all consultation writes; trusted Admin SDK operations continue through the existing authorized server services. Preserve the existing legacy/current participant read policy.

**Spec:** The 19 November reassessment's F-2026-11-19-01, plus docs/access-control.md and docs/production-readiness.md. The user requested fixing the demonstrated failures; no new UI, migration or paid infrastructure is required.

## Decisions and constraints

- Choose server-owned writes over a client field allowlist because the source inventory finds no browser consultation writes. A client allowlist would duplicate server role/lifecycle policy without enabling a needed action.
- Preserve current and legacy read shapes, scoped queries and trusted backend writes. Do not tighten unrelated room/call collections in this patch.
- Keep production inspection read-only. Prepare the coupled application/rules release for review after validation; do not turn a local fix into a deployed PASS claim.
- Preserve the failed reassessment evidence. Record new red/green evidence separately and update the shareable status truthfully.
- Full WebRTC/performance acceptance still requires staging and real paired-call measurements. No speculative speed optimization is part of this security fix.

## Task 1: Lock the consultation command boundary

- [x] Add maintained regression cases for patient/privileged client creation, creator/participant/visibility updates, deletion, current/legacy allowed reads and cross-account denied reads.
- [x] Run the new cases against unchanged rules; verify the unsafe writes fail the expected-denial tests.
- [x] Deny all client consultation writes, with an interface comment explaining why; preserve the read contract.
- [x] Run the complete rule suite and the original supplemental reproduction against the repaired source.

## Task 2: Close server-side historical reassignment and history projection gaps

Ruling: the independent review found that the server's legacy linking route accepted arbitrary pending IDs and invitation-email matches, and could overwrite the current encounter while linking an earlier one. This is within the identity-integrity objective and would defeat a rules-only fix. Preserve the authenticated endpoint as an idempotent acknowledgment without mutations; admission owns identity. Patient history must require a consistent recorded UID and expose encounter metadata only, preserving legacy metadata UID shapes and clinician-only AI drafts.

- [x] Add failing route regressions for pending-ID reassignment, invitation-derived visibility and malformed old payloads; all three failed against the original handler.
- [x] Add failing history regressions for email-only/cross-UID records and clinician/queue content exposure.
- [x] Remove retroactive self-service ownership assignment and email-only history access; preserve current/legacy UID ownership reads.
- [x] Recheck compatibility and seek independent review of the added scope.

Ruling: compatibility review found that media subject IDs were being stored as patient UIDs. Bind the verified UID separately in newly issued credentials and consume that signed field during tracking. Do not restore browser-ID ownership. Delayed leave/finalization updates must compare the exact encounter transactionally and use session-specific patient identity. Added before/after regressions cover these paths.

## Task 3: Validate and prepare release evidence

- [x] Run security regressions, typecheck, lint, build and mobile browser tests in the isolated worktree.
- [x] Review the diff and confirm the identity boundary and supporting lifecycle/history paths changed; review test coverage and compatibility.
- [x] Save sanitized red/green logs, source hashes, the current production source comparison and the aggregate shape audit.
- [x] Write the remediation/design note and updated shareable documents, distinguishing local verification from production and performance acceptance.
- [x] Present the tested application/rules release as the remaining reviewable production action.

## Review focus

Creation by a patient even with their own createdBy; privileged Firebase clients bypassing server commands; partial update/merge/delete; metadata-based legacy participant reads; legitimate backend writes and unrelated participant denial.
