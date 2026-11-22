# Security and performance verification ledger

## Required checkpoint workflow

This is the current status index; dated reports are immutable historical evidence.
For every security/performance change or retest:

- [ ] Fetch remote state and preserve unrelated local edits before updating.
- [ ] Read AGENTS.md and relevant product/design contracts; state the tested SHA.
- [ ] Define the claim, threshold, environment and scope before running the test.
- [ ] Retain failed results as well as passes in a new dated evidence directory.
- [ ] Record command, exit code, counts, limitations and evidence checksums.
- [ ] Update this ledger and link the dated report when a result changes.
- [ ] For behavior changes run focused regressions, security tests, lint,
  typecheck and build; run Next.js tasks sequentially to avoid .next collisions.
- [ ] Review staged changes for secrets, patient data and unrelated files.
- [ ] Commit and push the code AND its updated status/docs/evidence at each
  coherent verified checkpoint, not only at the end of a long session.
- [ ] Confirm remote commit/CI. Distinguish a pushed commit, deployed application,
  deployed rules, and successful authenticated production acceptance.
- [ ] Record the next unfinished task so an interrupted audit resumes accurately.

Never mark a test passed by relaxing an assertion, hiding a failing audit, or
substituting HTTP timing for WebRTC timing. Use PASS, FAIL, BLOCKED, NOT TESTED,
or HISTORICAL PASS, always with scope. New advisories can invalidate old scans.

## Defense-readiness checkpoint: 22 November 2026 (defense on 23 November 2026)

The thesis defense is tomorrow, 23 November 2026. This checkpoint is a
pre-defense hardening pass over a93d635 (latest remote main at fetch time).
Rules for this pass, in priority order:

1. Do not break the working doctor/patient call. No risky refactors, no new
   features, no dependency majors, no production data writes or rule releases
   without separate review.
2. Follow AGENTS.md: fix only confirmed defects with a focused regression that
   fails first; keep established patterns (server-side policy boundary, scoped
   bearer invitations, atomic reservation, shared quota/outage classification).
3. Run the full gate (security/regression tests, rules emulator suite where
   available, typecheck, lint, build, dependency audits) and push each verified
   checkpoint to main immediately, so an interrupted session still leaves a
   defensible, deployed state.
4. Report honestly: PASS / FAIL / BLOCKED / NOT TESTED with scope. Never claim
   HIPAA compliance, certification, WebRTC capacity or clinical accuracy.

Progress for this pass is recorded in
[defense-readiness-2026-11-22.md](defense-readiness-2026-11-22.md).

## Previous checkpoint: 22 November 2026

Remote fetched at 16df312; no newer commits were available. See
[follow-up report](follow-up-2026-11-22.md) for current data, reproduced bugs,
design tradeoffs and limits. Local unrelated AGENTS.md edits remain preserved.

| Claim | Current result | Evidence / limits |
| --- | --- | --- |
| Application authorization and efficiency regressions | PASS, 48 | `evidence/2026-11-22-retest/policy.log`; includes reviewer malformed/blank denial and stale poll cleanup regressions |
| Remote CI / frontend status for bee1843 | PASS | Quality and security run 44977057053: application, firebase-functions and application-dependency-audit all success; GitHub frontend deployment status success, not a live authenticated acceptance test |
| Firestore/Storage repository rule suite | PASS, 12 | Same directory, `rules.log`; synthetic emulators |
| Typecheck, lint, production build | PASS | Same directory; pre-existing sanitizedEmail warning remains |
| Full application and Functions audits | PASS, zero returned findings | Same directory audit JSONs; time-bound advisory result |
| Read-only current Firestore recon | PASS, bounded masked read completed | `evidence/2026-11-22-recon/`; 208 invitations, 156 waiting rows, 55 completed sessions; no clinical content copied |
| Active Firestore source | PASS, matches repository | Recon result; no rules release needed |
| Queue lifecycle efficiency | PASS, deterministic count budget | Stale repeated unsubscribe no longer creates a second timer/listener; no cloud billing or media capacity inference |
| Reserved reviewer assignment policy | PASS, focused regression | Blank IDs and malformed fields/dates deny; faculty remains backend-only, not enabled |
| Current authenticated production / media / capacity / clinician efficiency | NOT TESTED | Existing protocols still required; no paid AI, media capture or cloud load performed |
| Direct Vercel commit and active Storage policy | NOT VERIFIED in this checkpoint | Prior team-scope and Storage-read restrictions remain; local passes do not imply live acceptance |

Next: authenticated synthetic acceptance
and controlled paired media trials remain separate. Never reuse old invitation
links from screenshots: every stored-active link was expired at the recon read.

## Historical checkpoint: 19 November 2026

Pulled `1c7bace` (PR #8). Working-tree AGENTS.md edits were preserved, not
published. Clean detached verification worktree: `/tmp/livekit-audit-20261119`.
Latest reviewed report: [consultation integrity remediation](consultation-integrity-remediation-2026-11-19.md).

| Claim | Status entering this checkpoint | Evidence / limits |
| --- | --- | --- |
| Application authorization/identity regressions | PASS, 46 | `evidence/2026-11-19-checkpoint/policy.log`; actual services with synthetic adapters; three new efficiency/outage cases |
| Firestore/Storage candidate rules | PASS, 12 | `evidence/2026-11-19-checkpoint/rules.log`; emulator only |
| Original consultation-write attacks denied | HISTORICAL PASS, 2 | Same directory, `supplemental-green.json`; not production writes |
| Mobile Chromium workflow | HISTORICAL PASS, 29 | Same directory, `e2e-summary.json`; mocked waiting APIs |
| Full application and Functions dependency inventories | PASS, zero findings returned today | Fresh full audit JSONs in checkpoint directory; prior failing scans preserved; no claim of advisory remediation by code changes |
| Typecheck, lint, production build | PASS | Checkpoint logs; lint retains the existing sanitizedEmail warning |
| Latest application deployment | BLOCKED direct metadata verification | Vercel team scope unavailable; GitHub frontend status success for 1c7bace is only indirect evidence |
| Latest Firestore rules deployment | PASS, reviewed source deployed and retrieved | `evidence/2026-11-19-rules-release/`; source matches merged policy; 12 equivalent-source emulator cases pass; original drift evidence preserved |
| Production anonymous API denial controls | PASS, 4/4 | Release acceptance.json: doctor access, role conflict, patient history and queue list return JSON 401; no authenticated journey claim |
| Remote CI for add9a04 | PASS | Quality and security completed successfully before rules release |
| Queue request/timer efficiency | PASS, deterministic local budgets | 100 consumers share one fetch/timer, isolated scopes, failed-fetch recovery, 100 visibility cycles and zero cleanup leaks; no cloud savings percentage |
| Database outage classification | PASS, targeted matrix | Availability codes recognized; permission/authentication/message-only errors do not become retryable outages |
| Public HTTP pilot | HISTORICAL PASS, n=10/page | 18 Nov pilot; not authenticated or media latency |
| Media latency / concurrent calls | NOT TESTED | Requires synthetic paired media clients and isolated staging |
| Clinician documentation efficiency | NOT TESTED | Reviewer study required; no paid AI requests authorized |

Pattern: an append-only evidence history with a single current-status projection.
It avoids rewriting failed baselines or duplicating mutable PASS claims across
reports. This ledger is evidence navigation, not a certification score.

Authorized follow-up: the owner approved deployment; Firestore rules only were
released to livekit-5eef6 on 19 November. No data migration, Storage policy or
Functions release occurred. See [release acceptance](rules-release-2026-11-19.md).
Next unfinished task: restore Vercel team access for direct application commit
inspection and run a synthetic authenticated doctor/patient journey. Media,
capacity and clinician-review trials remain separate. No paid AI, cloud load or
patient-data writes were performed. Local unrelated AGENTS.md edits are preserved.

Reproduction and source hashes: `evidence/2026-11-19-checkpoint/scope.md`.
No new mobile E2E claim is made: the 29-case result above is historical.
