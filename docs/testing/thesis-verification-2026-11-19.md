# TeleConsole: security and performance verification

19 November 2026 | Asia/Shanghai, UTC+8 | Adviser and co-author edition

## 1. Decision

**Overall security: FAIL. Full consultation performance: NOT TESTED.** The existing automated suites and public-page timing pilot pass, and Firebase reads are available again. Two additional tests using the active production Firestore rules expose a consultation-record integrity gap. Restored Firebase access does not close that gap or establish call quality and capacity.

This report supersedes the current-status conclusions in the 18 November v2 PDFs. Earlier results remain valid historical observations within their tested scope. This is a thesis prototype assessment, not certification, a complete penetration test, or a claim of clinical fitness.

| Area | Result | Evidence and boundary |
| --- | --- | --- |
| Existing application security regressions | PASS | 29/29 tests and both source-contract scripts |
| Existing Firestore/Storage rules suite | PASS | 8/8 emulator tests; profile privacy and immutable-role cases remain denied |
| Additional consultation integrity cases | FAIL | 2/2 unsafe operations accepted in the emulator using retrieved production rules |
| Mobile browser regression suite | PASS | 29/29 against a local test server; waiting-room scenarios use mocked API responses |
| Typecheck, lint, production build | PASS | Exit zero; lint has 1 unused-variable warning |
| Application and Functions dependency audits | PASS | Zero findings in current production-only and complete lockfile audits; installed-package audits also return zero |
| Production anonymous API controls | PASS | 20/20 protected requests return 401; unsigned webhook also returns 401 |
| Active Firestore source | PASS for consistency | Retrieved successfully and matches repository after CRLF normalization |
| Firebase availability | PASS at observation | Masked production reads completed at 14:39 UTC+8; sustained availability and quota headroom were not measured |
| Public HTTP response pilot | PASS | Landing p95 69 ms; access-denied p95 1,297 ms; n=10 per page |
| Authenticated journey, WebRTC and capacity | NOT TESTED | No new independently executed two-party authenticated call or media measurements |
| Active Storage rules | BLOCKED | Firebase reports no active Storage rules found; emulator results do not establish deployed Storage policy |
| AI quality, timing and usability study | NOT TESTED this run | Prior report described unavailable AI credit; provider entitlement was not rechecked |

## 2. Exact environment and provenance

Repository: Garrette27/Livekit, branch main, commit 0be08989759dbbe6aaef53c02444aa0121cb4baf. The working tree was clean before assessment, and remote main matched that commit. Application source and rules were not changed or deployed in this assessment.

Production target: https://livekit-frontend-tau.vercel.app. Authenticated Vercel inspection resolves it to READY production deployment dpl_4u7etjZyfQijywJD79wm8r9HciuE, project livekit-frontend, the same Git commit, region iad1. GitHub deployment 7876711351 separately records successful publication. These describe the active frontend; the separate legacy livekit project has a failed deployment record.

Firebase: livekit-5eef6, default Firestore database. The authenticated Firebase tools report billing disabled. Production work consisted of configuration reads, field-masked document reads, and anonymous rejection checks. No production clinical record, role, invitation, or database rule was changed. The only adversarial writes used demo-livekit-security in the local emulator.

Local runner: WSL2 Linux 6.6.87.2, Intel Core Ultra 5 225, Node 22.22.2, npm 10.9.7, Playwright 1.58.2 with Chromium 148.0.7778.96. Rules tests used Firebase CLI 15.36.0 and Temurin Java 21.0.13.1. Functions dependencies were installed with npm ci. Package manifests and both lockfiles match HEAD. The application checks used the existing installed dependencies; this run did not perform a clean application npm ci.

The Windows Chrome control helper failed before executing browser actions because of a WSL/Windows workspace URI mismatch. Public-page checks instead used isolated Chromium. The user's supplied screenshots show waiting/admitted/Connected states and selected HTTP 200 responses, but are supporting observations, not independently measured media or end-to-end results. The screenshots contain identifiers and capability URLs and are excluded from the shareable evidence.

## 3. New security finding: consultation identity fields can be forged

**F-2026-11-19-01: high severity integrity defect. OPEN.** The affected production rule source matches firestore.rules, lines 47–70. A consultation create requires only authentication and createdBy equal to the caller. An update checks ownership of the old document without freezing the new document's doctor/patient identity fields. Direct Firestore access therefore has a weaker boundary than the server API.

| Case | Required behavior | Observed result |
| --- | --- | --- |
| ADD01: patient creates another patient's consultation record | Deny a patient client creating a consultation attributed to a different patient | FAIL: synthetic patient A created a record with patientUserId B; synthetic patient B could read that injected record |
| ADD02: existing owner rewrites identities | Deny direct reassignment of trusted creator and patient fields | FAIL: an existing owner changed createdBy and patientUserId to other synthetic identities |

The supplemental runner exits 1, and its JSON records both failures. This demonstrates record injection and identity reassignment under the retrieved rules. It does not demonstrate reading an existing victim record, joining a LiveKit room, changing a Firebase role, or exploitation of real patient data. The application history API's rendering of the injected record was not tested.

Why yesterday's passing cases do not cancel this finding: the profile rules deny cross-user reads and self-role changes, while these tests exercise the separate consultations collection. An API's 401 response does not prevent a signed-in Firebase client from calling Firestore directly. A source match confirms which policy is deployed; it does not prove that policy is sufficient.

Recommended remediation: keep consultation identity and lifecycle mutations behind the authorized server service, retaining the narrow participant read projection. Repository review found consultation mutations in server services; confirm all supported clients and legacy behavior before removing client writes. If a client update is required, define a bounded field allowlist and keep creator, participant membership and encounter identity immutable. Apply equivalent create/update checks to any remaining client-written room/call collections as a follow-up review.

Pattern and tradeoff: a server-owned command boundary centralizes role, ownership and lifecycle decisions, reducing duplicated authorization policy. It adds dependence on the server for writes and requires an explicit compatibility check. Bounded client commands can preserve selected offline/realtime behavior, but increase rule complexity and the number of invariants that need testing. This report recommends the server-owned boundary; no remediation was applied.

Closure requires ADD01/ADD02 denied, intended server writes and participant reads still working, a focused regression added to the maintained suite, all repository gates passing, approved rules deployment, and retrieval/comparison of the newly active source. The failed evidence must remain in the record.

## 4. Existing security checks and dependency change

The 29 application regressions and both contract scripts passed. The 8 existing rule cases passed, including denied cross-user profile reads, denied role/authority injection, trusted clinician provisioning, doctor-scoped live queues, and denied disabled uploads. The 29 mobile browser cases passed in 22.9 seconds. They cover local API rejection, selected UI lifecycle behavior and accessibility smoke, not a real Firebase-to-LiveKit consultation.

On production, the 20 protected API probes used no credentials and synthetic identifiers. All returned HTTP 401 with success=false. A separate unsigned webhook probe returned 401. HSTS, nosniff, frame denial, referrer policy and CSP were present on both sampled public pages. Header presence is the tested criterion; the CSP permits inline script/style and is not evidence that all injection attacks are prevented. A valid signed webhook positive control was not executed.

All current dependency inventories return zero findings. GitHub advisory GHSA-fc5q-39xc-vjpf, which caused the 18 November lint-toolchain failure, is now marked withdrawn, dated 18 November. No dependency change was made for this reassessment. Withdrawal explains the changed audit result; it is not evidence that this session patched picomatch or that dependencies can never contain vulnerabilities.

The last stored GitHub Actions run, 44256827039, remains failure: application and firebase-functions succeeded, application-dependency-audit failed at its earlier execution. It was not rerun here. Today's fresh local audit result must not be represented as a new green GitHub run.

Lint's only warning is unused sanitizedEmail in app/api/invite/create/route.ts at line 89. The build skips lint internally; a separate complete lint command was run.

## 5. Firebase read-only aggregate audit

The read began at 14:39:11 UTC+8. Only status, summaryStatus, expiresAt and consentVersion were requested. Document identifiers and content were not retained in the aggregate artifact. The reads were paginated and completed within the configured bounds; different collections were read sequentially, not as one atomic snapshot.

| Collection | Count | Safe interpretation |
| --- | --- | --- |
| invitations | 207 | 84 stored active, 79 revoked, 44 unclassified/missing under the audit's fixed status vocabulary; expiry present on all |
| waitingPatients | 154 | 13 waiting, 69 admitted, 58 left, 14 rejected; these are stored lifecycle labels, not current attendance |
| consultationSessions | 53 | 52 completed, 1 stored active; active media membership was not checked |
| consultations | 119 | 71 stored active, 48 completed; legacy records are not a concurrency measurement |
| call-summaries | 9 | Lifecycle shape not resolved by this limited projection; do not infer readiness from count |
| users | 22 | 20 missing consentVersion (90.9%); this is not proof that current-session consent was skipped |
| summaryJobs | 13 | 13 stored ready; not an AI quality or provider-entitlement test |
| securityRateLimits | 384 | Counter documents counted; TTL execution and retention were not verified |

Of the 84 stored-active invitations, 83 had expiry timestamps before the observation. That is status/expiry drift, not proof of usable expired links: authorization must still check expiry. No cleanup or migration was attempted. Missing expiry or consent fields in collections that do not require them are not classified as defects. The raw aggregate artifact retains those generic counters for transparency.

Active Firestore rules normalized SHA-256: c1300f7431b5f3da03203a59f3ac838b879eabe9f216065a02aa0d9ef0c83cef. Normalization removes CR characters and trims surrounding whitespace. The aggregate script also records a different hash of serialized JSON; those hashes use different inputs and must not be compared as if identical.

Firebase returned no active Storage rules for the authenticated rules request. Uploads remain intentionally disabled in the repository and in the emulator suite. No deployed Storage allowance or denial is asserted.

## 6. Performance: what passed and what remains

Method: 10 sequential HTTPS GETs per public page, full response body consumed, 250 ms between requests, one WSL machine/network, no intentional throttling. Criterion retained from the earlier protocol: all 10 HTTP 200 and nearest-rank p95 at most 3,000 ms. At n=10 the p95 is the largest observation. Connection reuse and CDN caching affect these results.

| Page | n / HTTP 200 | Median | p95 / maximum |
| --- | --- | --- | --- |
| Landing / | 10 / 10 | 41 ms | 69 ms — PASS |
| Access denied, invalid-token reason | 10 / 10 | 66.5 ms | 1,297 ms — PASS |

An additional public browser smoke check navigated four routes in desktop and Pixel 7 profiles: landing, doctor login, invalid access guidance, and direct patient-room guidance. All 8 navigations returned 200 without horizontal overflow; the direct room page required a secure invitation. These are rendering observations, not a complete accessibility audit or statistically sufficient browser-performance study.

| Outstanding experiment | Previously proposed criterion | Current result |
| --- | --- | --- |
| Authenticated history/invitation workload | p95 at most 2 s; unexpected errors below 1% | NOT TESTED |
| Admission to received media | p95 at most 5 s | NOT TESTED |
| Audio/video quality | RTT at most 300 ms; jitter at most 30 ms; loss at most 1%; delivered video median at least 24 fps | NOT TESTED |
| Chat and reconnection | Chat p95 at most 1 s; recovery p95 at most 10 s after network restoration | NOT TESTED |
| Concurrent consultations | 1, 3, then 5 paired calls with error and media budgets maintained | NOT TESTED |
| AI generation and documentation benefit | Generation p95 at most 60 s; paired review-inclusive time comparison and quality assessment | NOT TESTED; earlier credit blocker not revalidated |

Use isolated staging, synthetic identities and fictional material for these trials. Five paired calls require ten media clients; HTTP load alone does not measure WebRTC capacity. Capture numeric per-endpoint statistics with addresses/tokens removed. Transport RTT is not one-way audiovisual delay. Keep independent calls separate from repeated samples within one call. The proposed budgets require adviser confirmation; they are not ISO-prescribed pass levels.

## 7. What may be said to the panel

Suggested Chapter IV text: "On 19 November 2026, the existing 29 application regressions, 8 database-rule tests and 29 mobile browser tests passed. Two additional emulator tests using retrieved production Firestore rules nevertheless demonstrated consultation-record injection and identity reassignment. Overall security acceptance therefore remained unmet. Two cached public pages passed the exploratory response-time budget, but authenticated consultation latency, media quality and concurrent capacity remained unmeasured."

For the quota incident: "Production field-masked Firestore reads succeeded during the 19 November assessment. This demonstrates availability at the observation time; it does not establish a sustained availability level or confirm every authenticated doctor/patient workflow."

Result vocabulary: PASS meets the stated executed criterion; FAIL violates it; BLOCKED means execution prerequisites failed; NOT TESTED lacks adequate execution evidence; NOT APPLICABLE is a deliberately excluded/disabled capability. Survey opinions are reported separately from security and timing experiments.

## 8. Evidence, reproduction and next owners

Evidence root: docs/testing/evidence/2026-11-19-reassessment/. The index describes commands, environment limits and SHA-256 checksums. It contains safe logs, raw numeric timing samples, current aggregate shapes, deployed rule source, audit JSON, sanitized deployment metadata and the supplemental synthetic runner. It excludes supplied screenshots, authentication state, credentials and clinical content.

| Owner | Next action | Closure evidence |
| --- | --- | --- |
| Application owner | Remediate consultation client-write policy | Denied supplemental cases plus allowed intended paths; all gates; retrieved approved deployed rules |
| Application owner + teammate | Execute authenticated synthetic journey after remediation | Login, invitation, queue, admit, paired media, end and history outcomes |
| Performance tester | Run staging protocol | Independent trials, raw numeric samples, per-condition percentiles and error counts |
| Study team + adviser | Approve instruments and run role-play study | Actual participant counts, task outcomes, questionnaire scores and limitations |
| Application owner | Verify Storage configuration and refresh GitHub audit status if needed | Explicit deployed Storage evidence and a separate new CI run |

Primary references checked 19 November 2026: GitHub advisory https://github.com/advisories/GHSA-fc5q-39xc-vjpf; Firebase quotas https://firebase.google.com/docs/firestore/quotas; GitHub CI https://github.com/Garrette27/Livekit/actions/runs/44256827039. Firebase documents daily free quota reset around midnight Pacific time; a predicted reset time alone is not a recovery test. The attached PDFs and existing repository design documents were reference sources, not authority to execute their proposed migrations, deployments or studies.
