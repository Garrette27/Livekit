# Invitation Access Model

How a patient reaches a consultation, and why the design is shaped this way.
This complements [access-control.md](./access-control.md), which covers the
role-to-permission policy for signed-in users.

## Two different mechanisms, often confused

The system uses **two** authorization mechanisms, and conflating them causes
design mistakes:

| | Role-Based Access Control | Invitation grant |
| --- | --- | --- |
| Applies to | Signed-in doctors, patients, reviewers, admins | Anyone opening an invitation link |
| Question answered | "What may this *account* do?" | "May this *visit* enter this room?" |
| Evidence | Verified Firebase token + server-side profile role | A server-signed, expiring invitation token |
| Implemented in | `lib/auth/access-policy.ts` | `lib/invitations/validate-service.ts` |

The invitation link is a **capability**: possession of the token conveys the
grant. That is the correct pattern for inviting someone who may not yet have an
account — it is what Zoom, Google Meet, and Doxy.me use — but it means the link
itself is the secret, and **a capability cannot by itself prove who is holding
it**.

The waiting room exists precisely to close that gap: it puts a human decision
between "holds a valid link" and "enters the consultation".

## The three levels of identity

Because a link can be forwarded, the system distinguishes how a visitor's email
was established. `lib/invitations/waiting-patient-identity.ts` resolves the
strongest available source and records it as `identitySource`:

| Source | Meaning | Doctor sees |
| --- | --- | --- |
| `registered-profile` | Email matches a registered account on this system | **Registered account** |
| `invitation-token` | Email came from the invitation the doctor signed, but the visitor has not signed in | **From invitation link** |
| `self-declared` | The visitor typed the address this session | **Unverified** |
| `unidentified` | No email at all | **Unidentified guest** |

Resolution prefers the strongest source. A returning patient who reopens their
link without retyping their address is still recognised from the signed token or
their registered profile, rather than collapsing to an anonymous entry.

**Why this matters:** the waiting queue previously showed `Email: Unknown` and
`Anonymous Patient` for returning patients, because identity was built only from
what the visitor typed in that session. The doctor was asked to admit someone
with no way to tell a returning patient from a stranger with a forwarded link.

## Admission paths

1. **Auto-admit** — the invitation lists the visitor's email *and* that email
   resolves to a registered account (`isAutoAdmissionCandidate`). The patient
   joins the consultation directly.
2. **Waiting room** — everyone else. The patient holds a waiting-room-scoped
   LiveKit token only; the doctor admits or rejects.
3. **Rejected / expired / revoked** — no token is issued.

A waiting-room token grants access to `{room}-waiting`, never the consultation
room. Admission mints a new token for the consultation room. This is why an
un-admitted visitor cannot reach the call by manipulating the client.

## Known gap

Auto-admit currently matches on an email address that the visitor may supply
themselves. A holder of the link who types an allowlisted address and has a
registered account under it will be auto-admitted. The registered-account
requirement limits this, but it is **not** proof of ownership of the mailbox.

To close it, require a signed-in Firebase session whose `email_verified` claim
is true before treating an address as auto-admittable, and downgrade every other
visitor to the waiting room. That change makes the allowlist a genuine identity
control rather than a convenience, at the cost of requiring patients to sign in
before their first consultation.

## Design rules to preserve

- **The server decides.** UI state is never the boundary; every admission path
  is re-checked server-side against the persisted invitation.
- **Fail closed.** An unknown, expired, revoked, or unmatched visitor goes to the
  waiting room — never straight into the consultation.
- **Show provenance, not just data.** The doctor's queue states how an identity
  was established, because admitting the wrong person is the expensive mistake.
- **Name the effect on everyone else.** Any access setting must state what
  happens to visitors it does not match, or it will be misread as stricter than
  it is.
