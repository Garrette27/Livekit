# TeleConsole security and performance verification report

Report date: 18 November 2026, Asia/Singapore (UTC+8).
Source of truth: GitHub `Garrette27/Livekit`, branch `main`.
Code under test: `3883450` (last code change; later commits are documentation).
Production deployment: still `80c7e81` (see section 9).

This report is for the thesis adviser and co-authors. It states what was
tested, how, what passed, what failed, and what has not been tested yet. Every
number below was re-checked against the stored evidence files or re-run on the
date above. Result words follow the thesis convention: PASS, FAIL, BLOCKED,
NOT TESTED, NOT APPLICABLE.

## 1. Summary for the adviser

| Area | Verdict | One-line reason |
| --- | --- | --- |
| Access-control vulnerabilities found on 17 Nov | Fixed and retested: PASS | Both unauthorized operations are now denied by the deployed database rules |
| Automated security and policy tests | PASS | 27 tests + contract scripts, 8 database-rule tests, 29 mobile browser tests |
| Production dependency audit | PASS | 0 findings for shipped application and Cloud Functions packages |
| Full dependency audit (incl. developer tools) | FAIL, accepted risk | One upstream advisory in the lint toolchain; no patched release exists |
| Public page response time (pilot) | PASS | p95 304 ms and 1,239 ms against a 3,000 ms budget |
| Doctor login on 18 Nov | BLOCKED | Free-tier database read quota exhausted; not a code defect |
| Authenticated, video and concurrent-call performance | NOT TESTED | Needs a staging project and synthetic accounts |
| Usability and AI-documentation evaluation | NOT TESTED | Survey protocol prepared; sessions not yet run |

Overall: the security remediation is complete for the tested scope, and the
code passes every automated gate it controls. The thesis performance gate is
only partly evidenced (public pages). Consultation performance, capacity,
usability and AI evaluation still need their planned trials.

## 2. Timeline

| When (UTC+8) | Event |
| --- | --- |
| 17 Nov | Baseline assessment of `fa5a33c` found two exploitable database-rule gaps (another user's profile readable; patient could change own role to doctor) and 4 critical / 9 high dependency findings |
| 17 Nov | Remediation (`6df6ef7`, merged as PR #7, `29076d9`): owner-scoped rules deployed and retrieved, dependencies upgraded; retest PASS; full audit 0 findings at that time |
| 18 Nov, morning | `29076d9` deployment failed to load a JWT library at runtime (module format conflict); fixed in `80c7e81` with a scoped dependency override; that is the current production build |
| 18 Nov, 13:38 | HTTP response-time pilot on production (section 6) |
| 18 Nov, 13:39–13:40 | Doctor sign-in returned HTTP 500 three times; logs show Firestore `RESOURCE_EXHAUSTED` (daily free read quota used up); billing disabled on the project |
| 18 Nov, afternoon | Remediation commits `7e751dc` → `3883450` (sections 3.2 and 4); all pushed to `main` |
| 18 Nov | New advisory GHSA-fc5q-39xc-vjpf (picomatch) makes the full audit fail; it was not reported by the 17 Nov audit |

## 3. Security results

### 3.1 Before and after the 17 November remediation

| ID | Control | Baseline (`fa5a33c`) | After remediation |
| --- | --- | --- | --- |
| SEC01 | Security/policy test suite | PASS, 11 tests | PASS, 27 tests on `3883450` |
| SEC02 | 20 protected endpoints reject requests without credentials | PASS, 20/20 HTTP 401 | Unchanged; also covered by browser API tests |
| SEC03 | Deployed rules deny reading another user's profile | **FAIL**, read succeeded | PASS, denied by retrieved deployed rules |
| SEC04 | Deployed rules deny a patient changing own role to doctor | **FAIL**, update succeeded | PASS, denied |
| SEC05 | Rules deny operational access, patient summary read, self role elevation | PASS | PASS, within the 8 emulator tests |
| SEC06 | Storage rules agree with disabled uploads | FAIL (outdated test expectation) | PASS, test corrected |
| SEC07 | No high/critical production dependency findings | **FAIL**, 4 critical, 9 high | PASS, 0 production findings (see 3.3) |
| SEC08 | Security headers (HSTS, nosniff, frame denial, CSP) | PASS on sampled pages | Unchanged |

The failed baseline rows stay in the record. A corrected result is a separate
retest, not an edit of the original.

### 3.2 Security changes made on 18 November

| Commit | Change | Threat addressed | Regression |
| --- | --- | --- | --- |
| `80c7e81` | Bind admission to the patient's current visit; restore JWT library loading | Stale visit reused for admission; login outage | Focused queue/admission tests |
| `7e751dc` | Role lookup returns HTTP 503 "try again" when the database is unavailable; email bound to the verified identity | Outage shown as crash; email mismatch | Mismatched email and unavailable lookup tests |
| `382ac86` | Invitation creation no longer reports whether an email has an account | Account enumeration; one wasted read per invitation | Contract forbids the lookup |
| `3883450` | Reuse sentinel `999999` defined once and always shown as "reusable until expiry" | Inconsistent or misleading use limits | Contract rejects stray literals; test checks the label |

### 3.3 Dependency audit

| Inventory | Result |
| --- | --- |
| Application, production packages (`npm audit --omit=dev`) | PASS, 0 vulnerabilities |
| Cloud Functions packages | PASS, 0 vulnerabilities (CI job `firebase-functions`) |
| Application, all packages including developer tools | FAIL, 13 high entries, all from one advisory |

The single advisory is GHSA-fc5q-39xc-vjpf in `picomatch` ≤ 4.0.7. The latest
published version is 4.0.7, so no fix exists. It is reached only through
`eslint-config-next` (code linting), which never runs in the browser or on the
server. Risk is accepted until a patched release appears. The CI audit now runs
as its own job, so it fails visibly without hiding the other results.

## 4. Doctor login incident (18 November)

Observed sequence (sanitized evidence:
`evidence/2026-11-18-thesis-verification/production-login.json`):

1. Google identity sign-in succeeded (HTTP 200 from Firebase).
2. The application's role check (`POST /api/user/role-conflict`) returned HTTP
   500 at 13:39:36, 13:39:46 and 13:40:11.
3. Production logs show the database returned `RESOURCE_EXHAUSTED` (code 8)
   each time, after the identity token had been verified.
4. A control request without a session returned the expected HTTP 401
   `missing_token`, proving the handler itself loads and runs.
5. The project's Cloud Billing was disabled, so the free Spark quota of 50,000
   reads per day applied. It resets at midnight US Pacific time (16:00 UTC+8 in
   November).

Conclusion: an availability limit, not a security defect. The system refused
to guess the user's role, which is the correct fail-closed behavior. The fix in
`7e751dc` turns this into an honest HTTP 503 "Account verification is
temporarily unavailable" message. Successful login after the quota reset has
**not yet been verified on production**, and the fix itself is not live until
`main` is deployed (section 9).

Read-reduction work in response:

- Queue entries are filtered once on the server and only the distinct
  invitations they reference are read (`7e751dc`). Tests verify that an empty
  queue reads no invitations, several entries share one invitation read, and
  another doctor's invitation is excluded.
- Several on-screen panels share one request and one timer per queue
  (existing design).
- A hidden browser tab stops polling the queue and refreshes once when shown
  again (`10ca271`).
- Invitation creation no longer performs an unused account lookup (`382ac86`).

No production read-savings percentage was measured. The survey pilot in
`survey-and-interview-protocol.md` section 4.1 will measure reads per
consultation.

Read-only production audit of the waiting queue (field-limited, no personal
data): 152 rows, 13 waiting, 68 admitted, 57 left, 14 rejected; 0 rows with a
missing or unknown status. Deployed Firestore rules matched the repository
(SHA-256 recorded). Deployed Storage rules could not be retrieved, so Storage
results apply to the emulator only.

## 5. Automated test inventory (run on `3883450`, 18 November)

| Suite | Count | What it proves | Result |
| --- | --- | --- | --- |
| `npm run test:security`: node tests | 27 | Access policy, faculty-reviewer deny-by-default, admission decisions, queue scoping and polling, consent, invitation presentation | PASS 27/27 |
| `npm run test:security`: contract scripts | 2 scripts | Source-level invariants: no account enumeration, no device fingerprinting or IP geolocation, no professor/faculty route, no raw IP in audit, sentinel defined once, AGENTS.md scope | PASS |
| Firestore and Storage rules (emulator) | 8 | Owner access, denial of cross-user profile read, self role change, cross-doctor live queue query, disabled uploads | PASS 8/8 (CI `firebase-functions` job) |
| Mobile browser tests (Playwright, Pixel 7 profile) | 29 | Waiting-room lifecycle, revoked/left states, API access control, unsigned webhook rejection, accessibility smoke, invitation guidance with JavaScript disabled | PASS 29/29 in 1.4 min |
| Type check, lint, production build | 3 gates | Code compiles and builds | PASS |

GitHub Actions on `main`: run 44251249474 (`3883450`) and run 44250605621
(`752c54d`) both show job `application` = success, `firebase-functions` =
success, and `application-dependency-audit` = failure (section 3.3 only).

## 6. Performance results

### 6.1 Measured: public-page HTTP pilot

Method: sequential HTTPS GET of the full response body from one network
(WSL2, Node.js 22), 250 ms between requests, 10 requests per page, against
production deployment `80c7e81`. Criterion: 10 × HTTP 200 and p95 ≤ 3,000 ms.
At n = 10 the nearest-rank p95 equals the maximum.

| ID | Page | n | Median | p95 (max) | HTTP 200 | CDN cache | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PERF01 | `/` (landing) | 10 | 50.5 ms | 304 ms | 10/10 | HIT | PASS (pilot) |
| PERF02 | `/access-denied?reason=invalid-token` | 10 | 71 ms | 1,239 ms | 10/10 | PRERENDER/HIT | PASS (pilot) |

Recomputed from the raw samples in
`evidence/2026-11-18-thesis-verification/http-pilot.json`. These are cached
public pages. They do not show how fast a logged-in consultation, the
database, or video is.

### 6.2 Not yet measured (protocol in `performance-assessment.md`)

| ID | Metric | Proposed budget | Status |
| --- | --- | --- | --- |
| PERF03 / PERF09 | Logged-in history and invitation API | p95 ≤ 2 s, errors < 1% | NOT TESTED |
| PERF04 / PERF10 | Admission until both sides receive media | p95 ≤ 5 s | NOT TESTED |
| PERF05 / PERF11–12 | Audio/video quality (RTT, jitter, loss, frame rate) | RTT ≤ 300 ms, jitter ≤ 30 ms, loss ≤ 1%, ≥ 24 fps | NOT TESTED |
| PERF06 / PERF18 | 1, 3 and 5 simultaneous calls | Budgets above still hold | NOT TESTED |
| PERF07 / PERF16–17 | AI generation and documentation time | p95 ≤ 60 s; paired time difference | NOT TESTED |

These need an isolated staging Firebase project with synthetic accounts (the
free production quota cannot absorb load tests) and two real devices per call.

## 7. Software design and AGENTS.md

The project goal is not only to pass the tests but to follow established
design patterns that fit a secure teleconsultation. The pattern table, file
locations and compliance check are in `docs/design-pattern-review-2026-11-18.md`
and summarized for co-authors in `docs/thesis-team-guide.md` section 5.

AGENTS.md compliance on the reviewed paths: invitation links are treated as
capabilities with full server re-validation; only verified, allowlisted
identities skip the queue; waiting-room tokens carry no media rights; no raw
tokens, IP addresses, user agents, emails or clinical text appear in logs; the
reuse sentinel is never displayed; no Firebase Dynamic Links; no device or
location verification claims; the faculty reviewer remains backend-only; every
fix has a focused regression; the completion gate passed.

## 8. Corrections to the earlier brief (same date)

An earlier version of this brief and the design review contained these
inaccuracies, now corrected:

1. It said `AGENTS.md` in the repository contained rules copied from an
   unrelated product. In fact those rules were only in an uncommitted local
   copy on one computer; the repository version never had them. The local copy
   was restored, and a regression now rejects such content.
2. It cited `lib/repositories` for the invitation-use transaction. The
   transaction is in `lib/services/invitation-access/invitation-access-core.ts`
   and `lib/invitations/invitation-use-reservation.ts`.
3. It counted 26 application regressions; the current count is 27.
4. It said "no patched release was available" without the version; the latest
   `picomatch` is 4.0.7, which is still affected.

## 9. Deployment status (honest limitation)

All commits after `80c7e81` are on `main` and pass CI, but **Vercel blocked
their deployment**: the commit author account is not a member of the Vercel
project ("Git author … must have access to the project on Vercel to create
deployments"). Production therefore still serves `80c7e81`, which has the
500-on-quota login behavior and none of the 18 November afternoon changes.
The project owner must deploy `main` from the Vercel dashboard, add the author
account to the Vercel project, or push a commit authored by the owner account.
Until then, sections 3.2, 4 (fixes) and 5 describe the tested code, not the
live site.

## 10. Remaining work and owners

| Task | Needs | Owner |
| --- | --- | --- |
| Deploy `main` to production, then verify doctor login after 16:00 | Vercel owner access | App owner |
| Survey pilot: measure reads/writes per consultation | 2 teammates, 1 hour after 16:00 | Survey team |
| Usability sessions (patients, doctors, IT) | Consent forms approved by adviser | Survey team |
| AI documentation comparison | Fictional transcripts, 1–2 clinicians | Survey team + app owner |
| Staging project for PERF03–PERF07 and security cases S13–S26 | Separate Firebase project, synthetic accounts | App owner |
| Re-run full audit when `picomatch` publishes a fix | — | App owner |

## 11. Suggested Chapter IV sentences

- "The baseline assessment found two exploitable Firestore rule gaps
  (cross-user profile read and patient self-promotion to doctor). After
  remediation, both attacks were denied by the retrieved production rules in
  an emulator retest, and the 8-case rule suite passed."
- "On 18 November, doctor sign-in failed because the free-tier Firestore read
  quota was exhausted. The system failed closed rather than assigning a role
  without verification; the remediation reports a retryable HTTP 503 and
  reduces queue reads."
- "In an exploratory 10-request pilot, the landing page had a median of
  50.5 ms and p95 of 304 ms, and the invalid-invitation page a median of 71 ms
  and p95 of 1,239 ms. These cached public-page results do not establish
  authenticated consultation latency or concurrent WebRTC capacity."

## 12. Evidence and references

- Raw evidence: `docs/testing/evidence/2026-11-18-thesis-verification/`
  (`http-pilot.json`, `production-login.json`, `firestore-readonly.json`) and
  `docs/testing/evidence/2026-11-17*/`.
- Prior reports: `docs/testing/remediation-report.md`,
  `docs/testing/security-assessment.md`, `docs/testing/performance-assessment.md`,
  `docs/testing/remaining-experiments.md`.
- Co-author material: `docs/thesis-team-guide.md`,
  `docs/testing/survey-and-interview-protocol.md`.
- GitHub Actions runs 44251249474, 44250605621, 44213350665.
- Firebase documentation: "Cloud Firestore quotas" and "Firebase pricing plans".
- GitHub Advisory Database, GHSA-fc5q-39xc-vjpf.
- ISO/IEC 25010 (quality model), OWASP and NIST SP 800-63 (identity assurance)
  as the guiding frameworks named in the thesis.
