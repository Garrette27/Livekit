# Consultation Modular Architecture

This document defines a deep-module split so room UI, invitation flow, and history services stay malleable.

## Goals

- Keep LiveKit-specific code behind adapters.
- Keep consultation lifecycle logic independent from UI framework details.
- Make admin and moderation features additive, not invasive.
- Preserve strategic design: simple interfaces, complexity inside modules.

## Bounded Modules

1. `consultation-session-core`
- Owns session state machine and events.
- Input: domain commands (`admitPatient`, `patientLeft`, `patientRejoined`, `endSession`).
- Output: persisted session and timeline events.
- No UI code, no LiveKit component imports.

2. `invitation-access-core`
- Owns invitation validation, waiting-room admission policy, and identity resolution.
- Returns normalized participant identity (`displayName`, `isAnonymous`, `patientUserId?`).

3. `rtc-transport-adapter`
- Encapsulates LiveKit join/connect/publish behavior.
- Converts transport callbacks into domain events consumed by `consultation-session-core`.

4. `chat-transport-adapter`
- Encapsulates message send/receive in-room.
- Produces normalized chat events (`senderName`, `senderType`, `message`, `sentAt`).

5. `history-projection`
- Builds patient and doctor history views from summaries + session events.
- Never reads UI local state directly.

6. `feedback-ui-adapter`
- Owns modeless feedback patterns (toast, inline success, button press states).
- No business rules; only presentation of operation outcomes.

## Stable Interfaces

Define and keep these small and explicit:

- `ConsultationSessionStore`
  - `startSession(input)`
  - `appendEvent(sessionId, event)`
  - `closeSession(sessionId, metadata)`
  - Invariants:
  - Idempotency: `startSession` must return the same `sessionId` for duplicate join/retry in reconnect window.
  - Authorization boundary: only trusted backend commands can mutate session state; UI never writes state directly.
  - Side effects: writes `consultationSessions/{sessionId}` snapshot and immutable timeline events only.

- `InvitationAccessService`
  - `validateInvite(token, context)`
  - `createWaitingEntry(input)`
  - `admitWaitingEntry(waitingId, doctorId)`
  - Invariants:
  - Idempotency: repeated `validateInvite` for same invitation/device/email must reuse active waiting entry instead of duplicating.
  - Authorization boundary: invite validation may authenticate patient identity; admit/reject operations require doctor scope.
  - Side effects: writes invitation audit trail and waiting queue state; no summary/history writes.

- `ChatMessageStore`
  - `appendMessage(sessionId, message)`
  - `listVisibleMessages(sessionId, participantId, visibilityPolicy)`
  - Invariants:
  - Idempotency: client retries must not duplicate messages (caller supplies stable message id where possible).
  - Authorization boundary: sender identity is resolved server-side from authenticated/session context.
  - Side effects: appends immutable message records; never mutates consultation state machine.

- `SummaryProjectionService`
  - `buildSummary(sessionId)`
  - `buildDoctorHistory(doctorUserId)`
  - `buildPatientHistory(patientUserId)`
  - Invariants:
  - Idempotency: rebuilding projections for same inputs must produce equivalent output.
  - Authorization boundary: projection read access is role-scoped (doctor sees own, patient sees own).
  - Side effects: write-only to projection/read-model documents (`call-summaries`, history views), never transport state.

## Interface Error Semantics

- Masked at module boundary:
  - Duplicate joins/leaves become idempotent no-op updates.
  - Missing optional linkage data (e.g., delayed patient linking) degrades to partial metadata, not hard failure.
  - "Already processed" states (already admitted, already revoked) are treated as successful no-op where safe.
- Propagated to caller:
  - Authorization failures (`403`) and invalid actor-role transitions.
  - Invalid input contracts (`400`) and not-found required resources (`404`) when operation cannot continue.
  - Infrastructure failures (`5xx`) only when module cannot preserve invariants.
- Rule:
  - Propagate only errors that require caller action.
  - Mask and log recoverable/duplicate conditions inside module.

## Future Feature Hooks

1. Doctor removes patient from room
- Add new domain event type: `patient_removed_by_doctor`.
- Transport layer executes room disconnect.
- Session core appends event and marks participant state.
- Summary projection includes the event in timeline and key points.

2. Patient leaves and rejoins
- Already modeled as timeline events.
- Keep readmission policy in `invitation-access-core` so doctor must re-admit after leave.

3. Admin dashboard
- Read from `admin-activity-feed` and `audit-logs`.
- Admin actions become domain commands, not direct UI-side document mutation.

4. Multi-email instant access
- Keep invite identity matching behind `InvitationAccessService`.
- Current shape supports single `emailAllowed`; future shape extends to `constraints.emails[]` without changing caller contract.
- Admission policy decision (`auto-admit` vs `waiting`) must stay policy-driven in `invitation-access-core`.

5. Admin hierarchy and global registration policy
- Add `admin-policy-core` for role graph (`root_admin`, `clinic_admin`, `assistant_admin`) and delegated permissions.
- Add `registration-policy-core` for global allow/deny email policy by role (`doctor`, `patient`).
- All role/registration checks happen in policy modules; UI consumes decision outputs only.

## Routing Conventions

- Canonical doctor history route is hard-locked to `getDoctorHistoryRoute()` from `lib/routes/doctor-routes.ts`.
- Current canonical value is `/doctor/dashboard`.
- `/doctor/history` remains compatibility alias only and must redirect to the canonical helper.
- Hard rule: no feature code may hardcode `/doctor/history` or `/doctor/dashboard` directly.

## UI Rules for Malleability

- Buttons trigger actions and set explicit states (`idle`, `loading`, `success`, `error`).
- Avoid browser dialogs; use modeless feedback adapter.
- Keep button labels stable and expose only policy flags for show/hide behavior.

## Event Schema and Versioning

- Timeline and audit events must be treated as contracted schemas, not ad-hoc payloads.
- Required envelope fields for every timeline/audit event:
  - `eventDomain` (e.g., `consultation.presence`, `invitation.audit`)
  - `eventType`
  - `eventVersion`
  - `occurredAt`
  - `actorType`
  - `actorId` (or explicit `null` for system)
  - `metadata` (non-breaking additive only)
- Versioning rules:
  - Additive fields: keep same `eventVersion`.
  - Semantic shape changes or renamed meaning: increment `eventVersion`.
  - Projection modules (`history-projection`, `admin-activity-feed`) must branch by version and never infer from transport payloads.
- Leakage prevention:
  - Transport adapters may translate event payloads but cannot redefine event meaning.
  - UI consumes projection/read models, not raw event storage.

## Testing Focus

- Unit test `consultation-session-core` transitions.
- Unit test invitation admission and role-conflict checks.
- Integration test history projections for leave/rejoin/remove timelines.
- UI tests only verify wiring to domain commands and feedback states.
