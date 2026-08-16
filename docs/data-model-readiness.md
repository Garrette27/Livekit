# Teleconsultation data-model readiness

This is the thesis team's map of the current Firestore model and the safe
extension points for attachments and scheduling. It separates what exists now
from what is only a proposed design. It is not a migration plan or a compliance
claim.

## Evidence used for this review

- The current repository contracts, security rules, indexes, and API routes.
- The redacted aggregate Firestore audit recorded in
  `docs/thesis-defense-guide.md` on 2026-08-16.
- Redacted production screenshots and Vercel request logs supplied on
  2026-08-17. The current doctor's UI showed 91 invitations (1 active and 90
  expired or revoked), one current invitation use, and one admitted participant.
- A public production smoke check of the home page and an invalid invitation.

Fresh direct Firestore reconnaissance was not available for this release pass
because the current shell has no production credentials and its Vercel CLI is
not authenticated. No private key from screenshots was copied into the
development environment. Before a real migration, repeat the aggregate-only
reconnaissance required by `AGENTS.md`.

## Current authority map

| Concern | Current authority | Role |
| --- | --- | --- |
| Invitation lifecycle | `invitations/{invitationId}` | Bearer capability metadata, owner, expiry, use policy, and counters |
| Invitation evidence | `invitations/{invitationId}/accessAttempts` and `/violations` | Server-only, privacy-preserving security events |
| Queue projection | `waitingPatients/{waitingPatientId}` | Operational patient state scoped by `doctorUserId` and invitation |
| Encounter lifecycle | `consultationSessions/{consultationSessionId}` | Stable session identity for events, transcript provenance, and summaries |
| Legacy room projection | `consultations/{roomName}` and historical call records | Compatibility reads; do not use room name as the identity of a new feature |
| Summary work | `call-summaries` and `summaryJobs` | Doctor-visible output plus a server-only retry queue |

The intended direction is one stable `consultationSessionId` per encounter.
Room names are reusable display/routing values and therefore cannot safely own
attachments, appointments, or clinical evidence.

## Corrections made in this release

1. New invitation allowlists store keyed email hashes and a count instead of
   plaintext addresses. Compatibility reads remain for existing invitations.
2. Invitation JWTs no longer repeat the allowlisted email. Possession of a link
   is never treated as identity proof.
3. Successful access events are capped at the newest 100 rows per invitation.
   Violation evidence keeps the latest row per violation category. Parent
   invitation documents no longer start unbounded event arrays.
4. Waiting-room API dates are normalized into an explicit transport DTO, so
   Firestore timestamp serialization cannot produce `Unknown` admission times.
5. A shared queue coordinator prevents page components from multiplying the
   same Firestore listener and server request.
6. The unused client Storage uploader and destructive misnamed cache endpoint
   were removed. All client Storage access remains denied.
7. The completed waiting-patient backfill is no longer exposed as a deployed
   write-enabled API. Future migrations must be versioned, dry-run first,
   resumable, auditable, and removed from request traffic after verification.

## Significant legacy gaps

- Old invitation documents can still contain plaintext allowlist fields. Keep
  compatibility projections until those links expire; do not perform a rushed
  destructive migration before the defense.
- Patient email is repeated in several legacy consultation and queue
  projections. New modules should prefer immutable user/participant ids and
  keep display contact data in the smallest authorized profile boundary.
- `consultations`, call records, and `consultationSessions` overlap. New
  features must write against the session aggregate and expose explicit legacy
  projections rather than creating another lifecycle owner.
- Retention periods for waiting rows, audit events, chat, notes, and backups
  still require a thesis-team decision and automated enforcement.

## Prepared attachment model (disabled)

Use normalized session children, not an attachments array on a message:

`consultationSessions/{sessionId}/attachments/{attachmentId}`

Suggested fields:

- `uploaderParticipantId`, optional `messageId`
- `objectPath`, `contentType`, `byteSize`, `sha256`
- `status`: `uploading | quarantined | scanning | ready | failed | deleted`
- `createdAt`, `readyAt`, `deletedAt`
- `failureCode` from a bounded non-clinical vocabulary

Messages may reference `attachmentIds`; they must not embed public download
URLs or extracted clinical text. Trusted extraction evidence belongs in a
separately authorized session child with source attachment id, extractor
version, provenance, and `ready` status. Summary generation consumes only that
ready evidence.

The server must authorize the exact session and participant before issuing a
short-lived upload or download operation. File signature and size checks,
quarantine, malware scanning, deletion, retention, and cross-session denial
tests are release gates.

## Prepared scheduling model (disabled)

Scheduling is a separate aggregate; it is not a set of fields on an invitation:

`appointments/{appointmentId}`

Suggested fields:

- `doctorUserId`, `patientUserId` when known
- `startsAt` and `endsAt` as UTC timestamps
- `displayTimeZone` as an IANA timezone such as `Asia/Manila`
- `status`: `scheduled | rescheduled | cancelled | completed | no-show`
- `createdAt`, `updatedAt`, optimistic `version`
- optional `currentInvitationId` as a reference issued for this appointment

Use `appointments/{appointmentId}/events/{eventId}` for an append-only status
timeline and `reminders/{channel-offset}` for idempotent delivery state. Doctor
availability and recurrence rules belong to their own server-owned model.
Conflict checks, reschedule/cancel commands, participant authorization, and
timezone/DST tests must exist before the capability flag is enabled.

## Rule for future implementation

Extend the session or appointment through a small server interface, keep its
Firestore details hidden, and leave both capability flags unset until every
security gate has an automated regression. Do not add UI merely because a
collection or flag exists.
