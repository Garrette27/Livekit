# TeleConsole thesis verification brief

18 November 2026 | Asia/Singapore

Production baseline: `80c7e8155d4400ffc7fbd503fabd784c41043244`. Remediation tested locally: `08bd5bb` on `codex/thesis-login-performance` (earlier run: `f934a64`). The live Vercel alias was verified against the production baseline. Vercel blocked both branch previews at its project collaboration gate.

## Doctor sign-in incident

The browser capture showed Firebase Google identity sign-in returning HTTP 200, followed by HTTP 500 from the application's role-conflict endpoint. Vercel recorded eight module-loading failures on the preceding deployment at `29076d9`: `jwks-rsa` could not load the ES module build of `jose`. The live baseline scopes a CommonJS-compatible `jose` override to that dependency. The current doctor login page returned HTTP 200 and a request without a session to the role endpoint returned the expected HTTP 401 with `missing_token`. This confirms that the current handler starts. The subsequent signed-in retry still failed. Three runtime records from 13:39:36 to 13:40:11 Singapore time show Firestore returning RESOURCE_EXHAUSTED (code 8) after successful identity verification. The captured route failures on the current build were attributed to exhausted quota. Cloud Billing confirmed that billing was disabled for the affected project. Successful sign-in after quota recovery has yet to be verified.

The branch keeps role verification mandatory. Firestore quota, timeout, or service unavailability during role lookup now returns HTTP 503 with a retry message. The application keeps the user's email bound to the verified Firebase identity and includes a regression for a mismatched email and an unavailable lookup.

## Changes and repository policy review

The recent admission changes recheck the reserved visit and persisted invitation before issuing a consultation token. The waiting token disables media and data access. The changes follow the server-side admission and focused-regression requirements in `AGENTS.md` for the reviewed paths. The existing documentation and evidence also identify the live tests that remain open.

The branch shares one server-side filter for recent queue entries and reads only the distinct invitations they reference. The query checks invitation owner, room, lifecycle status, expiry, and row age. The browser listener watches the owner's waiting and admitted rows. The existing API refresh still handles legacy status values. Local fixtures verify that an empty queue needs no invitation fetch, several candidates can share a single invitation read, and an unrelated doctor's invitation is excluded. No production read-savings percentage was measured. The field-limited production audit counted 152 rows: 13 waiting, 68 admitted, 57 left, and 14 rejected. Deployed Firestore rules matched the repository. Deployed Storage rules could not be retrieved, so the Storage result in this brief applies to the emulator.

The browser regression also identified a blank direct patient-room page while waiting for hydration. The page now resolves the route parameter during render, and the existing secure-invitation guidance is available in the initial HTML. The test checks it with JavaScript disabled.

## Follow-up changes (afternoon, 18 November)

Three further changes were made while production Firestore was quota-limited, each with a focused regression:

1. **Background polling pause.** A hidden doctor tab no longer polls the waiting queue (Page Visibility API). Returning to the tab triggers one reconciling refresh. Live queue events and clinician actions still refresh immediately. This directly targets the read volume behind the quota incident.
2. **No account-existence disclosure.** Invitation creation no longer looks up whether the invitee's email has an account or reports it to the caller. This removes an account-enumeration signal and one Firestore read per invitation.
3. **CI gate isolation.** The dependency audit now runs as its own CI job, so the unpatched development-tooling advisory still fails visibly but no longer hides the test, lint and build results.

The design rationale for these and the existing security patterns, plus a compliance check against `AGENTS.md`, is in `docs/design-pattern-review-2026-11-18.md`.

## Observed results

| Check | Status | Evidence |
| --- | --- | --- |
| Local application checks | PASS | Typecheck, lint, production build, 27 application tests and the security/thesis-flow contract scripts on `08bd5bb`. |
| Firebase rule checks | PASS in emulator | Eight Firestore/Storage tests, including owner access and denial of a cross-doctor live queue query. |
| Browser and HTTP regression | PASS locally | All 29 mobile Chromium tests passed, including the missing-invitation guidance with JavaScript disabled. The pre-fix run passed 28 of 29. |
| Dependency gate | FAIL, full inventory | Production app and Functions audits: 0 findings. Full app audit: 13 high entries tied to a single development-tooling advisory, GHSA-fc5q-39xc-vjpf. No patched release was available. The audit now runs as a separate CI job, so the application job reports its own result. |
| Landing page HTTP pilot | PASS | n=10, median 50.5 ms, p95 304 ms. All ten returned HTTP 200. |
| Invalid-invitation help pilot | PASS | n=10, median 71 ms, p95 1,239 ms. All ten returned HTTP 200. |

The pilot used sequential requests from Windows Subsystem for Linux with 250 ms between requests and measured from request start through the full response body. The criterion was p95 at or below 3,000 ms and ten successful responses per page. Nearest-rank p95 equals the maximum at this sample size. Results come from a single network and include CDN responses. Raw timings, sanitized login events, and the queue aggregate are stored under docs/testing/evidence/2026-11-18-thesis-verification.

## Evidence still needed for the thesis

Run the successful doctor login, legitimate invitations and the remaining account-ownership cases with synthetic accounts on isolated staging. Capture authenticated endpoint timings, admission until both clients receive media, two-way media transport, and the planned concurrent call levels. The published performance protocol also defines separate AI documentation and usability work. Keep results pending until the respective trials run. This brief supports the technical results section of the thesis. The overall security and consultation-performance gates remain open. Production sign-in after the daily quota reset (about 16:00 Singapore time) also needs to be re-checked and recorded.

Technical references: repository performance assessment and remaining experiments, GitHub Actions run 44213350665, Firebase Firestore usage and limits documentation, and GitHub Advisory GHSA-fc5q-39xc-vjpf.
