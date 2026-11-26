# Consultation attachments — plan (not implemented for the defense)

**Short answer: not on the free Spark plan.** Cloud Storage for Firebase now requires the Blaze (pay-as-you-go) plan; Spark projects lost read/write access to their default bucket from 3 February 2026. Blaze still includes a no-cost quota (5 GB stored, 1 GB downloaded/day, 20,000 uploads/day, 50,000 downloads/day per Firebase's FAQ), so a thesis-scale pilot would likely cost $0 — but it needs a billing account and a budget alert. Source: [Firebase Storage changes FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

Storing images inside Firestore documents is **not** an acceptable workaround: documents cap at 1 MiB, every read bills the whole blob, and it bypasses the scanning and download controls below.

## Why it stays off for tomorrow

`AGENTS.md` lists the gates before attachments ship. None can be built and tested overnight without risking the working call:

| Gate | Design (proven pattern) |
|---|---|
| Session ownership | Upload only through a server route that checks the caller is the owning doctor or the admitted patient of that encounter; object path `encounters/{sessionId}/{uploadId}` |
| Allow-listed type/size | JPEG/PNG/PDF only, ≤ 5 MB, verified by magic bytes, not the file name |
| Private storage | Bucket with Storage rules `allow read, write: if false` for clients; uploads via **short-lived signed upload URLs** issued by the server |
| Malware/content scanning | Quarantine prefix → scan (e.g. Cloud Run ClamAV or a vendor API) → move to `ready` only if clean; status `pending → ready | rejected` |
| Download authorization | Server issues a short-lived signed download URL after re-checking encounter ownership; never a public URL |
| Audit | `attachmentEvents` (upload, scan result, download) with uids, no file content |
| Retention/deletion | Same record-class policy as summaries; deletion removes object + metadata; backups documented |
| Cross-session denial tests | Patient of encounter A cannot list, read or download encounter B's file; tested in the emulator |
| AI evidence | Summaries may use only `ready` extractions (already enforced in the summary design) |

## Phased plan (after the defense)

1. **Week 1 — infrastructure:** upgrade to Blaze with a $1 budget alert; private bucket; Storage rules deny-all; enable the existing `ENABLE_FILE_ATTACHMENTS` server flag only in staging.
2. **Week 2 — upload/download path:** server routes for signed upload/download URLs with ownership checks; metadata document per attachment; chat message references `attachmentId`, never a URL.
3. **Week 3 — scanning + UI:** quarantine and scan worker; chat paperclip with modeless "Scanning… / Ready / Rejected" states; preview only when `ready`.
4. **Week 4 — tests + review:** emulator tests for cross-session denial, type/size rejection, scan rejection; privacy review of consent text (images are sensitive personal information under RA 10173).

Until then the patient can show the tooth on camera or share their screen; nothing is stored.
