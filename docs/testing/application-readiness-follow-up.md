# Application and RBAC readiness follow-up

17 November 2026, Asia/Singapore. Candidate follows commit `6df6ef7` on
`codex/security-remediation`. This completes the scoped implementation review,
not the outstanding clinical, usability or media-capacity experiments.

## Verified findings and disposition

| Finding | Implementation evidence | Disposition |
| --- | --- | --- |
| Dashboard history linking returned 401 | `PatientDashboard.handleAuthenticated` used plain fetch without Authorization; the route requires `consultation:link-own` and derives uid/email from its verified token | Fixed in candidate: use centralized authenticatedFetch; send only pending session ids. Server authorization was preserved, not weakened |
| Months-old rows reappeared in the live queue | `useWaitingQueue` accepted raw doctor-wide Firestore snapshots, bypassing API room, invitation-expiry and 24-hour activity filters; room scope was absent from that callback | Fixed in candidate: Firestore invalidates; API re-query supplies all rows. A shared periodic refresh remains active for time-based expiry and stream failure. Historical documents are not deleted |
| Admission shown as current media presence | Both queue panels labelled an admitted row as in-room time | Fixed labels: Admitted and admission age. These counts do not certify currently connected LiveKit participants |
| Optional transcription repeatedly failed | User-supplied DevTools showed chunk 502s; the bounded production runtime-log query returned 20 matching records reporting upstream OpenAI 429 | Candidate maps provider capacity refusal to 503, which stops optional uploads and announces that the call can continue. Provider rate/quota availability is an external blocker, not a claimed fix |
| Provider retry budget could reach three attempts | A transport retry followed by a retryable HTTP response caused an additional retry; each attempt could last 25 seconds, against a 60-second route budget | Fixed in candidate: at most two attempts; regression includes transport failure followed by 429 |
| Second patient browser replaced the first | Reused admission generates the same room participant identity. LiveKit documents one connection per identity per room; latest join replaces earlier connection | Expected transport policy, not evidence that Incognito is slower. The actual disconnect-reason enum was not recovered. Merely signing into a second browser does not by itself prove this cause |
| Replaced page could end the continuing visit | Both patient routes treated every disconnect as a leave; invitation cleanup marked the shared waiting row left and finalized the encounter | Fixed in candidate: duplicate-identity disconnection detaches the old page, suppresses leave/unload finalization, and explains the transfer; ordinary exits retain their existing path. Tested using the actual callbacks from both routes |

The 401 and 502 concern different HTTP endpoints. The 401 observed after return
to the dashboard does not prove that it caused the media disconnect. React
Server Component (`_rsc`) response serialization is normal navigation data,
not a database duplication error. A region-discovery list is not evidence of
the selected media server, RTT, or one-way audio/video latency.

## RBAC and AGENTS readiness boundaries

Private profile isolation and immutable role/identity/privilege fields remain
enforced by the already-released Firestore rules. The current masked recon
matches the repository rule source. The history-link route continues to use
the authenticated principal rather than trusting body userId/userEmail.
Doctor queue reads remain doctor-owned and room-scoped through the canonical
API. No new role, permission, faculty route or collection-wide reviewer access
was introduced. The existing reviewer policy remains assignment-only and
deny-by-default; it is backend preparation, not an implemented faculty product.

The read-only follow-up recon observed 203 invitations (82 stored active,
81 already expired by time), 150 waiting rows (68 admitted, 13 waiting,
55 left, 14 rejected), and 48 consultation-session records (47 completed,
one stored active). These are database lifecycle aggregates, not live connection
counts. They support a backward-compatible filtered read model, not destructive
cleanup. No patient names, addresses, transcripts or raw credentials are needed
in the evidence package.

Design alternatives considered: duplicate all expiry/room policy in the client,
or use realtime only to invalidate the server projection. The latter keeps the
policy in one deep module, follows AGENTS' invalidation/re-query vocabulary,
and avoids introducing a new synchronization layer. The React checklist was
applied to effect dependencies, shared listener/timer cleanup, deduplicated
requests and modeless feedback. Existing admission and consent policy is unchanged.

Attachments and scheduling remain disabled, with no shipped UI. They require
their separate session-ownership, upload/quarantine/download, retention,
timezone/conflict and reminder tests before enablement. Reviewer preparation
must not be treated as permission to expose clinical records to a faculty role.
Historical privileged accounts still need comparison with an approved roster;
blocking future profile escalation cannot establish whether earlier misuse occurred.

## Deployment blockers and uncompleted experiments

The existing PR's Vercel checks are blocked: the Git commit author is not a
member authorized for the Vercel team/project. The separate duplicate project's
previous nonexistent-root failure is a distinct recorded configuration issue.
This audit does not change account permissions, impersonate a different Git
author, merge the PR, or claim a production application release. Application
fixes require a successful authorized build/release and an authenticated retest.

Use a dedicated doctor profile and a separate patient profile for repeatable
manual tests. Incognito is suitable for a clean temporary session, but has no
demonstrated efficiency advantage. Do not join the same patient admission from
both simultaneously. Two browser clients on one PC are a functional smoke test,
not independent-device latency or simultaneous-consultation capacity evidence.

The labelled isolated test invitation was approved but has not been created by
the agent. User-operated calls in the existing room were observed/reported, but
no controlled getStats dataset, concurrency trial or clinician paired-time
study was collected. All three measurement outcomes remain NOT TESTED.

## Evidence and acceptance

See `evidence/2026-11-17-queue-retest/`: masked aggregate recon, current rules
snapshot, redacted observation summary, verification logs, audits and checksums.
The six focused tests exercise real modules with isolated IO adapters and
synthetic fixtures; source contracts pin dashboard and hook wiring. They do
not claim a successful authenticated production retest of the candidate.

## Sources

LiveKit participant identity uniqueness:
https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/

Chrome Incognito session behavior:
https://support.google.com/chrome/answer/95464?hl=en
