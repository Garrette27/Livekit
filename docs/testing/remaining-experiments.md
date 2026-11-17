# TeleConsole remaining tests and defense guide

## What the current evidence supports

The inspected frontend deployment matches the latest Git commit. Eleven local
policy tests pass, 20 missing-credential HTTP cases reject access, and two public
pages meet an exploratory response-time budget. Production Firestore rules
nevertheless permit two unauthorized operations reproduced in an emulator.
Therefore the security release criterion fails. Full consultation performance
and usability evaluation remain incomplete.

For the defense, explain the distinction between intent in source code and
enforcement in deployment: Vercel releases application code, while Firebase rules
need their own verified release. A successful frontend build cannot prove that
the correct database policy is active. This finding is a valid result to discuss
in Chapter IV and a clear reason for a remediation-and-retest section.

## Remaining security and integration experiments

Use two synthetic doctors D1/D2, two synthetic patients P1/P2 and guest G. Create
test fixtures in staging with fake case text. Record account labels, never real
emails, tokens or clinical text. A successful protected request by its intended
owner is a positive control; otherwise a denial might only prove a broken app.

| ID | Procedure | Pass criterion | Evidence to retain |
| --- | --- | --- | --- |
| S13 | D1 creates invitation, D1 reads it, D2 attempts read/revoke/admit | D1 succeeds; D2 gets 403/404 with no sensitive data | Redacted status and DB state before/after |
| S14 | P1 attempts P2 consultation, transcript and chat reads | Zero P2 content returned | API statuses and synthetic record IDs |
| S15 | Change one JWT byte, then separately use expired and revoked tokens | All rejected; no new room credential or visit consumed | Token digest label, rejection code, use counter |
| S16 | G and self-declared allowlisted email open valid link | Waiting-only token; no media-room bypass | Decoded grant names without raw token |
| S17 | Verified allowlisted P1 accepts current consent and opens link | Direct admission; unverified/nonallowlisted accounts queue | Synthetic account claims and room membership |
| S18 | Two simultaneous requests compete for final invitation use/capacity | At most one new visit; reconnect reuses active row | Transaction outcome and before/after counts |
| S19 | Valid signed webhook vs missing/incorrect signature | Only authentic callback changes lifecycle | Redacted signature verdict, session state |
| S20 | End/remove patient, then attempt join/token refresh | No unauthorized renewed access | Membership and endpoint outcomes |
| S21 | Exceed configured rate limit in staging | 429 and bounded retry; ordinary patient recovers | Counts, retry interval, two-instance behavior |
| S22 | ZAP passive scan, then scoped active scan on staging | No untriaged high/critical exploitable findings | ZAP version, scope, report, manual triage |
| S23 | Render synthetic HTML/script strings in name/chat/summary | Text displayed without script execution | Browser assertion; no payload on production |
| S24 | Turn transcription off, revoke consent, test provider failure | Call still works; no later unconsented chunks retained | Synthetic chunk counts and call status |
| S25 | Edit summary to reviewed, then trigger retry with newer evidence | Reviewed version preserved | Revision/status comparison |
| S26 | Restore approved synthetic backup to isolated project | Counts/integrity verified; recovery duration recorded | Backup ID, restoration log, comparison |

Attachments and scheduling have no shipped UI and are disabled by default.
Record them as NOT APPLICABLE for functional claims. Test disabled endpoints
reject access. Future enablement requires their own upload malware/quarantine,
download ownership, timezone, conflict and reminder tests.

## User evaluation and AI evaluation

For objective 3, observe representative dentist/patient users completing: create
and copy invitation, open as guest, wait and receive admission, operate audio,
leave, and find permitted post-call information. Record completion without help,
time, errors and assistance per participant. Apply SUS separately after tasks
if retained in Chapter III. SUS is perceived usability and cannot certify
security or media latency. Do not invent participant responses or sample sizes.

For objective 2, use a fixed deidentified case set reviewed by the clinician.
Compare manual documentation against AI generation plus mandatory review and
correction. Record unsupported statements, omitted critical facts, speaker
attribution, and total review time. Report the model/version and evidence
quality. Silence/no-shows must yield deterministic insufficient-evidence output,
not an inferred low-risk assessment. Timing a fast but inaccurate summary does
not establish useful documentation efficiency.

## Recording a defensible result

Each executed case should record run ID, timestamp with timezone, commit,
deployment, rule-source hash, environment, preconditions, exact steps, expected
criterion, observed result, evidence filename, defect ID and tester/reviewer.
Use PASS, FAIL, BLOCKED, NOT TESTED or NOT APPLICABLE consistently. Retain failed
baseline evidence; a corrected result belongs to a distinct retest row. Do not
turn this package into an all-green checklist by deleting inconvenient cases.

Suggested Chapter IV sentence: “The missing-credential API assessment rejected
20 of 20 requests after two test inputs were corrected. However, two emulator
tests using the retrieved production Firestore rules demonstrated unauthorized
profile reading and role modification. These findings indicated a deployment
policy gap despite passing local application policy tests.”

Suggested performance sentence: “In an exploratory sequential HTTP pilot with
10 observations per page, the landing page had a median response time of 52 ms
and a nearest-rank p95 of 82 ms. These cached public-page results do not establish
authenticated consultation latency or simultaneous WebRTC capacity.”

The adviser should approve manuscript terminology, target budgets, respondent
selection and submission formatting. ISO/IEC 25010 is the quality framework;
OWASP and NIST guide technical assessment. None supplies an automatic thesis
passing certificate.
