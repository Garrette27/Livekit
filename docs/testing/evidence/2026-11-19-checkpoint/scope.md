# Checkpoint reproduction and limits

Date: 19 November 2026, UTC+8. Base application: 1c7bace.
Verification ran in clean detached /tmp/livekit-audit-20261119, with installed
dependencies symlinked from the original checkout (not a clean npm ci).
The only application-test addition is three deterministic queue/outage cases.
No product behavior was modified; no production records were written.

Test source SHA-256:
7339c8fa89599fadb5ff12a87148b33fa646e7bcc97da186fce683aad09d6f7c

Queue source SHA-256:
01bc34194f2371ffd57fb9a5e909d2636680042e3fc39f4f1ee2e3bacc44bbb9

Availability classifier source SHA-256:
ee7b666684d76ae2a4edda58266816432cb1c0a41d1503c455dff91563491293

Command: THESIS_OUTPUT=/home/garre/Livekit/docs/testing/evidence/2026-11-19-checkpoint
node scripts/thesis/verify-remediation.mjs (Node 22.23.0).
The runner's legacy sourceState wording mentions a PR; this delivery uses direct
main commits, not a new PR. The runner base SHA plus the hashes above identify
the tested candidate. Results/checksums are in verification.json and sha256.json.

Efficiency budgets were asserted before observing results: 100 same-scope
consumers must issue one overlapping fetch; failed fetches must clear the cache;
different scopes must stay separate. 100 subscribers must have one timer and
one listener; hidden state must have zero timers; 100 visibility cycles and
cleanup must leave zero timers/listeners. These are deterministic operation
counts, not elapsed-time, WebRTC capacity or production billing measurements.

Firebase rules were retrieved read-only in the separate sibling directory
2026-11-19-rules-read. No collection documents were fetched (rules-only mode).
Active rules differ from the merged candidate and still allow client
consultation create/owner-write. Passing candidate emulator tests do not close
this deployment finding. Storage rule retrieval was blocked.

Vercel direct inspection failed with team-scope 403; authorization returned
team-not-found, and list_teams returned no teams. GitHub reports frontend status
success for 1c7bace, but this is not direct live commit/rules acceptance.
Do not access unrelated plugins or account data to bypass that limitation.
