# TeleConsole: teammate guide and survey protocol

19 November 2026 | Asia/Shanghai, UTC+8 | Shareable co-author edition

## 1. Current status to tell teammates and professors

**We do not yet have a full security and performance pass.** The existing automated tests pass and Firebase reads work again. A new database-rule test found that a signed-in patient can inject a consultation record attributed to another patient. Another test allowed an existing owner to change consultation identity fields. Both were demonstrated safely in a local emulator using the active production rules. The owner must fix and retest that boundary.

Two public pages passed the response-time pilot. Audio/video quality, authenticated timing and simultaneous-call capacity have not been measured. Do not turn a Connected badge, a screenshot, or a successful Firebase read into a claim that those tests passed.

| What changed since the 18 November PDFs | What to write now |
| --- | --- |
| Firebase quota had blocked inspection | Read-only production audit completed on 19 November at 14:39 UTC+8; continued availability is not established |
| Full dependency audit failed | Current audits report zero findings; GitHub withdrew the earlier advisory |
| Existing test counts were mixed across commits | Fresh results: 29 application tests, 8 rule tests, 29 mobile browser tests; two contract scripts also pass |
| Earlier security conclusion covered fixed profile/role gaps | Those cases still pass, but overall security FAILS because two additional consultation integrity cases fail |
| Public-page timing was from 18 November | Current landing median/p95 41/69 ms; access-denied 66.5/1,297 ms; 10 requests per page |
| Live call performance was unmeasured | Still NOT TESTED; no capacity or media-quality claim |

The companion verification report gives exact methods and evidence. Both documents refer to commit 0be0898 on main and the verified READY livekit-frontend production deployment. Application behavior was not changed during this assessment.

## 2. Explain the product in plain language

TeleConsole is a teleconsultation thesis prototype. A doctor creates a private invitation, a patient opens it, waits for admission, and joins a LiveKit call. Optional transcription supplies evidence for an AI draft that a clinician must review. An invitation is a limited ticket, not proof of identity; AI is an assistant, not the clinical decision maker.

The intended journey is doctor login, invitation creation, patient entry, waiting room, doctor admission, audio/video and chat, leave/end, and permitted history. This describes the designed workflow; the entire authenticated sequence was not independently rerun in this assessment.

Only a non-anonymous account with a provider-verified email on the invitation allowlist may skip the queue. A typed email, device, IP address, browser or location is not identity verification. An unadmitted visitor should receive only a waiting-room credential with no consultation media rights.

Transcription is optional and requires each participant's consent. Browser speech notes are a clinician-started fallback after verbal consent; they are not a complete recording or a guaranteed complete transcript. Summary states are processing, ready (draft), and reviewed, with failed/unavailable branches. Insufficient evidence must not become guessed symptoms or low risk. Reviewed notes must not be overwritten by AI regeneration.

Attachments and scheduling remain disabled. There is no professor dashboard or broad faculty access. Professors receive these deidentified documents; faculty status does not grant access to clinical records.

## 3. How to explain the new security gap

The application server checks roles, but Firebase clients can also communicate directly with the database. The active consultations rules allow more than the server intends. In the new tests, one synthetic patient could create a record naming another patient, and an owner could change trusted participant/creator fields.

This is a record-integrity problem. It is separate from the previously fixed profile-reading and role-escalation problems. We did not attack real accounts, read another person's real record, or establish that someone can enter a call without admission. The old tests remain useful; they need these additional cases to cover the newly identified boundary.

The proposed design is server-owned consultation writes with participant-scoped reads. This keeps trusted identity/lifecycle decisions in one place, at the cost of routing writes through the server. Before release, preserve supported patient/doctor behavior and legacy projections, add the denied-write regressions, deploy the approved policy and retrieve it again. No migration or deployment was performed for this report.

## 4. Claims the manuscript can support

| Supported statement | Statement to avoid |
| --- | --- |
| Existing application, rule and mobile-browser suites passed on the tested version | All security tests passed or the system is secure |
| Two additional cases exposed a database integrity gap | The new report proves real records were stolen or calls were bypassed |
| Current package audits report zero findings | Zero possible vulnerabilities or permanent dependency safety |
| Two cached public pages met the pilot timing budget | Video is fast, the database scales, or five calls can run together |
| Firebase reads succeeded at a recorded time | The quota problem can never recur or every doctor action now works |
| A study will use convenience sampling and report actual counts | Invented respondent numbers, scores, interview quotes or AI accuracy |

Use thesis prototype. Do not claim HIPAA, ISO, FHIR or medical-device certification. Frameworks organize the study; they do not automatically certify the application. AI clinical quality and documentation-time savings need separate evidence.

## 5. Study readiness and participant selection

This is a protocol, not a completed study or an instruction to start collecting data immediately. The adviser confirms the final consent process, instruments, framework edition and acceptance budgets. Close the new integrity finding and complete a synthetic practice journey before using the live application for participant sessions. Planning and questionnaire review can proceed meanwhile.

Use the available adult volunteers among general users, clinicians/dentists and IT evaluators as a convenience sample. Record actual approached, consented, completed, withdrawn and excluded counts by group and instrument. There is no assumed achieved sample size. Small convenience samples support descriptive findings and stated limitations, not population-wide conclusions.

Use prepared synthetic doctor accounts and guest participant codes such as P01, D01 and IT01. A guest session can still create pseudonymous technical records in Firebase. Guest access does not guarantee anonymity or that nothing is stored. Do not ask participants for real symptoms, patient identities or personal medical information.

Participation and transcription consent are separate. Explain voluntariness, the right to stop, who sees study records, the approved retention period, and how withdrawal is handled. Do not promise that data is deleted unless that process is implemented and verified. Keep survey responses separate from application clinical records. Keep any identity-code mapping separately with restricted access, only if necessary.

## 6. Rehearsal and a 45-minute session

After the security fix, two teammates rehearse the complete journey with fictional material. Confirm both endpoints actually receive audio/video; Connected alone is insufficient. Verify admission, chat, leaving and history. Keep transcription off unless that part of the study has its own consent and available provider. Record technical blocks rather than dropping unsuccessful attempts.

| Time | Activity | Record |
| --- | --- | --- |
| 0–5 min | Welcome and consent | Participant code, group, voluntary consent |
| 5–8 min | Read the task card | Device/browser and version; no demonstration of the answer |
| 8–25 min | Observe tasks | Outcome, time, errors, help and technical blocks |
| 25–35 min | Approved questionnaires | Instrument/version, completed items, scoring exclusions |
| 35–45 min | Short interview | Coded notes; record audio only with separate consent |

Use two facilitators when possible: one plays the other side of the call, one observes. Apply the same help rule throughout; for example, after two minutes stuck, provide help and mark the task assisted. Obtain adviser agreement on the rule before sessions.

## 7. Task cards

| Participant | Task sequence | Completion evidence |
| --- | --- | --- |
| Patient/general user | Open the issued test invitation; explain the waiting screen; join when admitted; operate microphone/camera; send a fictional chat; leave | Correct understanding, both endpoints receive media, message arrives, departure observed |
| Clinician | Sign in with prepared test account; create/copy invitation; identify/admit the coded visitor; complete the role-play; end and find history; revoke the test invitation | Intended record and participant, completed call, history visible, revoked link denied |
| IT evaluator | Observe the doctor/guest workflow; open the revoked test link; inspect the published technical results; explain trust boundaries | Records observed outcomes and distinguishes expected denials from outages |

Use a harmless fictional conversation card prepared by the study team. No real patient case, clinical text, bearer link or email belongs in the report. Share invitation links only with the intended test participants. Do not run attack payloads, rate-limit stress, mass record creation or load tests on production during the study.

If AI remains unavailable, mark AI tasks BLOCKED or NOT TESTED with the reason. Do not score a missing AI draft as reviewed or invent a replacement result. A clinician's manual note is not evidence of AI generation quality.

## 8. Questionnaires and interviews

Use the original licensed/approved instrument wording and cite the version used. If the adviser retains SUS, score its ten items using the published odd/even transformation and report the actual valid n. A SUS score is not a percentage or proof of security. If TUQ is retained, use its approved wording and subscale method consistently. An adapted local sheet must be labeled as adapted.

Confirm the ISO/IEC 25010 edition with the adviser. Keep expert ratings separate from executable security cases and timing experiments. A participant agreeing that access feels private cannot close F-2026-11-19-01.

Patient interview prompts: What did the waiting screen mean? What was confusing? Did you understand consent and leaving? What would you need before using a system like this?

Clinician prompts: Was the intended patient and invitation clear? Could you manage admission and ending? What would make you reject an AI draft? What verification would you need before real use?

IT prompts: Which boundary needs improvement? Why is a link different from identity? How should a direct database client be restricted? What testing and operational evidence are missing?

Use participant codes in notes. Two teammates can code interview themes independently and reconcile differences. Report quotations only from actual consented responses with identifying details removed.

## 9. Firebase quota and scheduling

Firebase's documented free daily quota includes 50,000 reads and 20,000 writes, resetting around midnight Pacific time. In November that is around 16:00 UTC+8. A reset is approximate operational guidance, not a promise of recovery at a precise minute. Check current availability and observed usage before sessions; there is no automatic ban on morning sessions if capacity is available.

Billing was disabled at the 19 November inspection. The new read-only audit shows recovery at that time, not the current daily remaining allowance. Keep one doctor workbench open, close it between sessions, and avoid repeated history refreshes. Hidden-tab polling optimizations reduce waste but do not prove a particular saving percentage.

For a planning pilot, record usage before a completed synthetic session and after the usage charts catch up. Record background traffic and chart delay as confounders. Estimate daily capacity from the smaller of available read budget divided by observed reads per session and available write budget divided by observed writes per session, retaining a stated safety reserve. This is a planning estimate, not measured simultaneous-call capacity.

Stop or postpone app tasks when quota errors or unsafe behavior appear. Record the blocked task and reason. Continue only the study activities that do not require the unavailable service. Billing changes, paid services and retention changes belong to a separate owner decision.

## 10. Separate technical performance and AI experiments

Use isolated staging for authenticated timing and 1/3/5 paired-call trials. Record browser/device/network, commit, deployment, independent run ID, sample count, success/error count, median, p95 and the prespecified criterion. Record both endpoints' numeric RTT/jitter/loss/frame-rate data without addresses, tokens or raw WebRTC dumps. Ten users in five calls are different from ten HTTP requests.

For AI evaluation, use a fixed fictional case set and clinician-approved scoring. Counterbalance manual documentation and AI-plus-review order. Count unsupported statements, omitted facts and speaker errors; time the complete review/correction step. Record model/version and availability. Sparse evidence must produce an insufficient-evidence outcome, not invented findings. Do not report clinical accuracy or time savings before these trials exist.

## 11. Recording sheet and immediate owners

Each study row needs participant code/group, date/time/timezone, tested version/environment, device/browser, task ID, independent/assisted/failed/blocked outcome, time, assistance, error category, valid questionnaire completion, and applicable consent. Record skipped items and withdrawals explicitly. Keep raw results securely; only aggregate/redacted results go into shared documents.

| Owner | Immediate deliverable |
| --- | --- |
| App owner | Fix consultation-write integrity; add regressions; verify approved deployed rules |
| App owner + teammate | Successful synthetic paired journey with both endpoints' observations |
| Study team | Adviser-approved forms, task sheets and instruments; no invented data |
| Performance tester | Isolated staging protocol and numeric evidence |
| Paper authors | Separate passing controls, open findings, blocked tasks and untested objectives in Chapter IV |

For professors: "The automated baseline passed, but expanded testing found an open consultation-record integrity issue. Public-page response times met the pilot budget; full consultation performance and study results remain incomplete. The team will preserve the failed cases, remediate the rule boundary, and retest before claiming acceptance."

Companion source: docs/testing/thesis-verification-2026-11-19.md. Evidence: docs/testing/evidence/2026-11-19-reassessment/. Firebase quota reference checked 19 November 2026: https://firebase.google.com/docs/firestore/quotas. The older v2 PDFs remain historical; this document corrects their current-status and guest-anonymity wording.
