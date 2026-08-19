# Identity and record integrity

How the system decides that two records describe the same thing, why it got
that wrong twice, and what it does now. This is the data-integrity companion to
[access-control.md](./access-control.md) and
[invitation-access-model.md](./invitation-access-model.md).

## The principle

Every record has one identifier, and that identifier comes from whatever
already owns the thing being identified.

- A **person** is owned by the identity provider, so a profile is keyed by the
  Firebase Auth uid.
- A **place in a queue** is a patient waiting for one invitation, so its entry
  is keyed by that pair.

Where a key is invented instead of derived, the same real-world thing gets a
new record every time it is written, and nothing downstream can tell that the
copies are one thing. Both duplication defects found in this project were that
mistake, in two different collections.

## Defect 1: profiles under a generated id

`/api/user/register` created the profile with
`db.collection('users').add(data)`, which assigns a generated document id.
Every other path — `authorizeBearerRequest`, both sign-in screens, and
`firestore.rules` — reads `users/{uid}` keyed by the Firebase Auth uid.

An invited patient therefore held a profile under a key no sign-in could ever
match, and a second profile appeared beside it the moment they signed in.
Measured: 4 addresses with two profiles each, 5 profiles with no auth account.

This is not only untidy. Orphaned profiles still answer `findByEmail`, so an
invitation could resolve a patient to a stale uid and role — an identity
decision made from a record that belongs to nobody.

**Now:** `UserRepository` exposes `upsertById` and offers no way to create a
profile under a generated id. The registration route writes under the verified
uid when the visitor is signed in, updates the existing profile when they are
not, and records consent against the invitation rather than inventing a profile
for someone who has no account yet. The sign-in path already creates the
profile under the right key.

## Defect 2: a queue entry per visit

`waitingPatients` documents were keyed
`waiting_{invitationId}_{timestamp}_{random}`, so every arrival wrote a new
row. `findExistingWaitingPatient` reuses a row only while its status is still
`waiting`, so a patient who reloaded, reconnected, or returned after leaving
accumulated rows: one pair held eight.

The collection was doing two jobs at once — current state and an append-only
history — and the history was encoded by the row existing many times.

**Now:** the entry is keyed by invitation and patient, so a return visit
updates the entry the patient already holds. Each arrival is appended to a
`visits` subcollection, which is where the history belongs. The two jobs are
separated rather than conflated.

`joinedAt` is written only on first arrival, so "waiting for 11 minutes" means
the wait rather than the last page load.

### Keying an unidentified visitor

A visitor with no address and no account has no durable handle, so their entry
is keyed by a hash of the network and user-agent signals already collected for
that request. It is stable enough to collapse a reload into one entry and is
deliberately not treated as identity anywhere else — an unidentified visitor
still waits for the doctor regardless.

Every discriminator is a keyed hash, so a document id never carries a patient's
email address. The hash kind is mixed into the digest, so the same value under
two kinds cannot collide.

## Reconciling the records already written

A fix to the writer does not repair what it already wrote. Reconciliation ran
once, dry run first, with a JSON backup of every document touched:

| Case | Action |
| --- | --- |
| Orphan nothing referenced | Deleted |
| Orphan with a live profile for the same address | References repointed to the live profile, then the orphan deleted |
| Orphan with references but no live profile | Kept |

23 references across `consultationSessions`, `consultations`, and
`waitingPatients` were repointed, so consultation history stayed attached to
the patient rather than being deleted with the duplicate.

The third case is the one worth defending in a viva: deleting that profile
would have satisfied the request and left a record pointing at an identity that
exists nowhere. Removing a duplicate is safe only once nothing depends on it.

## Rules to hold to

- Derive keys, do not invent them. If a record has a natural key, use it.
- One collection, one job. A current-state record and an event log are
  different things even when they describe the same subject.
- Check references before deleting. An orphan that something points at is not
  an orphan yet.
- Back up before reconciling, and dry-run first. A merge is not reversible from
  memory.
