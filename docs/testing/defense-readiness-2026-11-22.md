# Defense-readiness pass - 22 November 2026

**The thesis defense is on 23 November 2026.** This pass hardened a93d635
without changing the doctor/patient journey that already worked. It followed
the AGENTS.md completion gate and the checkpoint workflow in
[verification-status.md](verification-status.md). Every checkpoint was pushed
to main as soon as it was verified.

## Commits in this pass

| Commit | What | Gate |
| --- | --- | --- |
| 3e722ae | Defense date and rules for this pass recorded | docs only; CI success |
| c8f0b2c | Baseline gate on a93d635; unused variable removed (lint now 0 warnings) | 48/48 tests, 12/12 rules, typecheck, lint, build, 0/0 audit findings; CI success; deployed |
| aad4136 | Seven security fixes (table below) | 51/51 tests, 13/13 rules, typecheck, lint, build; CI success; deployed |
| 0504747 | Input bounds for invitations and summary edits | 52/52 tests, typecheck, lint, build |

## Findings and fixes

A read-only review covered all 29 API routes, middleware, Firestore/Storage
rules and headers. Only confirmed defects were fixed. Each fix has a regression
that fails on the previous source
(`evidence/2026-11-22-defense/red-phase.json`).

| # | Severity | Defect | Fix (pattern) |
| --- | --- | --- | --- |
| 1 | Medium | Any signed-in account, including a patient, could create `rooms/{name}` from the browser. The server treats that document as proof that a doctor owns the room, so a patient could block a doctor's room name. | Rules: only a clinician (trusted claim or server-provisioned profile) may create `rooms`/`calls` documents. Emulator test covers patient, profile-less and doctor cases. **Repository only until the rules are released (see below).** |
| 2 | Medium | A doctor could claim `<otherRoom>-waiting` and get a publish/subscribe token for another doctor's waiting room, seeing queued patients' names. | Pure policy `lib/rooms/room-name-policy.ts` enforced in `DoctorRoomAccess`, the single module both the claim and join paths use. `doctorName` is now bounded before it goes into the JWT. |
| 3 | Low-Med | `invite/revoke`, `track-consultation` and `session-chat/messages` returned raw internal error text (for example Firestore path errors). | They now use the shared `unexpectedErrorResponse` helper: a generic 500, or a 503 retry message for quota/outage. |
| 4 | Low-Med | `pending-waiting-room` matched waiting entries by the caller's email without checking `email_verified`. An unverified account registered under a patient's typed email could receive a fresh link for that patient's queue entry. The doctor's admission was still required. | `email_verified` is now carried through `authenticateBearerToken`, and lookup uses `verifiedLookupEmail` (fail closed, as AGENTS.md requires). |
| 5 | Low | The cron secret was compared with `===`, which is not constant-time. | Uses the shared `bearerSecretMatches` helper (SHA-256 + `timingSafeEqual`), the same one the admin secret uses. |
| 6 | Low | Chat text had no length limit. The browser's fallback chat key (`sender:time:text`) was used directly as a document ID, so a message containing `/` (for example "take 1/2 tablet") failed to save. | 4000-character limit. Unsafe keys map to a stable SHA-256 ID, so duplicate sends are still recognised and message text never ends up in a document path. |
| 7 | Low | Invitation allowlist size, `doctorName` and summary-edit fields were unbounded or untyped, and summary edit history grew without limit. | 50-email limit, 200-character name, typed and bounded summary-edit validator, and the 50 most recent edit-history entries kept. |

Not changed (documented limits):

- `script-src 'unsafe-inline'` remains in the CSP. Removing it needs nonce
  plumbing through Next.js, which is too risky the night before a defense.
- The rate-limit key uses the first `X-Forwarded-For` value. This is safe on
  Vercel, which overwrites that header, but not behind other proxies.
- The room pages load about 500 kB of JavaScript, mostly the LiveKit SDK.
  Splitting it is a refactor, not a fix.

## Production state after this pass

- Frontend: aad4136 deployed successfully (GitHub deployment status). Smoke
  probe: `/`, `/doctor/login` and `/patient/login` returned 200 in under 1 s.
  Unauthenticated `doctor-access` and wrong-secret `process-queue` returned
  401. HSTS, CSP, `X-Frame-Options: DENY` and a camera/microphone-self
  Permissions-Policy were present. This was a status-code probe only, not an
  authenticated consultation.
- Firestore rules: fix #1 is **not yet released**. Rules are deployed only by
  the manual `Firebase Functions Deploy` workflow. Until that release, fixes
  #2 to #7 are live and the room-name squatting gap still exists in
  production.

## Verification status

| Claim | Result |
| --- | --- |
| Policy, regression and source-contract tests | PASS, 52 |
| Firestore/Storage rules emulator suite | PASS, 13 (synthetic emulator) |
| Typecheck, lint (0 warnings), production build | PASS |
| npm audit (application and Functions) | PASS, 0 findings at time of run |
| Remote CI for aad4136 | PASS |
| Authenticated end-to-end consultation, media quality, load capacity | NOT TESTED in this pass |

Environment: WSL2 Ubuntu, Node 20.20.2 (the project declares 22.x; CI uses
22). Clean worktree from origin/main with installed dependencies symlinked,
not a fresh `npm ci`.

## Defense talking points for this pass

- "We review against the same rule as the design: the UI is never the
  boundary." Fixes #1 and #2 close two cases where a stored room name acted as
  authority. One is closed in the database rules and the other in the single
  room-access module.
- "An invitation link is a capability, not an identity." Fix #4 applies that
  rule to the last route that still trusted an unverified email.
- "Failures are explicit and do not leak." Fix #3 sends every route through
  one masking helper that also turns quota exhaustion into a clear 503.
- Be honest about limits: no HIPAA claim, no certification, no measured media
  capacity, and the rules release pending until it is deployed.

Next unfinished task: release `firestore.rules` through the manual workflow
(owner decision), then repeat the authenticated doctor/patient acceptance run.
