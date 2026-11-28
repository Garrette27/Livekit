# 19 November 2026 reassessment evidence

Code: main at 0be08989759dbbe6aaef53c02444aa0121cb4baf. All timestamps inside JSON use UTC; the reports use UTC+8. This directory preserves passing and failing results. It contains no production patient documents, browser sessions or credentials.

## Inventory

| Artifact | Meaning |
| --- | --- |
| verification.json | Verdicts, environment, command exit codes and source hashes |
| security.log, typecheck.log, lint.log, build.log | Fresh npm run test:security, typecheck, lint and build outputs |
| rules.log | Eight existing Firestore/Storage rule cases, Firebase emulator, exit zero |
| supplemental-rules.json and supplemental-rules.log | Two consultation-integrity denials expected but writes allowed; runner exit 1 |
| supplemental-rules.cjs | Captured synthetic reproduction; local paths identify the original runner |
| deployed-firestore-rules.json | Active Firestore source retrieved through authenticated Firebase MCP |
| rules-review.json | Focused source review against the Firebase auditor checklist; score is not certification |
| firestore-aggregates.json | Field-masked, bounded production aggregate; no document IDs/content |
| e2e-summary.json | 29 local mobile Chromium cases; raw environment-bearing reporter output excluded |
| live-probes.json and live-probes.mjs | 20 production anonymous API denials, unsigned webhook denial, and 10-request timing pilot per public page |
| browser-public.json | Eight production public-page navigations; isolated Chromium, no saved login |
| deployment-verified.json | Selected safe fields from authenticated Vercel deployment inspection |
| github-ci.json and github-deployment.json | Earlier CI job conclusions and frontend deployment status, retrieved today |
| *-audit.json | Application/Functions production and complete lockfile or installed-package audit results |
| sha256.json | SHA-256 manifest for the other files in this directory; not an independently signed timestamp |

## Commands and boundaries

The local quality gates were npm run test:security, npm run typecheck, npm run lint, and npm run build, on Node 22.22.2. Functions dependencies were installed with npm ci --prefix functions. Audits ran with npm audit --omit=dev --package-lock-only --json and npm audit --package-lock-only --json for both manifests, plus npm audit --audit-level=high --json against each installed inventory. Both manifests and lockfiles matched HEAD.

The rules suite used Firebase CLI 15.36.0, Java 21, and emulators:exec --only firestore,storage --project demo-livekit-security, invoking npm --prefix functions run test:rules. A temporary Firebase config referenced the repository's reviewed rule files. The retrieved active Firestore source matched those rules after removing CR characters and trimming outer whitespace.

The supplemental runner used the Firestore emulator only, the retrieved source, synthetic identities and nonclinical marker records. It intentionally exits nonzero when an unauthorized operation is accepted. To reproduce on another machine, adapt the captured script's dependency, rules and output paths, keep projectId demo-livekit-security, and run through emulators:exec --only firestore. Never point its adversarial writes at production. This captured reproduction has not yet been integrated into the maintained regression suite.

Playwright used the existing mobile-chromium tests and NEXT_PUBLIC_E2E_MODE=1 on a local Next.js development server at port 3473. A temporary config selected the already installed Chromium 148 executable. Invitation lifecycle API responses are mocked by the existing cases. No real media call or production account sign-in is established by that suite.

The aggregate audit ran scripts/thesis/firebase-recon.mjs with THESIS_OUTPUT pointing to a new temporary evidence directory. It used the authorized Firebase CLI session and the official Firebase MCP. Only status, summaryStatus, expiresAt and consentVersion were projected. Serialized-rule hash and normalized-source hash use different inputs. Collections were read sequentially, so counts are not an atomic database snapshot. Missing generic fields that do not apply to a collection are not findings.

Production API probes had no identity/room credentials. Only syntactically valid synthetic identifiers were supplied where required before authentication. Password-reset email sending was not probed in production. Public GETs were sequential, spaced by 250 ms, and used a 3,000 ms full-body p95 budget. They measure cached HTTP responses from one network, not authenticated or audiovisual performance.

Vercel setup followed https://vercel.com/get-started.md. CLI 66.2.0 authenticated as the project owner; the official global MCP entry is https://mcp.vercel.com and completed OAuth. Existing Vercel guidance was already enabled. CLI deployment inspection verified the active alias and commit without deploying. The older app connector's team scope was not used to claim access to the owner's project.

## Privacy exclusions

The original screenshots, raw Chrome state, raw Vercel responses, CLI authentication files, login codes, environment files, raw Playwright reporter configuration and browser traces are excluded. The JSON browser summary records booleans and numeric timings only. User profile/email fields, transcript text, clinical notes and raw invitation tokens were not requested by the aggregate audit.
