# File Attachments Implementation Notes

This document defines the current attachment architecture and when third-party services are needed.

## Current Direction

- Store attachment metadata in session-scoped chat records.
- Store binary files in Firebase Storage.
- Keep consultation summaries aware of attachment context (already supported in summary metadata paths).

## Minimal Data Model

- `consultationSessions/{consultationSessionId}/chatMessages/{messageId}`
  - `attachments: [{ id, name, mimeType, size, storagePath, downloadUrl, extractionStatus, extractedText }]`

## Upload Flow

1. Client requests upload slot for `consultationSessionId`.
2. Server validates ownership/visibility.
3. Client uploads file to Firebase Storage path scoped by `consultationSessionId`.
4. Server writes attachment metadata into chat message record.

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
