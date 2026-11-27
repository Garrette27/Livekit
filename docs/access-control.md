# Access Control

The application enforces authorization on the server. UI visibility is a
convenience only and is never the security boundary.

This page covers role-based access for signed-in accounts. Patient entry via an
invitation link is a separate, capability-based mechanism — see
[invitation-access-model.md](./invitation-access-model.md).

## Roles

| Role | Current access |
| --- | --- |
| `doctor` | Own rooms, invitations, waiting queues, consultation history, and summaries |
| `patient` | Own patient history, invited room entry, and patient-owned deletion actions |
| `faculty_reviewer` | No clinical data by default; reserved for explicitly assigned, read-only thesis reviews |
| `admin` | Server permission map includes all application actions; maintenance endpoints still require `ADMIN_SECRET_KEY` |

The `faculty_reviewer` role is intentionally deny-by-default. Adding a professor
does not automatically expose every consultation. Before enabling a reviewer UI,
add an assignment record that identifies the permitted consultation IDs and
enforce that assignment in a server route using the
`consultation:review-assigned` permission. Do not reuse doctor credentials or
grant collection-wide Firestore reads.

## Provisioning

Patient profiles can be created through a valid signed invitation. Doctor,
faculty-reviewer, and admin profiles must be provisioned by a trusted
administrator:

Use the **/admin** console (server route `app/api/admin/roles`, policy
`lib/auth/role-administration.ts`) or `scripts/admin/provision-role.mjs`. The
first administrator is bootstrapped by the server-only `SUPER_ADMIN_EMAILS`
setting (provider-verified emails). Super admins grant doctor and admin;
admins grant doctor; nobody changes their own role; patient accounts are not
converted. Each change writes `adminAuditEvents` (uids only). Grants appear on
ID-token refresh; only revocations revoke refresh tokens. Manual steps, equivalently:

1. Create the Firebase Authentication account.
2. Set the Firebase custom claim `role` to `doctor`, `faculty_reviewer`, or
   `admin`. Admin accounts should also set `admin: true`.
3. Create the matching `users/{uid}` profile, or allow its first authenticated
   login to create it under `firestore.rules`.
4. Refresh the recipient's ID token after a grant. Revoke refresh tokens when
   removing access; existing ID tokens and transport grants have separate expiry.

Administrator entry uses `/admin/login` and identity-only `/admin/signup`.
Signup never writes privileged claims or clinician profiles. `/api/account/access`
returns a private, server-derived navigation projection: administrators land in
`/admin`, doctors in Invitations. It grants no permission. The environment-owned,
provider-verified bootstrap identity is labeled separately from legacy clinical
profiles and cannot be changed through clinician role commands. A Doctor grant
does not grant Administration. Newly approved users explicitly refresh access.

Roles cannot be changed by editing a browser request. Firestore rules keep a
profile's email and role immutable, and API routes resolve permissions from
verified Firebase tokens plus the server-side user profile.

## Ownership boundaries

- A doctor can claim a new room name, but cannot join, overwrite, inspect, or
  revoke another doctor's room or invitation.
- Waiting-room actions ignore caller-supplied doctor IDs and use the verified
  doctor identity.
- There is no separate patient registration: a signed-in patient is identified
  by the uid in their verified token. The only patient-side profile write is
  `/api/patient/consent`, which requires that token, accepts only the current
  consent-statement version, and refuses non-patient accounts.
- Persisted chat and attachment requests require the signed LiveKit room token
  and match its room and recorded principal to the consultation session. This
  is not a complete unique-visit/replay guarantee: reusable credentials can
  identify the same principal across visits. Immutable visit-bound grants are
  a real-clinic release gate; see the dated defense evidence.
- AI summary generation and edits require ownership of the completed
  consultation.
- Consultation record writes are server-only, even for an owning doctor using
  the Firebase client. Current and legacy participant read rules are retained.
- Patient history is scoped to consistent recorded Firebase UIDs, including the
  legacy metadata location. A matching email or browser-cached session ID never
  grants historical ownership. The legacy linking endpoint is an authenticated
  idempotent acknowledgment and performs no record reassignment.
- Admission can bind the verified Firebase UID into a signed room credential,
  separately from its LiveKit identity, so new signed-in visits need no later
  self-service linking. Guest visits without such evidence are not adopted on
  later login.
- Patient history exposes encounter metadata, not clinician AI drafts or other
  waiting participants. Scoped leave/finalization carries the encounter id.
  Operational queue departure/removal no longer closes or reattributes a
  clinical record selected only by room. If scoped tracking and trustworthy
  completion events are both lost, reconciliation is required; a reusable queue
  row is not an alternate clinical authority.

## Deployment checklist

- Deploy `firestore.rules` together with the application.
- Configure `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, Firebase Admin credentials,
  `OPENAI_API_KEY`, and a long random `ADMIN_SECRET_KEY`.
- Configure and verify LiveKit webhook signing.
- Test one account per role and a cross-account denial case before a thesis
  demonstration.
- Treat compliance certification, retention policy approval, incident response,
  backups, and enabling LiveKit E2EE (`LIVEKIT_E2EE_SECRET`) as separate
  deployment decisions; the repository alone does not certify them.
# Administrator/clinician separation — 27 November 2026 follow-up

This section supersedes earlier combined administrator/doctor examples. Platform owners and clinic administrators manage staff access only; clinical work requires a separate provisioned doctor identity. The server checks administrator authority before clinician claims or legacy profile fallback. Workspace navigation follows the same projection. New Administrator grants write `role: admin`, not `role: doctor`; removal must not reactivate a legacy clinician profile. No production account is silently migrated by these changes.

Direct Firestore client rules also deny clinical access for admin claims/profile roles, including historical `role: doctor, admin: true` tokens. The rules must be deployed separately from the Vercel frontend. Server-only bootstrap email configuration is not visible to Firestore Rules: an environment-only platform owner with historical doctor claims needs an explicitly approved claim/profile migration before real-clinic use. Existing LiveKit credentials have a separate expiry/revocation lifecycle. Do not claim universal instantaneous revocation.

Pattern and tradeoff: separation of duties keeps administrative identity distinct from clinical ownership. It costs an additional provisioned sign-in for a person performing both jobs, but prevents a staff-management grant from implicitly authorizing consultations. Historical clinical records remain attributable and are not deleted or reassigned.

Appointments use `appointment:manage-own`, granted only to Doctor. The API derives ownership from the verified request, never the command body. Patient/admin/reviewer identities cannot list or mutate calendars. Direct Firestore client reads/writes to appointments and calendar locks remain denied. The workbench is UID-keyed, clears authorization during identity changes, pins requests to the expected identity and ignores obsolete responses; a shared-browser switch must not carry contacts or drafts into another doctor's workspace.

