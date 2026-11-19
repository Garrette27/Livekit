# Local consultation-integrity remediation evidence

Branch codex/consultation-integrity-fix, base 0be08989759dbbe6aaef53c02444aa0121cb4baf. This is candidate verification, not a production release. The earlier reassessment's failed baseline remains under its own run directory in the original checkout and share pack.

## Evidence meaning

- rules-red.log: 9 passed, 3 failed. The new create/update/delete expected-denial cases exposed the original unsafe writes; legacy/current read compatibility already passed.
- rules-green.log: all 12 maintained emulator rule tests passed, including isolated metadata ownership/read branches.
- supplemental-green.json/log: the original two attack reproductions now deny their writes under candidate rules.
- linking-red.log: three regressions exposed pending-ID reassignment, invitation-based visibility and malformed legacy request handling.
- history-red.log: email-only history and clinician/queue privacy regressions failed before the projection fix.
- identity-red.log: signed UID/admission/tracking binding regressions failed before adding the claim.
- tracking-red.log and race-red.log: delayed leave and cross-encounter finalization failures reproduced before their fixes.
- finalization-red.log: a non-shortcut finalization test reproduced unconditional newer-room overwrite. Its corrected positive-control fixture includes the complete waiting-history shape.
- direct-binding-mutation.log: removing direct issuance's UID binding made its focused regression fail; the candidate was restored before the passing suite.
- security.log, typecheck.log, lint.log, build.log: final application verification. Lint exits zero with the recorded pre-existing unused-variable warning.
- e2e-summary.json: sanitized final mobile Chromium run; no raw configuration, environment variables, trace or browser storage retained.
- consultation-shapes.json and history-shapes.json: bounded, field-masked production aggregate/type audits only. Generic missing expiry/consent counters do not apply to every collection and are not additional findings.
- production-firestore-rules-before.json: active source retrieved read-only. candidate-firestore-rules.json: local fix, not a claim of deployment.
- *-production-audit.json: fresh production-only application and Functions package audits.
- review.json: independent source-review outcome and limits.
- verification.json and sha256.json: final source/check manifest and file checksums.

## Reproduction

Use Node 22. Run npm ci at the repository root and npm ci --prefix functions for a clean reproduction. This run reused the existing application dependency installation through an ignored symlink and installed Functions dependencies cleanly. No lockfiles changed.

Run npm run test:security, npm run lint, npm run build and npm run typecheck. Run build, browser tests and typecheck sequentially: Next.js dev/build share .next and can remove generated type files while a parallel tsc enumerates them. An intermediate parallel run hit this runner collision; the final sequential typecheck passed. It was not treated as an application defect.

Run Firebase CLI 15.36.0 emulators:exec --only firestore,storage --project demo-livekit-security with the repository firebase.json and invoke npm --prefix functions run test:rules. The tests use only synthetic emulator identities and marker records. No attack test should target production.

For the mobile run, use npm run test:e2e:mobile with the installed compatible Chromium executable. This environment selected Chromium 148 through a temporary Playwright config and a local Next.js E2E server at port 3474. Waiting-room cases mock API responses; passing them does not demonstrate actual Firebase/LiveKit connectivity or performance.

Production audits used the existing authorized Firebase session through the official Firebase MCP, with masks limited to identity-field types/statuses. No IDs, field values or clinical content were retained. No production database writes, migration, app deployment or rules deployment occurred.

## Release scope

The candidate requires both the Next.js application release and Firebase Firestore rules publication. Applying only one leaves part of the identified boundary unremediated. Keep the original rules source as a rollback reference, retrieve the deployed source after publication, compare normalized hashes and run approved synthetic positive and negative production controls. Never label the whole system secure from this limited suite. Media quality and capacity remain untested.
