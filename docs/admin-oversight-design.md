# Administrative oversight: control plane and clinic scope

28 November 2026. This is a researched design note and bounded source review,
not evidence of a deployed analytics product, clinical validation or compliance.
The thesis remains a single-clinic study. Staff provisioning contains clinic
scope preparation; that does not establish a complete commercial tenant platform.

## Selected pattern and tradeoffs

Use a platform **control plane** for tenant lifecycle and operating the service,
with a **clinic workspace** for delegated staff administration. Keep clinician
work tied to the owning doctor's separate identity. AWS describes a provider
administration application apart from the tenant application; Azure similarly
separates cross-tenant provisioning and maintenance from application use. This
is architectural precedent, not a claim that either company implements this
prototype or has approved it. [AWS control/application planes](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/control-plane-vs.-application-plane.html),
[Azure multitenant control planes](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/control-planes).

The alternative is one all-powerful clinical/admin dashboard. We reject it
because a routine staff or billing task would inherit unnecessary clinical
access. Separate identities and scope checks add sign-in and support work, but
limit the authority exercised during administrative tasks. Keep the shared
administration implementation deep: the server resolves authority and clinic
scope; different entry pages do not duplicate permission policies. Permission
and object ownership must be checked on every protected request. [OWASP
authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Current source versus proposed oversight

| Surface | Implemented in source | Proposed next capability |
| --- | --- | --- |
| Doctor entry | `/doctor/login`; Google/password identity is checked against server access before entering clinical work | Signed-in staging acceptance, including historical mixed-role accounts |
| Clinic entry | `/admin/login`; clinic administrator uses shared `/admin`, manages doctors only in their verified clinic | Complete cursor-paginated staff listing and clinic lifecycle |
| Platform entry | `/super-admin/login`; provider-verified bootstrap identity from server-only `SUPER_ADMIN_EMAILS`; shared `/admin` | Tenant catalog, onboarding/offboarding and policy-approved configuration |
| Role changes | Server authority, no self-change, clinic guard, patient-account protection, claims/profile updates and successful `adminAuditEvents` | Idempotent recovery across Auth/profile/audit partial failures |
| Audit review | Successful role mutations store `actorUid`, `targetUid`, `clinicId`, `action`, `role`, `at`; invitation security has separate bounded events | Authorized event browser, explicit outcomes, lifecycle events, filters and cursor pages |
| Operations/business | Provider consoles and existing bounded engineering evidence; no in-app aggregate business dashboard | Tenant consumption, reliability, queue and summary-job aggregates with freshness and denominators |
| Clinical access | Administrators are denied clinician APIs; a separate provisioned Doctor identity is required | No blanket clinical-data grant is proposed |

These login routes distinguish task and audience. Visiting a URL, choosing a
role label or registering an Auth identity never grants that role. Both
administrator levels reuse `/admin`; it is the server's level and clinic checks
that select permitted actions. New account creation is identity-only. The
legacy privileged-profile fallback, separate Firestore Rules deployment and
already-issued media-token expiry remain documented boundaries.

The current staff GET caps a global privileged-profile query at 200 before
clinic filtering. It is bounded but can omit a clinic's staff; it is neither
complete pagination nor a trustworthy global total. Do not display that page
length as a business count. Auth, profile and audit mutations also do not form
one cross-provider transaction.

## Proposed audit workbench

Each server-owned event has its own opaque `id`, timestamp, clinic scope,
actor id/type, action, target type/id, outcome and bounded reason code. Use a
correlation id for troubleshooting. Record attempts, denials, failures and
completed administrative lifecycle transitions distinctly; a requested action
is not a completed result. Entra provides an established example of time,
activity, status, actor, target and correlation details. Our schema is a
privacy-minimized adaptation, not a copy of every Entra field. [Microsoft
Entra audit logs](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-audit-logs).

Exclude patient names/emails, clinical text, transcripts, chat, allowlists,
raw tokens, raw IP addresses, raw user agents and before/after clinical
snapshots. Actor/target ids can still be personal data: restrict access, audit
exports and approve retention. Keyed HMAC correlation is not an identity
factor. Protect append-only server writes and report gaps; do not call the
existing store immutable, tamper-proof or a complete record of every action.
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

Clinic administrators may query only their verified clinic. Platform operators
may inspect approved cross-clinic operational metadata, with no transcript or
summary drill-through. Apply scope inside the query, allowlisted filters, a
bounded time window and a server maximum page size (proposed 50). Order by time
and event id; use an opaque cursor tied to scope/filter, reauthorize every page
and rate-limit exports. Firestore documents `limit` with `startAfter` cursor
pagination; implementation and cross-clinic denial tests are still required.
[Firestore query cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors).

## Proposed operating and business view

Start with dated aggregate cards: active clinics and provisioned doctors;
invitation attempts/outcomes; waiting/admission counts and elapsed-time
distributions; connected/completed encounters; summary ready/reviewed/failed
counts and retry backlog; provider usage/quota and estimated spend. Keep
admitted, connected, completed, drafted and reviewed distinct. A queue or
connection event is not clinical success, and summary failure is not call
failure. Show window, freshness, denominator and collection coverage on each
metric. Suppress small identifying groups and keep clinical text out of every
drill-down. These are proposed engineering metrics, not measured study results.

AWS's SaaS Lens recommends tenant-level activity/consumption visibility for
capacity and usage-based economics. Apply that principle to bounded daily
rollups rather than scanning every consultation on each page load. Separate
estimated provider cost from invoices and from the unchanged PHP 7,856.69
development budget; revenue, profit and commercial capacity were not measured.
[AWS tenant activity and consumption](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-activity-and-consumption.html).

Allowlist configuration fields and impose safe ranges, role checks, expected
versions and audit receipts. Keep provider secrets server-only. A dashboard
must not offer arbitrary database writes, uncontrolled polling or a global
clinical export. Budget alerts, quota backoff, bounded worker batches and
configuration rollback belong to the operating design; they do not imply a
guaranteed hard spend ceiling or a shipped billing system.

## Scheduling and release evidence

There is no scheduling navigation in an ordinary deployment because
`ENABLE_CONSULTATION_SCHEDULING` is unset by default. The repository contains
the later `/doctor/appointments` module behind that server capability. It uses
UTC instants/named zones, doctor ownership, transactional overlap checks,
immutable create receipts and versioned reschedule/cancel. It does not grant
admission, issue a call token, create an encounter or start transcription.
Reminders, recurrence, patient self-booking and calendar sync are excluded.

Keep scheduling disabled until rules/indexes, existing-data shape and contact
retention review, timezone/concurrency/account-switch tests and signed-in
staging acceptance pass. The module was added after the study survey. See
[production readiness](production-readiness.md) and
[the invitation design](invitation-flow-design.md). Attachments remain disabled;
faculty reviewer access remains backend preparation only.

This review inspected repository contracts and official sources. A separate
authorized read-only production metadata audit in this session found 25 user
profiles (16 patient, 9 doctor), with `clinicId` absent on 24, three
role-audit events without an explicit `outcome` field, and no appointment
documents. These are bounded aggregate observations, not a survey result or a
claim that every user has complete tenant metadata. They support additive
compatibility and an approved migration plan rather than silently assigning
historical clinics. See the [dated redacted audit](testing/evidence/2026-11-28-device-login/production-metadata-audit.json).
No roles/data were changed, migrated or deleted; no feature was enabled and no
deployment was performed by this review. Before implementing count/schema/retention work, run the authorized
read-only aggregate/shape audit required by `AGENTS.md`; do not invent current
production counts from this note. Acceptance must include separate synthetic
platform-owner, clinic-admin, doctor, patient and unapproved identities, API
cross-clinic/clinical denials, bounded query checks, partial-failure recovery
and the complete doctor/patient call with optional AI off.
