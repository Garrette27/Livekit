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

- `InvitationAccessService`
  - `validateInvite(token, context)`
  - `createWaitingEntry(input)`
  - `admitWaitingEntry(waitingId, doctorId)`

- `ChatMessageStore`
  - `appendMessage(sessionId, message)`
  - `listVisibleMessages(sessionId, participantId, visibilityPolicy)`

- `SummaryProjectionService`
  - `buildSummary(sessionId)`
  - `buildDoctorHistory(doctorUserId)`
  - `buildPatientHistory(patientUserId)`

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

## Routing Conventions

- Canonical doctor history route: `/doctor/dashboard`.
- Keep `/doctor/history` as compatibility alias only.
- Navigation controls should call a shared route helper to avoid fragmented behavior.

## UI Rules for Malleability

- Buttons trigger actions and set explicit states (`idle`, `loading`, `success`, `error`).
- Avoid browser dialogs; use modeless feedback adapter.
- Keep button labels stable and expose only policy flags for show/hide behavior.

## Testing Focus

- Unit test `consultation-session-core` transitions.
- Unit test invitation admission and role-conflict checks.
- Integration test history projections for leave/rejoin/remove timelines.
- UI tests only verify wiring to domain commands and feedback states.
