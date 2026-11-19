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

## Checkpoint: 19 November 2026

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
