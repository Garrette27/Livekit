# Change description: 18 November 2026 (pushed directly to `main`)

Range: `80c7e81..eb5dbf0`. This repository pushes directly to `main`; this file
stands in for a pull-request description.

## Problem

Doctor sign-in failed in production because the free Firestore read quota
(50,000 per day) was exhausted, and the role check surfaced it as an HTTP 500.
The thesis also needed performance/security evidence that co-authors can use,
a survey plan that fits the free quota, and a check that the code follows
`AGENTS.md` and established design patterns.

## Code changes

| Commit | Change |
| --- | --- |
| `7e751dc` | Role check returns HTTP 503 "try again" on database quota, timeout or outage; queue reads only the distinct invitations referenced |
| `f934a64` | Patient room page renders invitation guidance in the initial HTML (no blank page before hydration) |
| `10ca271` | Hidden doctor tabs stop polling the waiting queue (Page Visibility API) and refresh once on return; dependency audit moved to its own CI job; AGENTS.md states that thesis acceptance and proven design patterns are both goals |
| `382ac86`, `08bd5bb` | Invitation creation no longer reveals whether an email has an account (account enumeration) and skips that read; original line endings preserved |
| `28b437e` | OpenAI `insufficient_quota` recorded once as an unavailable summary instead of retried failures; `docs/ai-summary-status.md` documents the no-credit status |
| `eb5dbf0` | Firestore quota/deadline/outage errors answer 503 with a retry message (links, queue, invitation creation, doctor access, authorization) instead of an opaque 500 |
| `3883450` | `999999` reuse sentinel replaced by one documented constant `REUSABLE_INVITATION_MAX_USES`; contracts reject a stray literal and reject unrelated product rules in AGENTS.md |

## Documentation

- `docs/testing/thesis-verification-2026-11-18.md`: full verification report for the adviser.
- `docs/design-pattern-review-2026-11-18.md`: patterns in use, AGENTS.md compliance, issues resolved.
- `docs/thesis-team-guide.md`: plain-language guide for co-authors.
- `docs/testing/survey-and-interview-protocol.md`: survey, interview and scheduling plan within the Firebase free tier.
- `output/pdf/`: PDF copies for the adviser and the team.

## Verification (on `3883450`)

- `npm run test:security`: 29/29 tests (on `eb5dbf0`) and both contract scripts pass.
- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- Playwright mobile Chromium: 29/29 pass.
- GitHub Actions run 44251249474: `application` and `firebase-functions` succeed; `application-dependency-audit` fails on GHSA-fc5q-39xc-vjpf (picomatch ≤ 4.0.7, lint toolchain only, no patched release).

## Not done / risks

- Deployed to production at `28b437e` (owner-authored commit; earlier commits were blocked by Vercel's Hobby collaboration limit).
- Production database quota was exhausted on 18 Nov (verified HTTP 429 RESOURCE_EXHAUSTED); the doctor workflow must be re-verified after the 16:00 reset.
- Authenticated, WebRTC and concurrent-call performance, usability and AI evaluation remain NOT TESTED.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
