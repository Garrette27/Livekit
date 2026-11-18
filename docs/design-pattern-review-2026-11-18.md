# Design-pattern and AGENTS.md review

18 November 2026 | Branch `codex/thesis-login-performance`

## Goal statement

The project goal is not only to pass the thesis performance and security
tests. The software must also follow proven design patterns that fit a secure
teleconsultation workflow: getting the intended patient into the intended
consultation safely, keeping clinical data private, and keeping the call usable
when optional services fail. A test result counts only when it comes from code
that follows these patterns. `AGENTS.md` (Delivery priority) now records this
requirement.

## Patterns in use and why they fit

| Concern | Established pattern | Where | Why it fits this product |
| --- | --- | --- | --- |
| Invitation access | Scoped, signed capability token, re-validated server-side on every token issue | `lib/invitations/token-utils.ts`, `app/api/invite/*` | A link proves possession, not identity. The server checks signature, persisted record, room, status, expiry, owner and use policy each time, so UI state is never the boundary. |
| Admission | Least privilege: waiting-room token cannot publish or subscribe media | `lib/invitations/token-utils.ts` (`canPublish`/`canSubscribe` gated) | An unadmitted visitor cannot see or hear the consultation even with a valid link. |
| Visit reservation | Atomic transaction for counter, audit and waiting row | `lib/repositories/*` (`runTransaction`) | Prevents double-spending a one-use invitation under concurrent clicks. |
| Data access | Repository pattern plus defense in depth (server checks and Firestore rules) | `lib/repositories/`, `firestore.rules`, `functions/test/security-rules.test.cjs` | One place owns each query. Rules deny cross-doctor reads even if a server path regresses; emulator tests prove it. |
| Dependency outage | Fail closed with an explicit, retryable error | `app/api/user/role-conflict/route.ts` (HTTP 503 `role_check_unavailable`) | Firestore quota exhaustion no longer appears as a crash or bypasses role verification; the user gets an honest retry message. |
| Live queue | Invalidate-then-re-query: realtime events are signals, the authenticated API projection is authoritative | `lib/waiting-room/waiting-queue-coordinator.ts`, `hooks/useWaitingQueue.ts` | Raw snapshot rows never become UI state, so room/expiry/ownership filtering cannot be skipped by the listener path. |
| Read cost | Request coalescing and shared polling (the SWR/React Query strategy) | `fetchWaitingQueueOnce`, `subscribeToWaitingQueuePoll` | Several panels showing the same queue issue one request per interval instead of one each. Directly addresses the 50K/day read-quota incident. |
| Background tabs | Page Visibility API pause and reconcile on return (new, commit `10ca271`) | `subscribeToWaitingQueuePoll` | A forgotten doctor tab no longer spends reads all day; returning to it refreshes once. Live events and clinician actions still refresh immediately. |
| Account privacy | No account-existence disclosure (anti-enumeration, new, commit `382ac86`) | `app/api/invite/create/route.ts` | The route no longer reveals whether an email has an account and saves one Firestore read per invitation. A regression contract keeps it out. |
| AI documentation | Human-in-the-loop lifecycle `processing → ready → reviewed`, consent-gated, evidence-grounded | `lib/services/summary-management/`, `lib/services/history-summary/` | AI output is a draft until a clinician reviews it; reviewed text is never overwritten; missing evidence yields `Unknown`, not invented findings. |
| Delivery | CI quality gates, with the dependency audit isolated in its own job (new) | `.github/workflows/quality.yml` | An upstream advisory with no patch can no longer hide whether tests, lint and build pass. The audit still fails visibly. |

## AGENTS.md compliance findings

| Rule | Result |
| --- | --- |
| Invitation link is a capability, server validates everything | Follows. |
| Never log raw tokens, IPs, user agents, emails, clinical text | Follows in scanned paths: error logs print error objects only. |
| Never display the `999999` reuse sentinel | Follows: `lib/invitations/invitation-presentation.ts` renders "reusable until expiry". |
| No Firebase Dynamic Links; no device/location verification claims | Follows: none found. |
| RBAC `faculty_reviewer` stays backend-only | Follows: regression asserts no `app/faculty` or `app/professor` route. |
| Focused regression for every fixed bug | Follows: each change in this branch adds or updates one. |
| Completion gate (typecheck, lint, security tests, build) | Passed on `08bd5bb`. |

## Issues found in AGENTS.md itself

1. **Mixed product instructions.** Roughly the first 120 lines describe a
   different product (a marketing CMS page builder, HR applicant tracking,
   Supabase, "RideMax", ADR numbers and files such as
   `docs/state-transition-loop.md` and `docs/architecture-vocabulary.md` that do
   not exist in this repository). The thesis section says it takes priority, so
   this does not cause wrong behavior today, but it adds noise for every
   contributor and agent. Recommendation: move the unrelated product rules out
   of this repository's `AGENTS.md` (owner decision; not changed here).
2. **Magic number repetition.** `999999` is written in five places
   (`app/api/invite/create/route.ts`, `components/InvitationForm.tsx`,
   `components/InvitationManager.tsx`, `app/create-room/[room]/CreateRoomClient.tsx`,
   `lib/invitations/invitation-presentation.ts`). It is never shown to users, as
   required, but a single named constant would remove the information leakage
   that the design principles at the top of `AGENTS.md` warn against.

## Remaining honest limits

- The full dependency audit fails on GHSA-fc5q-39xc-vjpf (picomatch ≤ 4.0.7, no
  patched release). It is reached only through ESLint tooling
  (`eslint-config-next`), is not shipped to browsers or servers, and the
  production-only audits report 0 findings.
- No production read-savings percentage was measured for the queue changes.
- Authenticated, WebRTC and concurrent-call performance still require the
  staging protocol in `docs/testing/remaining-experiments.md`.
