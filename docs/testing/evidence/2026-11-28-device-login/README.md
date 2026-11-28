# Device-menu and staff-entry verification

28 November 2026. Local Linux/WSL, Node 22.22.2. Application checks used the
installed dependencies. Browser checks used Playwright with installed Chromium
1223 selected through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. These results
describe this working tree; no production deployment or role mutation occurred.

| Check | Result | Evidence |
| --- | --- | --- |
| Final TypeScript | PASS | `typecheck-final.log`, `npm run typecheck` |
| Final security/regression command | PASS, both source-contract scripts and all seven test files | `security-final.log`, `npm run test:security` |
| Focused staff-entry/administration | PASS, 25 tests | `auth-final.log`, `node tests/admin-workspace-regressions.test.mjs` |
| Device menus and consultation workspace | PASS, 8 tests | `device-browser.log` |
| Final production build | PASS | `build-final.log`, `npm run build` |
| Full workspace lint | FAIL on two existing CommonJS import errors in an unrelated, initially untracked evidence script | `lint.log` |
| Lint with that one file excluded | PASS, one pre-existing appointment effect warning | `lint-final.log` |
| Independent code review | One login recovery issue found, fixed and independently retested; no remaining actionable findings | Both login handlers clear completed access state in `finally`; regression covers rejection → method switch → successful doctor retry |

The excluded lint file is
`docs/testing/evidence/2026-11-19-reassessment/supplemental-rules.cjs`.
It was present before this task and was preserved. The scoped command was:

```sh
npm run lint -- --ignore-pattern docs/testing/evidence/2026-11-19-reassessment/supplemental-rules.cjs
```

The retained warning is in
`app/doctor/appointments/components/AppointmentWorkbench.tsx:58`.
No lint rule or repository configuration was weakened. Original CRLF in
`app/globals.css` is preserved; the whitespace check uses
`git -c core.whitespace=cr-at-eol diff --check`.

## What the tests establish

The device regression renders actual installed LiveKit controls, a disconnected
Room and application CSS. Only device discovery is synthetic. At 1280×800,
390×844 and 320×568 it checks both microphone and camera popup/list/item/button
bounds, option hit-testing, viewport fit, wrapping, focus/selection, active-device
state and dismissal. The original 18px popup failed containment and hit-testing
before the fix. Representative synthetic screenshots and geometry are retained
here; they contain no consultation or patient information.

The login harness executes actual page/component callbacks with synthetic
Firebase/access adapters. It checks Google/password acceptance and rejection,
exact clinic versus super-admin entry, sign-out, refresh, identity-only signup,
outages, absence of clinical writes on rejected identities and retry after a
method switch. It does not exercise real Google OAuth or deployed accounts.

Server authorization and clinic ownership remain the existing security
boundary. The role pages grant no permissions. No Firebase rules were changed;
no claim of a new rules-emulator run or instantaneous media-token revocation is
made. Hardware capture and an authenticated doctor/patient call still need
deployment acceptance.

## Read-only production and setup checks

`production-metadata-audit.json` contains aggregate projected metadata only.
No identities, emails, tokens, transcripts, messages or clinical text were
recorded. No migration or production write was used for inspection.

The [Vercel setup report](../../vercel-setup-2026-11-28.md) records CLI 68.0.0,
owner-project/GitHub verification, successful shared MCP OAuth and the remaining
MCP project-access limitation. Scheduling and attachments remain disabled.

Document checks are recorded in `documents.log` and the dated
[artifact report](../../../thesis-defense/evidence/admin-oversight-2026-11-28/artifact-verification.json).
They establish document integrity and bounded editorial changes, not clinical
validation or new study results. The ZIP, remote downloads and live application
retain their earlier checkpoint until separately published.
