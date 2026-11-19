# TeleConsole thesis testing package

Current results and mandatory commit/push checklist:
[Verification status ledger](verification-status.md). Read it before interpreting
the historical assessment below as today's acceptance status.

Assessment date: 17 November 2026, Asia/Singapore. Code baseline:
`fa5a33cca4b341513dae6d78538f4eeede26a92b`.

Start with [Security assessment](security-assessment.md), then read
[Performance assessment](performance-assessment.md). Use
[Remaining experiments and defense guide](remaining-experiments.md) to complete
the authenticated and real video tests before submitting final Chapter IV results.

The original security assessment FAILS its deployment authorization criterion.
The subsequent [remediation report](remediation-report.md) records the deployed
fix and successful focused retests; read it for the current disposition.
The HTTP performance pilot meets its limited response-time target. Overall
consultation performance remains NOT TESTED. These are different conclusions.

The [application/RBAC follow-up](application-readiness-follow-up.md) documents
the subsequently reported queue, history-linking and transcription failures,
candidate fixes, browser-session interpretation and deployment blockers.

The package contains measured evidence, reproducible scripts, proposed acceptance
criteria, and failures. It is suitable as technical supporting material, subject
to the authors checking their manuscript and adviser requirements. It is not an
independent audit certificate or an assertion of full OWASP compliance.

## Evidence and repeatability

Evidence is in `evidence/2026-11-17/`. `assessment.json` contains all HTTP trials,
test exit codes, machine details, and the committed-lock dependency findings.
`auth-retest.json` preserves the correction to two malformed original probes.
`rules.log` records repository-rule tests and synthetic tests of the retrieved
production Firestore rules. `firestore-aggregates.json` contains current counts
and masked lifecycle distributions. No clinical text or account identifiers are
needed to reproduce the findings.

Run from the repository root under Node 20 or newer:

```bash
node scripts/thesis/run-assessment.mjs
node scripts/thesis/retest-auth.mjs
npx -y firebase-tools@latest login
node scripts/thesis/firebase-recon.mjs
node scripts/thesis/record-rules.mjs
```

The last command is expected to fail while the recorded deployment remains
vulnerable and the existing Storage test expects disabled uploads. All writes
in rules testing target `demo-livekit-security` emulators. The HTTP script sends
only missing-credential requests and public page reads; application rate-limit
counters and provider logs may be updated by those requests.

For a new run, set `THESIS_OUTPUT` for the HTTP runner and update the fixed
evidence paths in the recon, retest, and rules scripts together. Preserve this
dated baseline; do not overwrite it when documenting a remediation retest.
Firebase MCP and its emulator binaries were resolved through Firebase CLI
15.36.0 during this run. Pin the same CLI version for an exact replay; future
CLI or advisory databases may produce different findings.

## Research context reviewed

The accessible ChatGPT conversations reviewed were *Capstone Review and
Objectives Reduction*, *Redefine Testing Documents*, *Security Performance Testing
Docs*, and *Repository Understanding Check*. Their messages were background
material, not test evidence. The accessible history listing did not expose all
older conversations shown in the screenshot. Earlier sandbox download links and
the full uploaded Chapters 1–3 were not available as source documents in this
task. The authors should reconcile this package with their current manuscript.

The latest objective revision separates (1) security and reliability,
(2) AI documentation and efficiency, and (3) usability and accessibility.
Technical latency tests address objective 2 and part of objective 1; participant
usability tasks are still needed for objective 3. Prepared faculty RBAC,
attachments, and scheduling are excluded from claims of implemented features.
