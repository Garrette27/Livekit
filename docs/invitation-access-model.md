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

## Admission assurance tiers

Skipping the waiting room is decided by **how strongly identity is established**,
not by an address the visitor can type. `lib/invitations/admission-policy.ts`
resolves one of four tiers and fails closed:

| Tier | Meaning | Skips the queue? |
| --- | --- | --- |
| `verified` | Signed in, non-anonymous, `email_verified` is true | **Only if also on the allowlist** |
| `authenticated` | Signed in, email not verified by the provider | No |
| `self-declared` | Typed an address this session | No |
| `anonymous` | No account, or a Firebase anonymous session | No |

This separation of *identity proofing* from *authentication* follows
[NIST SP 800-63](https://pages.nist.gov/800-63-3/sp800-63-3.html), where IAL
(proofing) and AAL (authentication) are deliberately independent: possessing a
link is neither.

**Being queued is not a rejection.** An anonymous patient loses nothing except
one click of the doctor's — which is exactly the guest/host model mainstream
video products use, and the reason the waiting room exists.

Verified behaviour, with `erika@gmail.com` allowlisted:

- signed in + verified + allowlisted → joins directly
- signed in but email unverified → waiting room
- verified but not allowlisted → waiting room
- **link holder types `erika@gmail.com` with no account → waiting room**
- **anonymous account asserting `erika@gmail.com` → waiting room**
- invitation with an empty allowlist → everyone waits

## Anonymous patients and account upgrade

Patients are never forced to register before a consultation. The intended
progression, which is the standard Firebase guest pattern
([best practices for anonymous authentication](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/)),
is:

1. A guest opens the link and is queued as an unidentified visitor.
2. If they choose to register, `linkWithCredential` upgrades the anonymous
   account to a permanent one **keeping the same uid**, so the consultation
   history they already accumulated stays attached to them.
3. On their next invitation, that account is `verified` and an allowlist match
   lets them skip the queue.

Step 2 is why an anonymous Firebase session is worth creating for guests at all:
it gives every visit a stable identifier that a later account can inherit. Note
that linking an anonymous account means it is no longer auto-deleted by
Identity Platform's anonymous-account cleanup.

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
