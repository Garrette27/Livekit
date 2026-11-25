# Evidence index: 25 November 2026

Scope: source baseline `aa041fe0fa43017856cbff3f69ae83502aaad061` plus the app changes published with this pack. Node 22.23.0 on local Ubuntu/WSL. Synthetic data only; no paid AI requests, cloud media load, production clinical reads/writes, migration or rules release. Final commit identity is discoverable from this folder's Git history; source fingerprints are in `checksums.txt`.

App/artifact checkpoint `25cd516fff4cc81fd9b406745f6d7aad6f7c14f1` is on main. [GitHub run 45496763839](https://github.com/Garrette27/Livekit/actions/runs/45496763839) completed successfully in all three jobs. GitHub's frontend deployment status is successful; the separate livekit project status is failed. Direct Vercel metadata returned a team-scope 403, so the secondary failure cause and active runtime/alias configuration are not independently verified. [Remote receipt](remote-publication.json) distinguishes those facts. No team permissions, deployment settings or production policies were changed to inspect them.

`checksums.txt` fingerprints published **Git blobs**, excluding itself, rather than promising identical Windows working-copy line endings. Verify against the publication commit's blobs; CRLF conversion in a local checkout can legitimately change raw text-file bytes. The manuscript's separate SHA-256 check is on PDF file bytes.

The later [waiting-queue/title checkpoint](queue-title-2026-11-25/README.md) adds six manuscript corrections and documents the non-atomic waiting-capacity gap. Its report matches the current 38-edit manuscript. The table below preserves the initial `25cd516` evidence and does not relabel the capacity finding as passed.

## Initial checkpoint results (`25cd516`)

| Check | Result | Evidence and exact scope |
| --- | --- | --- |
| Application policy/regression suite | PASS, 62 tests | `security.log`; actual source modules with synthetic adapters plus source-contract scripts; ten new defense regressions |
| Firestore/Storage candidate rules | PASS, 14 tests | `rules.log`; `demo-livekit-defense` emulator project only; expected permission-denied diagnostics are positive denial cases |
| TypeScript | PASS | `typecheck.log`, `npm run typecheck` |
| ESLint | PASS, no reported warnings | `lint.log`, `npm run lint` |
| Next.js production build | PASS | `build.log`, `npm run build`; a local compilation, not a Vercel production deployment |
| Complete application dependency inventory | PASS, zero reported vulnerabilities | `audit-app.json`, `npm audit --json`; advisory result at scan time, not absence of all security defects |
| Complete Functions dependency inventory | PASS, zero reported vulnerabilities | `audit-functions.json`, `npm --prefix functions audit --json`; no Functions release |
| Revised manuscript | PASS, bounded document verification | `pdf-verification.json`; 259 pages; 32 substantive edits on 25 pages; preserved dimensions, labels/bookmarks, unchanged source, exact untouched-page renders and outside-region pixels |
| Pricing worksheet | PASS, planning arithmetic only | `../../testing/evidence/2026-11-25-defense-planning/cost-model.json`; Singapore regional rates and explicit hypothetical workloads, not an invoice |
| Authenticated production doctor/patient journey | NOT TESTED | No live account/session acceptance claim |
| Complete unique-visit credential/replay isolation | UNRESOLVED release gate | Different-principal denial is not a unique-visit guarantee; reusable subjects/room names require a stronger generation/grant contract |
| Concurrent cloud WebRTC capacity, complete audiovisual delay, clinician time savings | NOT TESTED | Published allowances, local test counts and questionnaire scores are not substitutes |

## Reproduction

The user's local AGENTS.md contains unrelated product instructions and is intentionally preserved/uncommitted. Its scope guard fails in that dirty root; that failure is **not** an app authorization exploit and was not hidden or fixed by weakening the guard. The final app snapshot was therefore validated in a detached checkout of the canonical baseline, with only these selected changed files applied:

```text
package.json
tests/defense-load-regressions.test.mjs
app/room/[room]/components/shared/RoomShell.tsx
app/room/[room]/patient/page.tsx
app/api/session-chat/messages/route.ts
app/api/summary/generate/route.ts
lib/rate-limit.ts
lib/services/shared/session-participant-auth.ts
lib/services/video-chat/chat-message-store.ts
lib/services/history-summary/summary-projection-service.ts
lib/services/invitation-access/invitation-access-core.ts
```

Validation checkout: `/tmp/livekit-defense-final-20261125`. Installed dependency directories are symlinked from the existing local workspace; lockfiles/dependency versions were not changed. Next.js tasks were run sequentially. This isolation checks the publishable source without altering unrelated edits. It is not a second implementation branch or a claim that the dirty root passes every source guard.

```text
nvm use 22.23.0
npm run test:security
npm run typecheck
npm run lint
npm run build
npx firebase-tools emulators:exec --project demo-livekit-defense --only firestore,storage "npm --prefix functions run test:rules"
npm audit --json
npm --prefix functions audit --json
```

Final successful commands returned zero; the suite logs report zero failed cases. A shell-status reporting wrapper used during one audit attempt itself failed after writing zero-finding JSON; both audits were rerun successfully with direct `&&` exit propagation. No audit assertion was relaxed. Candidate rules were unchanged by this checkpoint; running their emulator tests does not retrieve or deploy active production rules.

## Failed baselines retained

- `initial-red.log`: four new regressions exposed sender multiplication, non-atomic keyed retry behavior, room-only participant authorization and unbounded enrichment concurrency before fixes.
- `review-red.log`: two additional cases exposed queue-row reattribution and buffered-message rebinding.
- `rate-red.log`: authenticated subject isolation and chat refusal failed before the endpoint-budget changes.
- `summary-rate-red.log`: manual summary refusal failed before its guard.

The final ten focused regressions include an additional guest-ordering positive check: a queue notice arriving before or after a scoped authorization request no longer changes the recorded guest principal. The rate test also exercises shared-database enforcement, absent-database fallback and an exception fallback. These do **not** assert a full browser/webhook end-to-end journey or a globally coordinated limit during a database outage.

No raw dirty-root guard log is published because it reproduces unrelated user instructions. Its failure and the clean-snapshot method are explicitly recorded above.

## Deterministic workload evidence, not media load evidence

The real chat bridge is extracted/transpiled from TSX and exercised with ten synthetic local-participant views of a shared 200-message buffer: 200 POST attempts total, not 2,000. A serialized transaction adapter exercises 100 concurrent same-key append calls: one create, 99 duplicates, one session activity touch. Real history projection code returns 100 fixture records with 100 chat queries and no more than six outstanding queries. These fixtures contain synthetic text/identities only. Their operation counts are not a requests-per-second or cloud-latency measurement.

Real media trials require isolated staging, separate synthetic doctor/patient accounts, actual media publication/subscription, controlled devices/networks, timestamps, repeated loads and predefined acceptance/stop criteria. See the proposed protocol in the main researched brief. Do not relabel it PASS before executing it.

## Independent review and decision

One read-only review identified a broader pre-existing unique-visit/replay gap and unsafe room-based queue finalization. This pass removed the unsafe clinical writer, preserved message/session binding and documented the remaining credential-generation release gate. It did not rush an incompatible schema/token migration into the deadline. Optional AI and disabled attachments/scheduling remain outside the core call's availability path.

React review: effects retain primitive participant identity in dependencies; refs hold transient dedup/binding state without forcing renders; cached room ids do not establish evidence ownership; no new JSX control, external component dependency or public clinical payload was added. The map/set live for the bridge lifetime; a future durable outbox and explicit retention/memory policy are not claimed here.

## Document verification and privacy review

The supplied original is not modified or committed. Automated verification compares all 259 page renders, and changed pages were visually inspected alongside contact sheets. The companion briefing is independently generated from Markdown and checked for nonempty pages, working local documentation links and text within margins. Sensitive CV body images, including split contact footers, are masked in the public copy; demo identifiers/link regions are masked separately. The old private rendering, extracted source pages, QA screenshots and unrelated ZIPs/drafts remain uncommitted.

This is bounded publication hygiene, not a certified de-identification or legal review. Historical diagrams/source excerpts remain labeled historical; adviser approval and remaining cross-reference cleanup are still required for academic submission. The excluded earlier individual-call inspection was not included.

## Next unfinished task

Before any unrestricted clinic pilot: implement and adversarially test immutable visit-bound grants, reconcile trustworthy finalization failures, verify deployment/rules/account configuration, run authenticated synthetic acceptance, then execute the controlled paired-media and clinician-efficiency protocols. Push/CI status is separate from these acceptance gates. Keep this status ledger and the two full answers together in future verified commits.
