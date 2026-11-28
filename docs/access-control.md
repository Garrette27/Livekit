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
| `admin` | Clinic-scoped doctor provisioning; no clinical permissions; maintenance endpoints separately require `ADMIN_SECRET_KEY` |
| `super_admin` (server-derived authority, not an application role claim) | Platform staff and clinic-administrator provisioning; no clinical permissions |

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
ID-token refresh. Revocations and grants that replace clinical authority with
administrative authority (or the reverse) revoke refresh tokens. Manual steps, equivalently:

1. Create the Firebase Authentication account.
2. Set the Firebase custom claim `role` to `doctor`, `faculty_reviewer`, or
   `admin`. Admin accounts should also set `admin: true`.
3. Create the matching `users/{uid}` profile, or allow its first authenticated
   login to create it under `firestore.rules`.
4. Refresh the recipient's ID token after a grant. Revoke refresh tokens when
   removing access; existing ID tokens and transport grants have separate expiry.

### Adding people: invite-based provisioning

The **Add a person or grant a role** form in `/admin` takes a full name, work
email, clinic and role. When the email has no account yet and *Create the
account and email a set-password link* is ticked (the default), the server
first runs the same `decideRoleChange` policy, then creates the Firebase Auth
user **without a password** (`createUser`, `emailVerified: false`), sets the
claims and profile, and writes a uid-only audit event with `accountCreated:
true`. The administrator's browser then asks Firebase to send its standard
password-reset email, which the new person uses to choose their own password
and which lands on the sign-in page for their role. Each account row also has
**Email set-password link** for a lost or expired email.

Pattern and tradeoff: this is the invite flow used by workspace products
(Google Workspace, Slack, GitHub organizations). The administrator never
chooses, sees or transmits a password, so no shared secret exists to leak and
the person proves control of the mailbox before they can sign in. The cost is a
dependency on email delivery (Firebase's sender can land in spam) and a link
that expires, hence the resend action. A policy refusal happens before
creation, so a refused invitation leaves no orphan account. Existing accounts,
including Google sign-ins, simply receive the role as before.

Each set-password send starts a 60-second window for that recipient: the
button counts down ("Resend in 42s") and the row keeps a "✓ Sent 4:31 PM"
confirmation (`lib/auth/resend-cooldown.ts`). The window prevents duplicate
emails from repeated clicks. It is not a security control, since Firebase
rate-limits on its side as well.

### Changing your own password

`/admin` has a **Your account · change password** card for the signed-in
administrator, including the platform owner. It follows Firebase's required
pattern: re-authenticate with the current password
(`reauthenticateWithCredential`), then `updatePassword`. The new password must
be at least 8 characters, entered twice, and different from the current one.
Google-only accounts have no password here; the card offers to email a link
that adds one. The password goes only to Firebase Auth and is never stored or
logged by the app. Super-admin authority comes from `SUPER_ADMIN_EMAILS`, so it
is unaffected by a password change.

### Platform owner (super administrator)

The super administrator is not granted in the console. Add the person's email
to the server-only `SUPER_ADMIN_EMAILS` variable (comma-separated) in the
deployment environment and redeploy. The account must be non-anonymous and its
email provider-verified: sign in with Google, or create it at `/admin/signup`
and open the verification email. Then sign in at `/super-admin/login`. Never
send passwords through chat or tickets; if one was, change it.

Clinic-administrator entry uses `/admin/login` and identity-only `/admin/signup`.
The platform owner signs in separately at `/super-admin/login`.
Signup never writes privileged claims or clinician profiles. `/api/account/access`
returns a private, server-derived navigation projection: administrators land in
`/admin`, doctors in Invitations. It grants no permission. The environment-owned,
provider-verified bootstrap identity is labeled separately from legacy clinical
profiles and cannot be changed through clinician role commands. A Doctor grant
does not grant Administration. Newly approved users explicitly refresh access.

Roles cannot be changed by editing a browser request. Firestore rules keep a
profile's email and role immutable, and API routes resolve permissions from
verified Firebase tokens plus the server-side user profile.

### Separate sign-in intent, shared server authorization

`/doctor/login` accepts only a server-projected doctor account. Google and
password entry both reject and sign out clinic administrators, configured
platform owners and other roles before any doctor-profile write. It does not
redirect an administrative identity into `/admin`.

`/admin/login` accepts exactly the `admin` authority; `/super-admin/login`
accepts exactly `super_admin`. A mismatched authenticated identity is signed
out with an inline explanation, including when an existing session chooses
**Check access again** — the circular-arrow refresh icon in the "Signed in as
…" account bar (an icon button with a tooltip and an accessible name). That
bar, with its **Sign out** action, appears only while a session exists; it is
how a shared computer switches accounts and how a newly approved person
refreshes their ID token to pick up new claims. Neither route automatically forwards a restored
session. `/admin/signup` creates only a Firebase identity for clinic access;
it cannot grant a role or configure a platform owner. The platform-owner entry
has no signup option. Both accepted administrative authorities use `/admin`,
where every staff command re-checks role and clinic scope on the server.
Signing out there shows the explicitly named clinic and super-administrator
sign-in choices.

Pattern and tradeoff: role-specific entry makes the user's workspace intent
explicit while sharing the identity-provider and access-check implementation.
This costs a separate entry URL for each administrative audience, and selecting
the wrong one requires signing in again. It adds no authorization by itself:
the server's verified token, trusted role policy and ownership checks remain
authoritative on every protected request. This follows
[Firebase's server-managed custom-claims pattern](https://firebase.google.com/docs/auth/admin/custom-claims)
and [OWASP's least-privilege, deny-by-default and per-request authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Local verification uses synthetic identities and isolated identity-provider /
database adapters in `tests/admin-workspace-regressions.test.mjs`. It exercises
Google/password acceptance and rejection, sign-out, existing-session refresh,
identity-only signup and access-service failure. These are repository tests,
not evidence of deployed Firebase accounts or live provider sign-in.

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

