# Activity Log Pipeline and Session Timeline

## Overview

This repository now has two complementary observability layers:

1. Firestore `onWrite` audit pipeline (Cloud Functions) for operational debugging and compliance review.
2. Explicit patient presence timeline (`joined`, `left`, `rejoined`) attached to each generated consultation summary.

## Cloud Functions: Audit + Admin Feed

File: `functions/activity-log-pipeline.js`

### Trigger coverage

- `consultations/{documentId}`
- `consultationSessions/{documentId}`
- `consultationSessions/{consultationSessionId}/events/{eventId}`
- `call-summaries/{documentId}`
- `invitations/{documentId}`
- `waitingPatients/{documentId}`
- `users/{documentId}`

### Output collections

- `audit-logs/{eventId}`
- `admin-activity-feed/{eventId}`

Both docs are written for each Firestore write event, keyed by a deterministic event id derived from the Cloud Functions event id.

### Admin feed schema

`admin-activity-feed` documents contain:

- `schemaVersion: number`
- `eventId: string`
- `operation: "create" | "update" | "delete"`
- `sourceCollection: string`
- `sourcePath: string`
- `sourceDocumentId: string`
- `occurredAt: Date`
- `createdAt: serverTimestamp`
- `summary: string`
- `changedFields: string[]`
- `tags: string[]`
- `roomName?: string | null`
- `consultationSessionId?: string | null`
- `doctorUserId?: string | null`
- `patientUserId?: string | null`
- `actorUserId?: string | null`
- `actorEmail?: string | null`
- `eventType?: string | null`

### Security model

Firestore rules enforce:

- `audit-logs`: readable by owner (`userId`) or admin claim.
- `admin-activity-feed`: readable only by admin claim.
- Both are write-protected for clients (server-only writes).

## Consultation Summary Timeline Fields

File: `lib/consultations/summary-service.ts`

When `consultationSessionId` exists, the generator now reads:

- `consultationSessions/{consultationSessionId}/events`

and extracts patient presence events into:

- `presenceTimeline: Array<{ eventType, actorType, eventAt, label }>`
- `metadata.hasPresenceTimeline`
- `metadata.presenceTimelineEvents`
- `metadata.patientJoinedCount`
- `metadata.patientLeftCount`
- `metadata.patientRejoinCount`
- `metadata.patientHadDisconnect`
- `metadata.patientHadRejoin`

The presence timeline is also injected into the AI prompt and key points so patient disconnect/rejoin behavior can be reflected in the narrative output.
