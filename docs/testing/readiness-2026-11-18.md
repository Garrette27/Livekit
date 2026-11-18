# Admission and production runtime follow-up - 18 November 2026

## Last completed step and scope

PR #7 was merged by the owner as `29076d9`. Vercel production was confirmed
READY at that exact commit. The prior profile-rule remediation remains intact;
the user-owned AGENTS.md edits and historical records were not changed.
Faculty reviewer access stays backend-only, assignment-scoped and denied by
default. Attachments and scheduling remain disabled. No OpenAI request was made.

## Findings verified against implementation

- Admission polling accepted an omitted waiting-entry ID and could select a
  different admitted visit by caller-supplied email. The route now requires the
  exact credential-bound entry. No email lookup fallback remains.
- Polling and doctor admission did not re-read persisted invitation authority.
  Both now read the visit and invitation transactionally and reject revoked,
  expired, missing, wrong-room and wrong-owner records before issuing tokens.
  Reconnects reuse the reserved visit; admission does not consume another use.
- Waiting tokens previously allowed media and data exchange in a shared waiting
  room. Initial and reconnect waiting grants now disable publish, subscribe and
  data publication. Consultation media grants remain enabled.
- A failed Firebase refresh silently became guest validation, and obsolete
  validation/poll responses could overwrite current state. Signed-in refresh
  failures now show retryable failure; obsolete results are discarded. Polling
  has one request in flight and cancels on cleanup.
- Production logs on 18 November identified `ERR_REQUIRE_ESM` in
  `jwks-rsa/src/utils.js` requiring `jose` 6, before API handlers could run.
  A narrowly scoped override uses CommonJS-compatible jose 5.10.0 for jwks-rsa
  only. LiveKit retains its own jose versions. A child-process regression runs
  Firebase Auth with experimental require-module support disabled.

## Verification and residual findings

The admission candidate passed 24 application/policy tests, typecheck, lint,
production build and seven repository Firebase rules cases. A further startup
regression is included with the runtime fix; final logs identify the exact
tested source hashes. Evidence lives in `evidence/2026-11-18-admission/`.

A fresh full application audit reports 13 high package entries derived from
one picomatch ReDoS advisory, GHSA-fc5q-39xc-vjpf (affected through 4.0.7).
The registry's latest version is 4.0.7 and the advisory lists no patched version.
These entries are in development tooling; the production-only application audit
and complete Functions audit report zero findings. Do not repeat the older
zero-full-inventory claim as a current result. Do not downgrade Next.js or hide
the CI audit failure to obtain a green badge. Track the upstream fix.

Sources: https://github.com/advisories/GHSA-fc5q-39xc-vjpf and
https://github.com/auth0/node-jwks-rsa/releases (4.0.0 moved to jose 6).

## Thesis wording and measurement limits

Chapter III: Authorization evaluation exercised the real admission service and
HTTP boundary with synthetic credentials and transaction adapters, including
negative and positive admission cases. Race tests executed the page's actual
effect callbacks. A runtime startup test supplemented build-time validation.

Chapter IV: Additional admission authorization defects were identified and
remediated. Production startup failed despite a successful build, demonstrating
why deployment/runtime checks are a separate evidence requirement. Dependency
results are time-bound: a later advisory introduced an unresolved development
tooling finding after the previous zero-finding snapshot.

The supplied WebRTC page excerpt selects a chatgpt.com peer in state `new`, not
a connected LiveKit media stream. It provides no usable call RTT/jitter/loss
dataset. Do not inspect or record unrelated ChatGPT peers. Audio and DataChannel
recordings are unnecessary and remain off. Only redacted numeric LiveKit stream
metrics should enter thesis evidence; raw dumps can include URLs, tokens and
network identifiers. No dump has been downloaded by this audit.

Media latency, concurrent-call capacity and clinician documentation efficiency
remain NOT TESTED. Existing controlled protocols still apply; one PC and two
accounts cannot establish independent-device or five-call capacity results.
AI efficiency trials remain excluded at the owner's request. The prototype is
not certified for clinical use and this audit cannot guarantee thesis approval.
