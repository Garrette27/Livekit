# Administrator follow-up: verified findings and Claude handoff

27 November 2026. Reviewed baseline `eb3b187` (PRs #9-#11), followed by the fixes in this checkpoint. Findings concern implementation and documentation, not the identity or competence of an author. No claim is made to have studied a dataset of failed theses. Typical defense risks below are engineering concerns, not predictions of examination results.

## Verified and addressed here

| Finding | Actual evidence and correction |
| --- | --- |
| Administrator intent lost at login | `/admin` linked to doctor login; both login methods hard-coded Invitations. Dedicated admin entry and a server-derived workspace projection now preserve the destination. |
| Bootstrap authority mislabeled | The account list compared doctor profile/claim provisioning, even for an environment-bootstrapped platform owner. Effective authority now uses provider-verified Auth identity plus server configuration, separately from clinical history. |
| Grant form overlap | Fixed columns and intrinsic input widths overlapped in a 700px source-derived browser fixture. Flexible zero-minimum fields and tablet/phone layouts correct it; a long clinic title is also tested at 320px. |
| Role endpoint account enumeration | The old POST looked up an email before deciding whether the signed-in caller was an administrator. The new early authorization check prevents ordinary callers from probing account existence. |
| Null command crash | JSON `null` caused a property-access exception. The regression failed before the input normalization and now receives 400. |
| Auth outages falsely described as missing accounts | An internal lookup error was collapsed to `null`. Only `auth/user-not-found` now means absent; other Auth lookup failures produce retryable 503 feedback. |

The supplied screenshot confirms a **Doctor** grant. It does not prove an Administrator grant was stored and lost. No live role was changed in this repair. Select Administrator as platform owner, confirm the result, then refresh the recipient's claims. Account creation is not permission assignment.

## Defense-answer inconsistencies corrected

Prior question ids are recorded in [the number map](panel-question-number-map.md); the detailed bank now uses priority order.

- Legacy Q47 said admin had no screen, although PR #10 introduced one. Administrative staff metadata does not imply shared clinical access.
- Legacy Q72 said grants sign recipients out; PR #11 deliberately revokes sessions only on removal. New claims still need token refresh.
- Legacy Q68 said profile authority was completely fixed; the server intentionally retains a transitional privileged-profile fallback.
- Legacy Q42/Q81 overstated per-tab identity separation. A verified Firebase uid takes precedence, and duplicated tabs can share state.
- Legacy Q17 omitted lowering a waiting limit below the existing count. Lowering blocks further new waiting arrivals, not existing visitors.
- Legacy Q59 implied today's build was the surveyed build. The evaluator's actual date/build must be established, not invented.
- Legacy Q64 asserted what the model returned from a dropdown defect. The UI defect alone cannot establish every historical model output.
- Legacy Q80 described immediate revocation as a one-line change. End-to-end revocation needs resource, token, session and failure-policy tests.
- The old 14-slide deck, short Q&A and public ZIP were stale relative to new source and the expanded bank. They are rebuilt with explicit evidence dates.
- Filipino/Tagalog selection and English summary prompting are implementation capabilities, not measured bilingual clinical accuracy.

## Remaining acceptance work

Follow-up source `ec6803a`: 118 regressions, typecheck, lint, production build, six synthetic Chromium viewports and local Firestore rule cases passed. GitHub CI run45917725444 succeeded and the `livekit-frontend` deployment status succeeded. A separate `livekit` deployment reported failure; this is not the frontend project's result. Signed-in production acceptance and Firebase rule/function deployment are not established by these checks.

Additional confirmed findings addressed: historical combined administrator/doctor authority; host emails counted in new direct-entry audience; host UID able to reserve a patient visit; unfinished encounters hidden or mistaken for pending summaries; age incorrectly asserted as proof of deletion; retention pages requiring two delete operations per summary; fixed call overlays consuming tablet video space. No historical encounters were merged/deleted, no production roles changed and no retention run was triggered.

Current role rule: both platform and clinic administrators are non-clinical. APIs deny old combined claims. New Administrator grants write `role: admin`; revoking that role does not restore a legacy doctor profile. Proposed client rules deny admin claims/profiles but must be deployed separately. Server-only bootstrap configuration cannot be read by rules; an environment-only platform owner's historical doctor claims still need an approved migration. Existing media tokens remain a separate window.

The renewed scan is bounded source review plus the specified tests, not a guarantee that every app path is defect-free. Existing owner-only direct buffer updates, cross-service role partial failure, old media credentials and global-before-tenant query limits remain review targets. Do not widen a clinical permission or rewrite records just to silence the demo.

Scheduling follow-up source `69f9c85` implements the approved doctor-booked design behind the existing default-off capability. It passed128 local regressions, seven appointment browser cases and expanded real local Firestore transaction cases, plus typecheck/lint/build. GitHub CI45921466995 and the frontend deployment succeeded. These are not signed-in production acceptance. Do not reimplement the completed plan or enable the flag before production rules/indexes, existing-data and contact-retention review, and signed-in staging acceptance. See the [review rulings and deferred minor](../testing/evidence/2026-11-27-appointments/implementation-review.md). Appointments grant neither admission nor clinical evidence and were not surveyed.

1. Run signed-in staging acceptance with separate synthetic platform-owner, clinic-admin, doctor, patient and unapproved accounts. Prove the intended landing page, cross-clinic denial, doctor-versus-admin grant and post-refresh result.
2. Review the full privileged-role lifecycle: legacy-profile migration, old Firebase ID tokens, accepted LiveKit tokens, account disablement, recovery and loss of access during a call. No production role migration is authorized by this document.
3. Audit cross-service partial failure: Auth custom-claim changes, Firestore profile metadata and audit writes are not one cross-provider atomic transaction. Define idempotent reconciliation before claiming fully atomic role administration.
4. Bound and paginate administration/history queries. The current admin list selects up to 200 clinician profiles globally before clinic filtering; this can omit a clinic's staff and does not prove tenant-scale completeness. Measure rather than promise latency.
5. Re-test visit binding across every summary, chat, transcript, webhook and already-issued credential path. Queue fencing tests do not prove all downstream replay cases.
6. Measure paired-call quality/concurrency and bilingual evidence quality. Existing emulator and regression counts do not supply these results.

## Prompt to give Claude

> Pull current main without overwriting local changes. Read AGENTS.md and the access, invitation, consent and production-readiness notes. Read `docs/thesis-defense/admin-entry-followup-plan.md`, this finding register, the priority Q&A and its old-to-new map. Do not repeat fixed routing, bootstrap label, null-input or form-width work unless a test demonstrates a new regression.
>
> First run the current tests and inspect the actual server policies. Use only synthetic staging identities. Verify admin sign-in/signup is identity-only; an unapproved user cannot assign themselves roles; platform owners and clinic admins land in /admin; Doctor and Administrator grants remain distinct; another clinic's accounts cannot be managed. Explicitly refresh token claims in the tested flow. Do not modify production roles, secrets, patient records or retention settings without separate authorization.
>
> Next investigate cross-service role-update partial failures and globally limited-before-filtered account queries. Propose the smallest deep-module repair, write a failing behavior regression first, preserve ownership and patient-account boundaries, then run typecheck, lint, the complete security suite and a production build. Retain the failed baseline and separate the passing evidence. State any remaining legacy-profile or revocation window honestly rather than deleting compatibility at deadline.
>
> Preserve the non-clinical administrator boundary and test old combined claims. Vercel does not deploy Firestore Rules or Firebase Functions. Retention is opt-in and does not purge all copies/backups; age is not a deletion receipt. Keep distinct encounter ids and fresh-entry consent. The approved scheduling plan is implemented at69f9c85; do not rebuild it. Complete its documented deployment/data/retention and signed-in staging gates before proposing enablement, without changing production configuration or data absent separate authorization. Preserve UID-scoped UI, immutable retry receipts, transaction locks and expected-version checks.
>
> Keep the official thesis at 259 pages with original numbering, objectives, reported survey findings and expense amounts. Update only bounded, implementation-grounded wording. Maintain all panel topics and the numbering map, include Tagalog/Taglish limits, and rebuild the Q&A PDF, notes-bearing PPTX, manuscript verification and public-safe download archive. Never publish private CV appendices, real emails, clinical content, tokens or the excluded earlier individual-call inspection. Push each verified code checkpoint with its docs through the approved direct-main workflow, record the exact commit and remote CI, and do not call a Ready deployment complete production acceptance.

## Sources for the design choices

- [Firebase custom claims and propagation](https://firebase.google.com/docs/auth/admin/custom-claims): claims are server assigned; refreshed ID tokens carry newly granted claims.
- [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens): authentication and revocation checks are distinct decisions.
- [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow): narrow layouts must retain information and usable controls.
- [Teams lobby controls](https://support.microsoft.com/en-us/teams/meetings/using-the-lobby-in-microsoft-teams-meetings) and [Zoom attendance history](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0073594): operational participant controls and richer attendance details are separate surfaces.
- [Firebase scheduled functions](https://firebase.google.com/docs/functions/schedule-functions) and [idempotent function guidance](https://firebase.google.com/docs/functions/tips): scheduled cleanup needs repeat-safe work, bounded operations and explicit failure handling.
- [HL7 Appointment](https://hl7.org/fhir/appointment.html): appointment planning and actual encounters are separate resources, used here as design precedent only.
- [Repository invitation interaction rationale](../invitation-flow-design.md): object-centered workbench, visible state, progressive disclosure and modeless feedback.
