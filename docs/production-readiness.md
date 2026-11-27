# Thesis production-readiness boundaries

This document records the safeguards that must remain explicit as the thesis
prototype evolves. It is an engineering policy, not a claim of regulatory
certification or clinical fitness.

## Faculty reviewer preparation

`faculty_reviewer` remains a reserved backend role. There is no reviewer page,
route, dashboard, or collection-wide consultation permission.

A future review endpoint must require both:

1. the `consultation:review-assigned` role permission; and
2. an active, unexpired assignment for the exact reviewer and consultation.

The assignment contract lives in `lib/auth/review-assignment-policy.ts`.
`reviewAssignments` is denied to all Firebase clients. Provisioning and access
must be server-owned, de-identified where possible, and audit logged.

## Data minimization and retention

| Data class | Current control | Retention decision |
| --- | --- | --- |
| AI summaries | Server-owned; doctor-only reads | Daily job; opt in with `RETENTION_ENFORCEMENT_ENABLED=true`; `SUMMARY_RETENTION_DAYS` defaults to 30 |
| Session transcript evidence | Each participant explicitly opts in before LiveKit joins; audio chunks are discarded after transcription | Include text/provenance in the approved consultation-record retention period before real patient use |
| Browser speech notes | Explicit clinician start after recorded verbal-consent confirmation; labeled as a fallback | Include in the approved consultation-record retention period before real patient use |
| Chat and manual notes | Bound to a consultation/session | Define and implement the same approved consultation-record period |
| Attachments | Capability is disabled; all Firebase Storage client paths are denied; metadata/evidence routes are server-owned and chat resolves only session-owned ids | Add session-scoped upload/download authorization, signature/malware scanning, quarantine, and an approved deletion worker before enabling uploads |
| Invitation security signals | HMAC-hashed allowlist emails plus network/user-agent correlations; no client fingerprint or IP-geolocation lookup | Delete with the invitation/security investigation period |
| Waiting-room rows | Server-written and doctor-scoped | Define a short operational retention period |
| Audit events | Metadata-only; no document before/after snapshots | Define a compliance period separately from clinical content |
| Platform logs and backups | Provider-managed | Configure provider retention and document restoration/deletion limits |
| Distributed rate counters | HMAC-keyed; no raw address | Firestore TTL on `expiresAt` |

Until every row has an approved period and automated enforcement, use synthetic
or explicitly consented thesis data only.

## AI summary lifecycle

Summary metadata uses:

`processing → ready → reviewed`

or:

`processing → failed`

`unavailable` means the account or deployment has no AI entitlement. Browser
speech recognition is labeled as doctor-device speech notes and is never
described as a complete transcript. `ready` output is a draft; saving a
clinician-reviewed edit changes the state to `reviewed`.

`summaryJobs` persists processing leases and retries failed or interrupted
work. Vercel Cron calls `/api/summary/process-queue` daily using `CRON_SECRET`;
the schedule remains compatible with Vercel Hobby. Manual retries stay
available from the dashboard, and a Pro deployment may safely increase the
worker frequency. The worker handles a bounded page and summary generation
remains idempotent.

## Deployment requirements

### Appointment release gate

The doctor-booked appointment module is implemented but not enabled by default.
Before setting `ENABLE_CONSULTATION_SCHEDULING=true`, deploy and verify the two
`appointments` composite indexes, inspect any existing appointment data for the
new schema, approve scheduling-contact retention and run signed-in staging tests
with separate doctor, patient and administrator identities. Direct client writes
to appointments/calendar locks remain denied. Test concurrent overlap, immutable
create retries after reschedule/cancel/start, stale versions, account switching
with delayed responses, timezone gaps/ambiguities and cancellation before release.
The local evidence is in `docs/testing/evidence/2026-11-27-appointments/`.

Booking does not issue invitations/media tokens or start a consultation or
transcription. There are no reminders, recurrence, self-booking or calendar sync.
Vercel deployment does not deploy Firebase indexes, rules or retention functions.

### Existing deployment requirements

- Configure `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (or the documented
  legacy webhook HMAC secret). Webhooks fail closed if verification is absent.
- Configure long random `RATE_LIMIT_HASH_SECRET` and
  `SECURITY_SIGNAL_HASH_SECRET` values in production.
  For backwards-compatible availability, request-signal hashing derives a
  domain-separated correlation subkey from the already-required
  `LIVEKIT_API_SECRET` when its dedicated secret is absent. Treat that as a
  deployment bridge, not the target configuration: a dedicated key supports
  independent rotation and keeps LiveKit signing-key rotation from changing
  correlation values.
- Set `SECURITY_SIGNAL_HASH_SECRET` before issuing hash-only allowlisted links.
  Changing that key makes existing hash-only allowlist matches fail safely into
  the waiting room, so rotate it only with an explicit active-link plan.
- Treat a secret shown in a screenshot, chat, terminal transcript, or public
  log as compromised. Rotate the affected Firebase service-account key,
  LiveKit secrets, webhook secret, OpenAI key, and any derived application
  secrets before using real patient data.
- Configure `CRON_SECRET` for the summary retry worker.
- Keep `ENABLE_FILE_ATTACHMENTS` and `ENABLE_CONSULTATION_SCHEDULING` unset until their documented security gates are complete.
- Do not restore the removed client-side `NotesPanel` uploader or create a public Storage namespace. The future attachment UI must use the session-scoped server flow in `docs/implementation-file-attachments.md`.
- Keep new attachment and appointment documents on the normalized boundaries
  in `docs/data-model-readiness.md`; neither feature is room-name-owned.
- Deploy Firestore indexes/TTL, Firestore Rules, and Storage Rules with the
  application release.
- Keep retention enforcement disabled until the thesis team approves the
  period and backup/deletion implications.

## Firestore free-tier budget (27 Nov 2026)

Production hit Spark's daily quota (50k reads / 20k writes). A read-only code
audit (no production data was read) ranked the recurring costs; each fix
below follows a standard pattern and is pinned by `tests/firestore-budget.test.mjs`.

| Cost driver | Pattern applied | Effect |
|---|---|---|
| Doctor queue refresh scanned every `waitingPatients` row the doctor ever had (every 15 s) | Bounded queries: room equality, or `status in` on the existing `(doctorUserId, status)` index for active reads | Reads scale with the current queue, not with history |
| 15 s queue poll while a live listener already reports every change | Event-driven invalidation + 60 s reconciliation poll (15 s only if the listener fails); skip the initial snapshot; no refresh in hidden tabs; stable listener (no rebuild on re-render) | About 4× fewer polls, and no duplicate first load |
| Audit trigger wrote 2 rows per write, including no-op and heartbeat merges | One `audit-logs` row per real change; bookkeeping-only updates (`updatedAt`, `lastMessageAt`, `transcription.*`, `audit.lastAccessed`) write nothing | At least half of the trigger writes removed; chat and transcript chunks add no audit writes |
| History loaded twice per visit, plus one messages query per consultation | Single history read; chat fetched per consultation when the clinician opens it (`?chatSessionId=`, ownership-checked) | N+1 removed from every dashboard visit |
| Guest admission check every 3 s (2 reads) | 4 s for the first 3 minutes, then 10 s; paused while hidden; back-off on 503 | Long waits cost about 3× less |
| LiveKit webhook spent 1 read + 1 write on a Firestore rate limiter before verifying the signature | Per-instance in-memory throttle; the signature check is the control | Webhook events cost no quota for throttling |
| Quota exhaustion turned into retry storms | 503 + Retry-After; shared access check; hidden tabs pause | Clients back off instead of hammering |

The Cloud Functions change ships only through the manual
`firebase-functions-deploy` workflow. Remaining known costs are deliberate:
transaction-safe invitation reservation, per-chunk transcript revision guards,
and Firestore-backed rate limits on chat, transcription and invitations, which
protect OpenAI spend and abuse limits. The Spark tier still suits a demo-scale
clinic. A clinic running all day should use the Blaze plan with a budget
alert, and that is an owner decision.
