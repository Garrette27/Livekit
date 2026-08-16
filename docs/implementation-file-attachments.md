# File Attachments Implementation Notes

This document defines the current attachment architecture and when third-party services are needed.

## Current State

- The capability flag defaults to disabled and there is no attachment UI.
- Firebase Storage denies every client read and write.
- Server-owned metadata is scoped under `consultationSessions`; extraction text
  is isolated in an attachment evidence child and chat stores only resolved ids
  plus display metadata.
- The API rejects browser-supplied paths, URLs, extraction text, and attachment
  objects. There is intentionally no upload slot or download route yet.
- The old room-name-scoped note uploader was removed because it bypassed the
  consultation-session boundary and had no malware, quarantine, or retention
  workflow.

## Target Direction

- Store attachment metadata in the consultation session aggregate.
- Store binary files behind server-issued, short-lived upload and download authorization.
- Keep consultation summaries aware only of trusted, ready extraction evidence.

## Minimal Data Model

- `consultationSessions/{consultationSessionId}/attachments/{attachmentId}`
  - server-owned object metadata, uploader participant id, optional message id,
    content type/size/hash, lifecycle status, and timestamps
- Chat messages reference attachment ids; they do not embed public download
  URLs or extracted clinical text.
- Trusted extraction evidence is a separately authorized session child with
  attachment provenance and a `ready` status.

## Upload Flow

1. Client requests upload slot for `consultationSessionId`.
2. Server validates ownership/visibility.
3. Server issues a short-lived upload target bound to the exact session, participant, object id, type, and size.
4. Client uploads to that target; the object remains quarantined.
5. A worker validates file signature, scans the object, extracts text when applicable, and marks metadata ready or failed.
6. Downloads require fresh session authorization; storage URLs are not persisted as public bearer links.

## Extraction/Indexing Flow

- For PDF/images/text, run async extraction worker.
- Update `extractionStatus` and `extractedText`.
- Include extracted snippets in summary generation context.

## Third-Party Requirement

- Not required for basic attachments + metadata.
- Optional if you need:
  - antivirus scanning,
  - OCR at scale,
  - advanced DLP/compliance controls.

## Security Rules Requirements

- Restrict attachment read/write to users visible in the same `consultationSessionId`.
- Deny cross-session access by default.
- Keep admin-only override paths explicit and audited.
- See `docs/data-model-readiness.md` for the complete normalized shape and
  scheduling boundary.
