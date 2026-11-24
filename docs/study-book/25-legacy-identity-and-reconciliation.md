# 25. Preserve legacy data without silently adopting another person's records

## The LiveKit boundary to trace

Legacy compatibility is not permission to guess ownership. An old record may
place a patient UID in metadata, omit it entirely or disagree with another
field. A browser may remember a session ID from a guest visit. An invitation
may contain an email associated with several historical encounters. None of
those conveniences automatically establishes that the currently signed-in
account owns every matching record.

The repaired legacy linking endpoint acknowledges authenticated old requests
without performing reassignment. New signed-in visits use a verified UID
binding at issuance and tracking time. Existing consistent ownership remains
readable, while unsupported guest history is not silently adopted. This
preserves confidentiality at the cost of automatic historical recovery.

## A worked investigation

Create three synthetic history shapes: a consistent current record, a
consistent supported legacy record and an email-only record with no reliable
UID. Query as the intended patient and as another patient with a similar
label. The first two should follow the recorded UID contract. The third
must not become owned merely because its email matches a caller's claim.

Add a conflicting record and test denial rather than arbitrary precedence.
Then inspect the response projection for accidental clinician draft or
room-wide queue details. Correct record selection and minimal response
content are separate privacy properties. An endpoint can select the right
encounter and still disclose too much of it.

## Exercise with answer

What would a safe migration require if the team later wants to recover guest
history? It needs explicit authority, a validated evidence model, a backup,
dry-run counts, idempotent reference updates, rollback and post-run checks.
The decision may require human review because missing identity cannot always
be reconstructed computationally. A deadline does not make uncertainty go away.

Explain why deleting duplicate-looking profiles first is dangerous. A row
that another record references is not yet disposable. You must understand
the reference graph and surviving identity before removal. The historical
integrity work illustrates why database tidiness is secondary to preserving
the meaning and ownership of clinical history.

## Source trail

Read docs/identity-and-record-integrity.md,
app/api/link-patient-consultations/route.ts and the patient-history
projection. No exercise in this book authorizes a live reconciliation,
demotion, deletion or reassignment of a real account.
