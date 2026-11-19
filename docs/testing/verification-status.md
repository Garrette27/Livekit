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
| Application authorization/identity regressions | HISTORICAL PASS, 43 | `evidence/2026-11-19-remediation/security.log`; synthetic adapters |
| Firestore/Storage candidate rules | HISTORICAL PASS, 12 | Same directory, `rules-green.log`; emulator only |
| Original consultation-write attacks denied | HISTORICAL PASS, 2 | Same directory, `supplemental-green.json`; not production writes |
| Mobile Chromium workflow | HISTORICAL PASS, 29 | Same directory, `e2e-summary.json`; mocked waiting APIs |
| Production dependencies | HISTORICAL PASS, zero | Same directory, production audit JSONs; not full dev inventory |
| Full dependency inventory | FAIL at preceding scan | Unpatched picomatch advisory; fresh scan required |
| Latest application deployment | NOT VERIFIED in this checkpoint | Git merge does not establish deployed commit |
| Latest Firestore rules deployment | NOT VERIFIED | PR #8 report explicitly leaves coordinated release pending |
| Queue request/timer efficiency | Targeted local retest pending | Shared-request and visibility controls; no cloud savings percentage |
| Database outage classification | Targeted local retest pending | Retryable availability errors must not include permission failures |
| Public HTTP pilot | HISTORICAL PASS, n=10/page | 18 Nov pilot; not authenticated or media latency |
| Media latency / concurrent calls | NOT TESTED | Requires synthetic paired media clients and isolated staging |
| Clinician documentation efficiency | NOT TESTED | Reviewer study required; no paid AI requests authorized |

Pattern: an append-only evidence history with a single current-status projection.
It avoids rewriting failed baselines or duplicating mutable PASS claims across
reports. This ledger is evidence navigation, not a certification score.

Next unfinished task: run the local efficiency/outage checks, refresh safe
production deployment metadata, and publish the resulting evidence checkpoint.
