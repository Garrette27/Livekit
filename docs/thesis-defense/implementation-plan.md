# Defense hardening and delivery plan

Goal: preserve the 259-page manuscript and reported budget, publish coherent briefings, and repair reproduced chat/participant-boundary defects without changing the core call workflow.

Architecture: retain the existing server-owned policy boundary and repository abstractions. Persist chat only from its sender, atomically deduplicate keyed writes, and authorize against the recorded encounter participant as well as the room. Bound history enrichment concurrency without claiming pagination or unlimited history.

Constraints: no new paid provider workload, no production data writes, no rules release, no major upgrades, no faculty UI or open doctor self-provisioning. Preserve unrelated AGENTS.md edits. Never publish the excluded earlier individual-call inspection. Keep all 259 pages and existing numbering; preserve budget amounts and total. Local tests do not establish cloud media capacity.

Review focus: received versus local messages; simultaneous retries; a different patient with a valid same-room token; guest transport identity and doctor ownership; large history hydration; optional AI outages; privacy in the public PDF.

## Work items

- [x] Write and run failing regressions for sender-only persistence, atomic keyed chat writes, recorded participant authorization and bounded history hydration.
- [x] Make the smallest implementation changes in RoomShell, chat-message-store, session-participant-auth and summary-projection-service; rerun the focused tests and full completion gate.
- [x] Run synthetic local workload checks. Report exact operations, fixtures and environment; do not substitute them for paired WebRTC trials or provider limits.
- [x] Move the researched briefing to docs/thesis-defense; add the current-prompt answer, page-change list, Messenger copy, panel questions, three-writer assignments and a dated evidence index.
- [x] Revise the PDF with bounded text changes, preserve financial amounts, verify all pages and inspect changed-page renders. Check for sensitive identifiers/credentials before publication.
- [x] Review the scoped staged diff, commit and push directly to main, confirm the remote SHA and report CI separately from deployment/acceptance.

Design alternatives: a full pagination/tenant/queue rewrite could improve long-term scale but is too broad for the requested deadline; doing nothing leaves reproduced attribution/authorization defects. The selected approach makes local, testable investments behind the existing interfaces. Native implementation in this session with one independent read-only code review, as required by the review skill. No production load testing.

Review checkpoint: sender-only chat, atomic keyed writes and bounded history enrichment passed four focused regressions and the 56-case full suite. The reviewer identified broader, pre-existing visit-generation/replay and room-based departure issues. A principal match must not be described as proof of a unique visit. Fix the unsafe departure writer and buffered-message rebinding, test normal guests in both exit orderings, and retain unresolved visit-generation scope explicitly rather than calling overall isolation passed.

Final code checkpoint: ten focused cases and 62 full-suite cases pass; 14 candidate-rule emulator cases pass; typecheck, lint and build pass; both complete dependency audits return zero findings. The unsafe queue clinical writer is removed, buffered messages keep their original binding, guest authorization survives either queue-notice ordering, and new authenticated chat/manual-summary budgets refuse before persistence/generation. The unique-visit generation/replay protocol remains a documented real-clinic release blocker. If scoped tracking and verified event completion are both lost, reconciliation is required; the queue row is not an alternate clinical authority.

Final delivery review: bounded PDF edits preserve 259 pages and expense amounts. Public-only CV/demo identifier masks are separate from research revisions. No production reads/writes, paid provider trials, rule release, new faculty UI or self-provisioned doctor role was introduced. See evidence/README.md for the canonical-source validation checkout used to preserve the unrelated local AGENTS.md edits.

Published app/artifact checkpoint: `25cd516fff4cc81fd9b406745f6d7aad6f7c14f1` on main; all three jobs of GitHub run `45496763839` completed successfully. GitHub reports the livekit-frontend deployment successful and the separate livekit project failed. Direct Vercel metadata inspection returned 403 for team scope, so active runtime/alias configuration and the secondary failure cause remain unverified. Evidence/remote-publication.json records the exact observation. This follow-up documentation receipt does not change app code or imply production acceptance.
