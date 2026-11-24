# 22. Distinguish collections, references, projections and authoritative records

## The LiveKit boundary to trace

The database stores several views of consultation work. Invitations represent
access grants. Waiting rows represent visit admission state. Session records
represent encounters. History and summary projections present selected facts
to different audiences. A collection's existence does not tell you whether
it is the authoritative owner of a decision or a derived read model.

This matters when older data shapes coexist with newer ones. A room-level
projection can outlive the encounter that last updated it. A patient history
must not trust whichever email happens to appear on a convenient row. The
current design checks consistent recorded UID ownership and keeps clinician
drafts and other queue participants out of the patient-facing projection.

## A worked investigation

Trace one synthetic session through its durable record, events and history
response. Record which fields establish ownership and which merely label the
display. Then create a conflicting legacy shape: a root patient UID and a
metadata UID disagree. The projection should fail closed rather than choose
the value most convenient for displaying a result.

Do not repair disagreement by overwriting every legacy document. First audit
aggregate shapes and references. A destructive migration can orphan history
or remove evidence required for reconciliation. Prefer additive fields and
explicit compatibility readers when they preserve meaning without pretending
that missing ownership is known ownership.

## Exercise with answer

A summary document exists but is not visible in patient history. Is that a
bug? Check the audience contract. Clinician AI drafts may intentionally be
excluded. A missing patient metadata item is a different question from a
private summary being withheld. Interface convenience cannot decide clinical
data-sharing policy implicitly.

For a design review, draw the write owner and read consumers separately.
If several services can mutate the same identity field under incompatible
assumptions, the problem is authority leakage, not just duplicate storage.
Normalization helps, but a normalized schema still needs one clear contract
for identity and lifecycle changes.

## Foundational systems reading - adapted companion material

These adapted data-model readings use relational and Python examples for comparison. Firestore has its own APIs and transaction semantics. Transfer the distinctions between identity, snapshots, ordering and constraints, not an unverified storage implementation.

## Supplied systems reference - page 116

A primary key identifies a row within a table. A business identifier identifies something under a domain policy. A foreign key relates rows and can enforce referential integrity.

## Supplied systems reference - page 119

Iteration, list, boolean testing, and other operations can evaluate it. The QuerySet can then cache its retrieved results. Constructing a second QuerySet or asking for a modified query does not automatically reuse all that state. The cache is not a global database cache shared by every process.

## Supplied systems reference - page 120

Two evaluations can observe different committed states depending on isolation and timing. A Python list of model instances is a snapshot of retrieved objects, not an automatically refreshed view. refresh_from_db updates a selected instance's fields under its rules; it does not rewind every associated cache or produce a system-wide snapshot.

## Supplied systems reference - page 121

Offset pagination still has a concurrency limitation. If a new early position is inserted between reading page one and page two, the numeric offsets shift. A row can be repeated or skipped even with a deterministic ordering. Keyset pagination continues after a previously seen ordering key and can avoid some shifts, but it still requires clear behavior for updated sort keys, changed populations, and snapshot consistency.

An index is a maintained data structure that helps an engine locate or order data under suitable predicates. A unique index can additionally enforce a uniqueness property. Its benefit depends on columns, ordering, selectivity, statistics, engine behavior, and the query. An index also consumes space and imposes maintenance cost on writes.

## Supplied systems reference - page 122

Why might the optimizer scan a small table despite an available index? A scan can cost less than index traversal and row lookup for the table size and selectivity. The presence of an index does not force its use.

## Supplied systems reference - page 166

The same reasoning transfers to stream processing and editor commands. A pipeline that sorts all input needs different memory behavior from one that counts fixed categories. A macro repeated on every line performs work that grows with line count. An index reduces repeated search at the cost of storage and maintenance.

Big O describes asymptotic growth under a model, not elapsed milliseconds or a guarantee about all inputs. Constant factors, I/O, caching, and concurrency still require representative measurements.

A hash identifies content under an algorithm but does not reconstruct the content from its digest. A SUM preserves an aggregate but loses which rows contributed unless provenance is stored separately. A screenshot preserves pixels but can lose searchable text, hidden state, and exact command history. A static type narrows possible values in a model but does not prove what crossed a runtime boundary.

## Source trail

Read lib/services/history-summary/summary-projection-service.ts,
docs/data-model-readiness.md and docs/identity-and-record-integrity.md. Treat
the latter's historical reconciliations as recorded operations, not blanket
permission to repeat them against new data.
