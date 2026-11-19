# TeleConsole remediation update

19 November 2026 | UTC+8 | Local candidate; publication pending

## Current decision

The demonstrated consultation-write bypasses have a tested local fix. Related history-reassignment, patient-history privacy and delayed-leave defects found during review are also addressed in the candidate. **Production security is not yet marked PASS:** the application and Firebase rules have not been published or retested on production. Full consultation performance remains NOT TESTED.

This update supplements the earlier 19 November verification report. Its failed production-rule baseline remains in the evidence record. The candidate branch is codex/consultation-integrity-fix, based on 0be08989759dbbe6aaef53c02444aa0121cb4baf. It is a thesis prototype change, not certification or a complete security assessment.

## What changed

| Boundary | Defect reproduced | Candidate behavior |
| --- | --- | --- |
| Direct consultation writes | A patient could create another patient's record; an owner could change identity or delete it | All Firebase client consultation writes are denied, including privileged client claims; authorized server commands remain the write boundary |
| Historical linking | Browser session IDs or invitation-email matching could reassign a historical visit and the current room record | The authenticated legacy linking endpoint acknowledges old requests without changing records; IDs and emails are not ownership evidence |
| Patient history | Email-matched records could be returned without matching UID; AI drafts and queue details were included | Queries use recorded UID only, reject conflicting identity fields, and return encounter metadata without clinician drafts or room-wide queue details |
| Signed-in history continuity | Media identity differed from Firebase UID, previously repaired by unsafe linking | Admission signs an optional Firebase UID binding separately from the media identity; tracking consumes the verified claim and ignores body UID |
| Late leave and finalization | An earlier visit could overwrite or finalize a later visit in the same room | Current identity/session checks and transactional projection updates protect the later encounter; finalization targets the exact session and keeps patient labels separate |

Direct invitation issuance uses the identity obtained from the verified Firebase token. Queued admission uses the server-recorded registered-profile identity only when the row is explicitly non-anonymous. Guest and legacy tokens continue to use pseudonymous media identities; a typed email does not acquire a Firebase ownership claim. LiveKit room identity, media grants, waiting-room admission policy and optional transcription consent are unchanged.

## Design and compatibility

The selected pattern is a **server-owned command boundary with identity-bound read projections**. It centralizes ownership and lifecycle decisions instead of duplicating clinical write authorization in browser rules. The alternative was a field allowlist for direct client writes; it adds create/update schema and lifecycle duplication without serving an existing consultation client writer. Repository search found consultation writes in Firebase Admin services, while browser room/call bookkeeping uses other collections.

The cost is that historical self-service linking is removed. Guest visits and legacy records with no reliable account UID are not automatically attached to a signed-in profile. That repair needs a separately authorized, evidence-backed process. No records were migrated or deleted. Records already carrying consistent patient UIDs remain eligible, including the legacy metadata location. Doctor history and clinician summary access remain separate from patient history.

The optional signed UID claim keeps new signed-in visits visible without trusting cached browser IDs. It does not change a link into identity proof. Existing issued tokens do not gain the claim retroactively; reopening/revalidating an invitation can obtain a newly issued credential. No guest's historical record is silently adopted on login.

## Current-data reconnaissance

Production inspection remained read-only and field-masked. Only aggregate field types and lifecycle counts were retained. No names, emails, transcript text, tokens, document IDs or clinical content were recorded.

| Collection | Count | Identity shape observations |
| --- | --- | --- |
| consultations | 119 | 98 root/metadata patient UID strings; 1 null-patient shape; 19 without projected identity fields; 1 creator-only legacy shape |
| consultationSessions | 53 | 34 root/metadata patient UID strings; 12 null-patient shapes; 7 root-only patient UID strings |
| call-summaries | 9 | 8 root/metadata patient UID strings; 1 without patient UID fields |

These are type/presence counts, not proof that every pair of stored UID values agrees. The candidate rejects conflicting values rather than guessing. The active production rules retrieved during this work still have normalized SHA-256 c1300f7431b5f3da03203a59f3ac838b879eabe9f216065a02aa0d9ef0c83cef. Candidate rules have normalized SHA-256 dd864ad4bb41db008b24e853e83c293a5c515a2a6f57e56c938587bfdbee9876. Hash normalization removes CR characters and trims surrounding whitespace.

## Verification register

| Check | Result | Practical limit |
| --- | --- | --- |
| Maintained application regressions and source contracts | 43/43 PASS plus both contract scripts | Synthetic IO adapters exercise real handlers/services and policies; no production attack writes |
| Maintained Firestore/Storage rule suite | 12/12 PASS | Emulator, including allowed current/legacy participant reads and denied client create/update/delete |
| Original two attack reproductions | 2/2 PASS against candidate rules | Unsafe writes now denied in emulator; deployed policy is still the baseline |
| Mobile Chromium regressions | 29/29 PASS in 19.9 s | Local test server; waiting-room API responses are mocked |
| Typecheck, lint, production build | PASS, exit zero | One pre-existing unused sanitizedEmail lint warning; generated Next.js types checked sequentially |
| Production dependency audits | PASS, zero findings | Fresh application and Functions production-only audits; lockfiles unchanged |
| Independent focused source review | No remaining concrete blocker | Reviewer independently ran 30 queue/auth cases; no production or media verification |
| Production application/rules retest | NOT TESTED for candidate | Release approval and publication still required |
| Paired call, media quality and capacity | NOT TESTED | Requires isolated staging, synthetic participants and numeric WebRTC measurements |

The red phase established failures in client create/update/delete denial, pending-ID reassignment, invitation-based visibility, malformed legacy payloads, email-only history access, patient draft/queue exposure, identity binding, stale leave, concurrent leave commit, and exact-session finalization. After the fix, maintained regressions pass. Temporarily removing the direct-issuance UID binding made its focused regression fail, and the binding was restored.

An early typecheck overlapped a local Next.js test server regenerating .next/types. Its missing generated-file errors were a runner collision; the final sequential invocation passed against stable generated output. The collision is recorded in runner-notes.json; the intermediate raw log was not retained and is not counted as an application PASS.

## Remaining publication and evaluation

Review the candidate diff, then publish the application and the rules together as a coordinated release. Application publication is needed because the history/linking fixes live in Next.js; publishing only Firebase rules leaves the old server route available. Keep the original retrieved rules as rollback source. After publication, retrieve active rules, compare the candidate hash, inspect the frontend commit/deployment, rerun safe anonymous rejection probes, and complete a synthetic doctor/patient journey with both endpoints observed.

The earlier public HTTP pilot remains a public-page result: landing p95 69 ms and access-denied p95 1,297 ms, ten requests each. This patch does not establish an improvement in video latency, user capacity, cost, AI quality or availability. Removing unnecessary email-based linking also removes its queries and writes, but no production savings percentage is asserted.

Suggested professor-facing status: "The additional assessment findings have been addressed in a tested local candidate. The failed baseline is preserved. Production acceptance remains pending coordinated publication and retest, while authenticated media and concurrent-call performance still require the planned experiments."

Evidence: docs/testing/evidence/2026-11-19-remediation/. Baseline source/report remains in the earlier 19 November reassessment package. These documents contain no respondent results or clinical material.
