# Access Control

The application enforces authorization on the server. UI visibility is a
convenience only and is never the security boundary.

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

1. Create the Firebase Authentication account.
2. Set the Firebase custom claim `role` to `doctor`, `faculty_reviewer`, or
   `admin`. Admin accounts should also set `admin: true`.
3. Create the matching `users/{uid}` profile, or allow its first authenticated
   login to create it under `firestore.rules`.
4. Revoke refresh tokens when changing or removing a privileged role.

Roles cannot be changed by editing a browser request. Firestore rules keep a
profile's email and role immutable, and API routes resolve permissions from
verified Firebase tokens plus the server-side user profile.

## Ownership boundaries

- A doctor can claim a new room name, but cannot join, overwrite, inspect, or
  revoke another doctor's room or invitation.
- Waiting-room actions ignore caller-supplied doctor IDs and use the verified
  doctor identity.
- Patient registration requires the signed invitation and validates its
  persisted status, expiry, room, and email allowlist.
- Persisted chat and attachment requests require the signed LiveKit room token
  and match its room to the consultation session.
- AI summary generation and edits require ownership of the completed
  consultation.

## Deployment checklist

- Deploy `firestore.rules` together with the application.
- Configure `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, Firebase Admin credentials,
  `OPENAI_API_KEY`, and a long random `ADMIN_SECRET_KEY`.
- Configure and verify LiveKit webhook signing.
- Test one account per role and a cross-account denial case before a thesis
  demonstration.
- Treat compliance certification, retention policy approval, incident response,
  backups, and LiveKit E2EE as separate deployment decisions; the repository
  alone does not certify them.
