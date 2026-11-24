# 49. Preserve clinician edits and reject stale summary revisions

## The LiveKit boundary to trace

A ready summary is a draft. A clinician-reviewed edit changes its meaning
and status. Later generation must not overwrite reviewed content, and a
generation based on an older transcript revision must not replace a result
based on newer evidence. These are concurrency rules as well as clinical
documentation safeguards.

The summary-edit boundary validates known editable fields, rejects wrong
types and oversized values, and bounds stored edit history. Ownership is
checked separately. An input validator cannot authorize an editor, and an
ownership check cannot make an unbounded payload safe.

## A worked investigation

Create a synthetic draft and two evidence revisions. Delay generation for
the older revision, complete the newer result, then release the old operation.
Assert that stale work cannot replace the newer state. Repeat with a
clinician-reviewed record and verify regeneration leaves the reviewed content
intact.

For edits, test a valid short change, oversized text, wrong-typed lists and
history growth across repeated updates. Keep the test's content fictional.
The bounded history is a resource control, not proof that an approved audit
retention policy has been implemented across every store and backup.

## Exercise with answer

Why not resolve all concurrent edits by last write wins? In a clinical
documentation flow, the last network response may represent the oldest
evidence or an automated draft that arrived after a human correction. The
commit condition should express revision and review authority, not incidental
delivery order.

An editor saves the same text again. Should that operation necessarily create
another clinically meaningful revision? Decide the contract explicitly.
Idempotent or no-change handling can reduce noise, but it must preserve
required audit semantics. Do not add history entries mechanically without
knowing what event the entry is meant to represent.

## A generated draft and a reviewed note have different authority

An AI-produced summary can be ready for review without being accepted clinical documentation. The lifecycle label matters because it tells the clinician what remains to be done. A reviewed note represents a human decision and must not be silently replaced by a later generation. Treating both as interchangeable text loses the distinction between machine suggestion and committed review. The data model and write guards should preserve it, not merely the interface color.

Use a synthetic encounter with a transcript revision and an initial generated draft. Let the clinician edit a harmless marker and mark the note reviewed through the intended command. Now attempt regeneration from an older transcript revision. The reviewed content should remain protected. Assert durable fields and status, not only the displayed text. A stale response can overwrite data even if the current browser temporarily continues rendering the edited version.

## The two-editor race

Imagine two clinician views opened from the same summary revision. View A corrects the assessment and saves. View B, still showing the older draft, submits its own edit later. A simple last-write-wins policy can erase A's correction without warning. Optimistic concurrency instead binds the command to the version the clinician reviewed. The server compares that expectation atomically with the current state and can refuse or surface the conflict.

The exact conflict policy must be explicit. A field-level merge can be appropriate only when the system can preserve meaning safely; clinical prose is not always a set of independent fields. A conservative conflict panel can show that the note changed and require deliberate reconciliation. Do not automatically concatenate two assessments or choose the latest browser clock. The command's acceptance should depend on trusted persisted revision state, not a client's claim that it is newer.

Build the race with deferred persistence or controlled adapters. Have both views read revision R. Commit A to R plus one. Then submit B with expected R. Verify the intended conflict and preserve A's edit. Refresh B and submit a deliberate new command from the current revision to show that legitimate continuation still works. A test that only rejects B without proving a usable recovery path is incomplete from the clinician's perspective.

## Transcript revision protects evidence alignment

Generation can take time. While a provider works from transcript revision T, new segments may produce T plus one. If the old result returns later, it may omit important evidence. A revision guard prevents that old result from being treated as current without an explicit policy. The guard is separate from clinician-review protection: one concerns evidence freshness, the other human authority. Both can apply to the same late result.

Keep the generation request's evidence identity in the workflow. Do not rely only on a request timestamp, because clocks and asynchronous completion can mislead. The server should know which transcript revision the result was based on. When a stale result is rejected, the outcome should be understandable and bounded; it must not trigger an unlimited regeneration loop that consumes provider budget. A new attempt should have a defined reason and current evidence.

## Preserve provenance through the projection

The clinician's history view may expose draft status, review status and evidence quality differently from the patient's projection. Do not broaden the patient view to include internal queue details or every AI artifact merely because the server stores them together. Projection is a deliberate information boundary. A reviewed result can be visible under the product policy while unfinished machine output remains appropriately scoped.

Audit events should record the operation and safe revision relationships without copying clinical text into logs. A record that revision R was replaced by an authorized review can be useful; duplicating the full note in every event increases retention and disclosure complexity. The minimum sufficient provenance depends on the approved policy. A broad debug serialization is not a substitute for that design.

For an independent exercise, the clinician edits a ready draft while a background retry is pending. List the required safeguards. The retry must remain session-scoped, bind to its evidence revision, observe the current reviewed state and avoid overwriting accepted content. The client should handle the eventual outcome without reverting its current projection. This scenario ties together durable retry identity, optimistic versions, human review and stale asynchronous work.

The final design should make a simple promise: the clinician can understand which evidence produced the draft, edit it deliberately and trust that accepted work will not disappear behind a later automated response. That promise requires coordination inside the service. It should not depend on the clinician keeping only one tab open or remembering to wait until every background request has finished.

## Foundational systems reading - adapted companion material

These adapted database readings explain stale human intent and concurrency. Relational examples are comparison models, not instructions to migrate Firestore. Preserve the atomic version-check principle while tracing the actual summary review implementation.

## Supplied systems reference - page 126

A lock coordinates transactions executing now. It does not tell you whether a user made a decision from a form opened twenty minutes ago. Optimistic concurrency attaches a reviewed version to the request, compares it with current state, and rejects or reconciles a mismatch. The user's intent is applied to the state they actually reviewed, rather than silently overwriting another decision.

## Supplied systems reference - page 127

An optimistic comparison without an atomic conditional write or a lock can have its own race between checking and updating. Design the comparison and mutation as one protected transition.

Why can locking alone accept stale form intent? The lock reads current state at execution time, but without the reviewed token the service does not know that the user's request was based on an older state.

The database protects the business key regardless of the application's earlier observation. Foreign-key and uniqueness constraints also cover writers outside a particular view, including imports and management commands, provided they do not disable or bypass the constraints.

Adding a constraint to an existing database requires inspecting historical duplicates and deciding which records or evidence to preserve. Deleting whichever row has the highest ID is not a domain resolution rule. Compare effective decisions, source provenance, timestamps, and downstream references under an explicit migration plan.

## Supplied systems reference - page 128

A successful precheck is an observation at one time. A constraint is enforcement at the database mutation boundary. Treat them as different mechanisms rather than alternative spellings of the same protection.

## Supplied systems reference - page 129

Why can changing AutoField to BigAutoField matter beyond one table? Related foreign keys, indexes, migrations, database capacity, and compatibility with existing IDs can be affected. The change should be reviewed as schema evolution.

## Supplied systems reference - page 130

Use barriers or explicit synchronization rather than hoping two threads overlap after a sleep. Verify the final database state and relevant audit outcomes. A reliable failure case should expose the original race and explain what each writer observed.

Why include both refusal and allowed-path tests for schedule protection? They establish that the invariant is preserved while ordinary unprotected work remains possible. Either half alone leaves an important omission.

In an isolated MySQL or PostgreSQL test database, repeat with two actual sessions and an explicit transaction boundary. Observe whether a locking read waits, what the second writer sees after the first commits, and how the version comparison reports a conflict.

## Source trail

Read lib/services/summary-management/summary-edit-policy.ts, its core service
and consultation-finalization revision guards. The lifecycle processing,
ready, reviewed, failed and unavailable should remain consistent across
storage, projection and UI vocabulary.
