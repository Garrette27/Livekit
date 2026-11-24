# 23. Transactions, use reservation and concurrent invitation redemption

## The LiveKit boundary to trace

A use counter is meaningful only if concurrent requests cannot both spend the
same final use. Reading a counter, deciding in application memory and writing
a larger value later leaves a race between those operations. The reservation
boundary therefore rereads current invitation authority inside a transaction
and commits the use, access evidence and new waiting visit together.

The visit is the accounting unit, not the HTTP request. Reconnects should reuse
an active row rather than consume a new use every time a browser retries.
Conversely, a completed or rejected visit should not be treated as indefinitely
open merely because its deterministic identity is familiar. Read the lifecycle
conditions along with the key derivation.

## A worked investigation

Construct a synthetic invitation with two allowed uses and launch more than
two concurrent reservation attempts. Assert both the accepted count and the
durable counter. Then repeat a reconnect for an already reserved visit and
confirm that its request does not allocate another visit. A test that checks
only the final numeric counter can miss duplicate rows or missing audit
events; inspect the whole atomic contract.

Transaction callbacks may run again after contention. Keep external side
effects outside a retrying decision unless they have their own idempotent
contract. A token returned only after successful authority checks is not the
same as an email or external mutation performed during a callback that later
retries. Know which work the database can roll back and which work it cannot.

## Exercise with answer

Why not reserve the use first and create the waiting row in a second write?
If the second write fails, the visitor may spend a use without receiving the
visit state needed to continue. Grouping the dependent durable effects
preserves their relationship. Optional telemetry that is not part of access
correctness can have different failure semantics, but that distinction must
be designed rather than accidental.

An invitation uses a legacy sentinel for reusable access. Should the UI show
that huge number as a capacity promise? No. The named storage convention
means reusable until expiry. Its presentation belongs to a helper so server
and interface interpretations cannot drift through repeated magic numbers.

## A race has a schedule, not merely two users

Imagine an invitation with one remaining visit. Visitor Birch reads that value. Visitor Elm reads the same value before Birch writes. Each decides that access is available. If each later increments and creates a waiting row independently, the system can grant two visits despite a correct-looking check in both requests. The defect is not that either request skipped validation. It is that the observation and mutation did not form the required atomic decision.

Write the interleaving explicitly before implementing a test. Mark the reads, decision points and writes. Then identify the invariant: the committed visit reservations must not exceed the permitted use policy, and each successful new reservation must have its corresponding waiting row and audit effect. A transaction pulls that concurrency complexity into the service rather than asking every caller to coordinate. The browser should not need to know whether another visitor is redeeming the same invitation.

Firestore transactions can retry their function when concurrent state changes. That means the transaction body must not perform uncontrolled external effects as though it runs exactly once. A provider call, email or raw log append inside the retried body can be repeated. Keep the transactional work focused on the durable records requiring coordination. If an external effect is needed, design its own identity and retry boundary rather than assuming the database transaction covers it.

## Test all sides of the atomic effect

For a successful new waiting visitor, assert the use counter, waiting-row creation and bounded access audit together. For a rejected attempt, assert that no partial reservation remains. Inject a failure at a controlled persistence point through the test adapter and verify the final state rather than only the thrown exception. The user-facing result and durable effect must agree sufficiently for safe retry. An error response after a committed effect is a different case from a rolled-back transaction.

Test a reconnect using the active visit identity. It should reuse the intended row instead of consuming another visit. Then test a genuinely new visitor with a different scope. Those cases reveal whether the idempotency identity is too broad or too narrow. A key that merges all visitors prevents legitimate use; a key that changes on every retry duplicates reservations. Define what counts as the same intent and what fields are bound to it.

Use explicit barriers or deferred adapter operations to create overlap. A loop that starts two promises may overlap in practice, but a deterministic schedule is easier to review and reproduce. Assert both outcomes and final records. If one attempt loses a transaction conflict and retries, the test should establish that the eventual decision respects the updated state. Do not make the expected result depend on which fictional visitor wins unless that ordering is part of the contract.

## Atomicity does not answer every security question

A perfectly atomic transaction can still authorize the wrong principal. Ownership and verified identity checks remain necessary. Likewise, a lock can serialize two invalid commands without making them valid. Keep the permission predicate visible in the service's decision path. The transaction protects coordinated state; authorization protects who may request its change.

Atomicity also does not mean that a later projection instantly refreshes in every browser. A committed row can exist while a client displays stale data. Realtime invalidation and re-query address observation, not the original reservation invariant. Distinguish those boundaries in both tests and explanations. Otherwise a UI refresh problem may tempt an investigator to repeat a mutation that already committed.

For an independent exercise, suppose the counter advanced but the patient reports no waiting page. List three possibilities before calling the transaction broken: the operation committed but the response was lost, the browser failed during rendering, or a later policy transition changed the row. Inspect the exact reservation and request outcome through safe labels. The correct retry behavior depends on durable identity, not on whether the patient remembers seeing a spinner.

The design objective is a simple interface with strong internal guarantees: validate this invitation and return the authorized next state for this visitor. Its caller should not perform a counter update, then an audit write, then a row creation as three conjoined obligations. Pulling that sequence downward reduces both race conditions and the amount of policy every API route must remember.

## Foundational systems reading - adapted companion material

These adapted concurrency readings compare transaction and isolation boundaries. SQL locking examples are not Firestore commands. Use them to ask sharper questions about the actual reservation service, its retry behavior and its external effects.

## Supplied systems reference - page 123

Keep transactions focused on the state requiring coordination. A network call inside a transaction can prolong locks while a remote endpoint waits or fails. Moving the call after commit avoids some timing problems, but introduces a delivery gap if the process crashes before sending it. on_commit organizes a callback after success; it does not persist the callback as a durable message.

Atomic means indivisible according to a particular interface and failure model. It is not a universal adjective for a business operation spanning several resources. Cross-resource guarantees require explicit coordination and recovery.

What does a successful atomic block prove about an S3 upload inside it? Nothing by itself. S3 is not automatically part of that database transaction, so its effects follow a separate lifecycle.

## Supplied systems reference - page 124

Atomicity and isolation answer different questions. Atomicity concerns grouping effects under failure. Isolation constrains observations and interference among concurrent transactions. A transaction can be atomic while allowing another operation to read an older state or while producing a lost update if the application uses an unsafe read- modify-write sequence.

Locks, conditional updates, and serializable execution can address different interference patterns. Serializable transactions can fail with serialization errors that require retrying the whole operation under a deliberate policy. Retry code must also account for external side effects, because repeating a transaction is not necessarily safe when it already sent a message.

Use two separate database sessions for a concurrency experiment. A single Python function issuing statements sequentially on one connection cannot demonstrate simultaneous decisions. Record which statements execute before each commit and what each session reads.

## Supplied systems reference - page 125

Locking can cover more than the exact visible row. Joins, indexed ranges, and engine-specific gap locking affect scope. Acquiring locks in inconsistent orders can cause deadlocks. A deadlock is a detected conflict requiring a deliberate retry policy, not proof that the database abandoned correctness. Minimize unnecessary locked work and define a consistent ordering where several records need coordination.

A lock protects access to resources under its mechanism, while authorization protects which actor may perform the operation. Neither replaces the other. A correct lock around an unauthorized edit remains an authorization defect.

## Source trail

Inspect lib/invitations/invitation-use-reservation.ts, validate-service.ts
and invitation-access-core.ts. The pure reservation fixture demonstrates a
counter invariant; emulator and service tests cover complementary persistence
and authorization behavior.
