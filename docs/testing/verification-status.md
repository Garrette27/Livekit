# Security and performance verification ledger

## Required checkpoint workflow

This is the current status index; dated reports are immutable historical evidence.
For every security/performance change or retest:

- [ ] Fetch remote state and preserve unrelated local edits before updating.
- [ ] Read AGENTS.md and relevant product/design contracts; state the tested SHA.
- [ ] Define the claim, threshold, environment and scope before running the test.
- [ ] Retain failed results as well as passes in a new dated evidence directory.
- [ ] Record command, exit code, counts, limitations and evidence checksums.
- [ ] Update this ledger and link the dated report when a result changes.
- [ ] For behavior changes run focused regressions, security tests, lint,
  typecheck and build; run Next.js tasks sequentially to avoid .next collisions.
- [ ] Review staged changes for secrets, patient data and unrelated files.
- [ ] Commit and push the code AND its updated status/docs/evidence at each
  coherent verified checkpoint, not only at the end of a long session.
- [ ] Confirm remote commit/CI. Distinguish a pushed commit, deployed application,
  deployed rules, and successful authenticated production acceptance.
- [ ] Record the next unfinished task so an interrupted audit resumes accurately.

Never mark a test passed by relaxing an assertion, hiding a failing audit, or
substituting HTTP timing for WebRTC timing. Use PASS, FAIL, BLOCKED, NOT TESTED,
or HISTORICAL PASS, always with scope. New advisories can invalidate old scans.

## Current follow-up: 25 November 2026 - waiting queue and title defense

Source review is pinned to `9d53610`. No app behavior, rules, dependency, financial
amount or survey-result changes are introduced. The official title stays intact.
The new teaching guide, 32-question panel PDF, editable 14-slide PowerPoint with
notes, offline handout and six manuscript corrections extend the existing pack.

| Claim | Result | Evidence / limits |
| --- | --- | --- |
| Queue capacity pre-check interleaving | REPRODUCED GAP; hard-cap guarantee NOT PASSED | [Synthetic actual-source audit](../thesis-defense/evidence/queue-title-2026-11-25/source-audit.json): 9 initial rows, target 10, two distinct arrivals both reserve, final count 11; no production workload or overshoot bound |
| Transactional invitation-use counter | Preserved in the same fixture | Two successful reservations increment the use count twice; this does not establish atomic waiting-slot accounting |
| Queue policy/source description | Reviewed | [Queue/title guide](../thesis-defense/waiting-queue-and-title-defense.md): direct allowlist exception, manual oldest-arrival worklist, admitted versus connected, patient polling and doctor invalidation |
| Manuscript document checks | PASS, 259 pages | [Current PDF report](../thesis-defense/evidence/queue-title-2026-11-25/pdf-verification.json); 38 edits on 31 pages, including six follow-up corrections; numbering/budget preserved |
| App security and CI | Prior checkpoint retained, not expanded by these docs | The 62 regressions/14 emulator cases and successful source CI remain dated below; they do not prove the newly audited capacity invariant |
| Complete unique-visit replay isolation, media maximum and clinician efficiency | UNRESOLVED / NOT TESTED | No new production acceptance, provider load, paid AI or clinical capture |

Next: atomically owned waiting capacity with complete release/reconnect/expiry
tests, immutable visit grants, hidden waiting-preflight review, then staged
authenticated media/quality/load acceptance. A documentation correction is not
an application fix. See the follow-up evidence index for artifact validation and
the exact publication receipt when available.

## Earlier checkpoint: 25 November 2026 - manuscript and bounded app hardening

Fetched/fast-forwarded to `aa041fe`; preserved unrelated local AGENTS.md edits
and untracked drafts/ZIPs. The publishable app snapshot was tested in a clean
detached baseline checkout because the user's dirty AGENTS.md triggers the
repository's unrelated-product scope guard. That guard was not weakened.

| Claim | Result | Evidence / limits |
| --- | --- | --- |
| Application policy/regression and source contracts | PASS, 62 tests | [Defense evidence](../thesis-defense/evidence/README.md); ten new focused cases; synthetic adapters, not real media clients |
| Candidate Firestore/Storage rules | PASS, 14 tests | Same evidence directory, `rules.log`; emulator project only; no production policy release/read in this checkpoint |
| Typecheck, lint, production build | PASS | Final logs; lint has no reported warnings; local build is not deployment |
| Complete application and Functions npm audits | PASS, zero reported findings | Dated audit JSON; does not establish absence of authorization/design flaws |
| Chat persistence amplification and keyed retry atomicity | PASS, deterministic local counts | Ten synthetic views/200 authored messages yield 200 POST attempts; 100 same-key attempts yield one create and one session touch |
| Different-principal denial and queue/buffer safety | PASS, specified local cases | Signed principal checked as well as room; queue notice cannot reattribute latest clinical record; old messages retain original session |
| Authenticated chat/manual-summary operation budgets | PASS, route refusal and subject-isolation cases | 60/min/principal/session persistence attempts; 3/min/doctor manual summary attempts; fallback is process-local, not a global spend/concurrency cap |
| History enrichment concurrency | PASS, local peak <= 6 | 100 fixture records, all returned; total read volume unchanged; not complete history pagination |
| Complete unique-visit credential/replay isolation | UNRESOLVED release gate | Reusable principal/queue keys are not immutable encounter grants; see full follow-up answer |
| Revised manuscript integrity | PASS, document checks only | 259 pages; 32 substantive edits on 25 pages; expense amounts/total and numbering preserved; public-copy privacy redactions separately listed |
| Authenticated production acceptance, cloud video capacity/complete audiovisual delay, clinician efficiency | NOT TESTED | No provider load, paid AI calls or production clinical writes/reads performed |
| Published app checkpoint CI | PASS for `25cd516` | All three jobs of [run 45496763839](https://github.com/Garrette27/Livekit/actions/runs/45496763839) completed successfully; later receipt-only docs do not change tested app code |
| Deployment reporting | MIXED / direct verification BLOCKED | GitHub reports livekit-frontend successful, separate livekit project failed; Vercel team-scope metadata returned 403; no authenticated runtime acceptance claim |

Deliverables: [defense pack](../thesis-defense/README.md), including both full
written answers, page-change register, Messenger briefing, scripts and revised
public-copy PDF. The excluded earlier individual-call inspection is not included.
The original supplied PDF is untouched; CV images are omitted only from the
public repository copy. Clinical records were not published.

Design decision: sender-owned persistence and transactional idempotency hide
complexity behind existing modules; bounded workers limit per-request fan-out.
Queue rows no longer act as clinical finalization authority. If scoped tracking
and trustworthy completion events are both lost, reconciliation is required.
Unique-visit grants need a separately reviewed protocol, not a rushed field-only
migration. These are real-clinic release gates, not improvements claimed complete.

Next unfinished work: implement immutable visit-bound grants and adversarial
old-credential tests, then verify authenticated staging acceptance and execute
controlled paired-media/clinician studies. Keep code, changed docs, failed and
passing evidence together at each verified push. No broad production-security
or clinical-readiness PASS is made.

## Historical defense-readiness checkpoint: 22 November 2026 (defense on 23 November 2026)

The thesis defense is tomorrow, 23 November 2026. This checkpoint is a
pre-defense hardening pass over a93d635 (latest remote main at fetch time).
Rules for this pass, in priority order:

1. Do not break the working doctor/patient call. No risky refactors, no new
   features, no dependency majors, no production data writes or rule releases
   without separate review.
2. Follow AGENTS.md: fix only confirmed defects with a focused regression that
   fails first; keep established patterns (server-side policy boundary, scoped
   bearer invitations, atomic reservation, shared quota/outage classification).
3. Run the full gate (security/regression tests, rules emulator suite where
   available, typecheck, lint, build, dependency audits) and push each verified
   checkpoint to main immediately, so an interrupted session still leaves a
   defensible, deployed state.
4. Report honestly: PASS / FAIL / BLOCKED / NOT TESTED with scope. Never claim
   HIPAA compliance, certification, WebRTC capacity or clinical accuracy.

Progress for this pass is recorded in
[defense-readiness-2026-11-22.md](defense-readiness-2026-11-22.md).

| Claim | Current result | Evidence / limits |
| --- | --- | --- |
| Policy, regression and source-contract tests | PASS, 52 | `evidence/2026-11-22-defense/policy-after.log`; red phase in `red-phase.json` |
| Firestore/Storage rules suite | PASS, 13 | `rules-after.log`; synthetic emulator; new clinician-only room/call create test |
| Typecheck, lint, production build | PASS | lint now 0 warnings |
| npm audit, application and Functions | PASS, 0 findings | time-bound advisory result |
| Remote CI and frontend deploy for aad4136 | PASS | Quality and security success; GitHub deployment status success |
| Production smoke probe | PASS, status codes only | pages 200; unauthenticated/wrong-secret 401; security headers present |
| Clinician-only room/call creation in production | NOT RELEASED | rules change awaits the manual Firebase deploy workflow |
| Authenticated consultation, media, capacity | NOT TESTED | separate protocols still required |

## Previous checkpoint: 22 November 2026

Remote fetched at 16df312; no newer commits were available. See
[follow-up report](follow-up-2026-11-22.md) for current data, reproduced bugs,
design tradeoffs and limits. Local unrelated AGENTS.md edits remain preserved.

| Claim | Current result | Evidence / limits |
| --- | --- | --- |
| Application authorization and efficiency regressions | PASS, 48 | `evidence/2026-11-22-retest/policy.log`; includes reviewer malformed/blank denial and stale poll cleanup regressions |
| Remote CI / frontend status for bee1843 | PASS | Quality and security run 44977057053: application, firebase-functions and application-dependency-audit all success; GitHub frontend deployment status success, not a live authenticated acceptance test |
| Firestore/Storage repository rule suite | PASS, 12 | Same directory, `rules.log`; synthetic emulators |
| Typecheck, lint, production build | PASS | Same directory; pre-existing sanitizedEmail warning remains |
| Full application and Functions audits | PASS, zero returned findings | Same directory audit JSONs; time-bound advisory result |
| Read-only current Firestore recon | PASS, bounded masked read completed | `evidence/2026-11-22-recon/`; 208 invitations, 156 waiting rows, 55 completed sessions; no clinical content copied |
| Active Firestore source | PASS, matches repository | Recon result; no rules release needed |
| Queue lifecycle efficiency | PASS, deterministic count budget | Stale repeated unsubscribe no longer creates a second timer/listener; no cloud billing or media capacity inference |
| Reserved reviewer assignment policy | PASS, focused regression | Blank IDs and malformed fields/dates deny; faculty remains backend-only, not enabled |
| Current authenticated production / media / capacity / clinician efficiency | NOT TESTED | Existing protocols still required; no paid AI, media capture or cloud load performed |
| Direct Vercel commit and active Storage policy | NOT VERIFIED in this checkpoint | Prior team-scope and Storage-read restrictions remain; local passes do not imply live acceptance |

Next: authenticated synthetic acceptance
and controlled paired media trials remain separate. Never reuse old invitation
links from screenshots: every stored-active link was expired at the recon read.

## Historical checkpoint: 19 November 2026

Pulled `1c7bace` (PR #8). Working-tree AGENTS.md edits were preserved, not
published. Clean detached verification worktree: `/tmp/livekit-audit-20261119`.
Latest reviewed report: [consultation integrity remediation](consultation-integrity-remediation-2026-11-19.md).

| Claim | Status entering this checkpoint | Evidence / limits |
| --- | --- | --- |
| Application authorization/identity regressions | PASS, 46 | `evidence/2026-11-19-checkpoint/policy.log`; actual services with synthetic adapters; three new efficiency/outage cases |
| Firestore/Storage candidate rules | PASS, 12 | `evidence/2026-11-19-checkpoint/rules.log`; emulator only |
| Original consultation-write attacks denied | HISTORICAL PASS, 2 | Same directory, `supplemental-green.json`; not production writes |
| Mobile Chromium workflow | HISTORICAL PASS, 29 | Same directory, `e2e-summary.json`; mocked waiting APIs |
| Full application and Functions dependency inventories | PASS, zero findings returned today | Fresh full audit JSONs in checkpoint directory; prior failing scans preserved; no claim of advisory remediation by code changes |
| Typecheck, lint, production build | PASS | Checkpoint logs; lint retains the existing sanitizedEmail warning |
| Latest application deployment | BLOCKED direct metadata verification | Vercel team scope unavailable; GitHub frontend status success for 1c7bace is only indirect evidence |
| Latest Firestore rules deployment | PASS, reviewed source deployed and retrieved | `evidence/2026-11-19-rules-release/`; source matches merged policy; 12 equivalent-source emulator cases pass; original drift evidence preserved |
| Production anonymous API denial controls | PASS, 4/4 | Release acceptance.json: doctor access, role conflict, patient history and queue list return JSON 401; no authenticated journey claim |
| Remote CI for add9a04 | PASS | Quality and security completed successfully before rules release |
| Queue request/timer efficiency | PASS, deterministic local budgets | 100 consumers share one fetch/timer, isolated scopes, failed-fetch recovery, 100 visibility cycles and zero cleanup leaks; no cloud savings percentage |
| Database outage classification | PASS, targeted matrix | Availability codes recognized; permission/authentication/message-only errors do not become retryable outages |
| Public HTTP pilot | HISTORICAL PASS, n=10/page | 18 Nov pilot; not authenticated or media latency |
| Media latency / concurrent calls | NOT TESTED | Requires synthetic paired media clients and isolated staging |
| Clinician documentation efficiency | NOT TESTED | Reviewer study required; no paid AI requests authorized |

Pattern: an append-only evidence history with a single current-status projection.
It avoids rewriting failed baselines or duplicating mutable PASS claims across
reports. This ledger is evidence navigation, not a certification score.

Authorized follow-up: the owner approved deployment; Firestore rules only were
released to livekit-5eef6 on 19 November. No data migration, Storage policy or
Functions release occurred. See [release acceptance](rules-release-2026-11-19.md).
Next unfinished task: restore Vercel team access for direct application commit
inspection and run a synthetic authenticated doctor/patient journey. Media,
capacity and clinician-review trials remain separate. No paid AI, cloud load or
patient-data writes were performed. Local unrelated AGENTS.md edits are preserved.

Reproduction and source hashes: `evidence/2026-11-19-checkpoint/scope.md`.
No new mobile E2E claim is made: the 29-case result above is historical.
