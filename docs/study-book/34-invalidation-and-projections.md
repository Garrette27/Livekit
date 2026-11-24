# 34. Realtime invalidates; authenticated projections supply the rows

## The LiveKit boundary to trace

Realtime updates can reduce perceived delay, but they create another route
into interface state. If that route publishes raw documents while periodic
HTTP refresh uses an ownership- and expiry-filtered projection, the UI has
two conflicting definitions of the queue. The last callback wins, making the
defect appear intermittent even though both paths behave deterministically.

The coordinator instead treats Firestore events as invalidation signals.
Subscribers request a fresh authenticated projection. The listener query
limits live statuses so historical rows do not fill its initial snapshot,
but the query is not the only security boundary. The API still supplies the
canonical view and periodic refresh reconciles expiry and legacy shapes.

## A worked investigation

Use a test snapshot whose docs property throws if accessed. Emit an event and
confirm that subscribers are notified without receiving rows. Then exercise
the real projection service with expired, revoked, stale, other-room and
other-doctor fixtures. The test separates event handling from policy filtering
instead of trusting a mock response that already contains the desired rows.

Simulate stream failure and verify the periodic fallback remains available.
An error in a listener must not turn an unavailable stream into an empty queue
presented as truth. The interface can show retryable feedback while keeping
the read model's authority and scope clear.

## Exercise with answer

Why continue periodic refresh when realtime appears healthy? Time-based
expiry can change effective availability without a new document event.
Legacy data and missed delivery can also require reconciliation. The interval
should be chosen with read budgets in mind, not removed on the assumption
that every meaningful change produces a perfect event.

What should realtime carry in a future content or clinical projection system?
Prefer an invalidation fact rather than a second authoritative state blob
unless the architecture explicitly defines and secures that replication
protocol. Fewer policy owners make consistency easier to reason about and
reduce the chance that one fast path bypasses a slower, correct boundary.

## Source trail

Inspect lib/waiting-room/waiting-queue-coordinator.ts, hooks/useWaitingQueue.ts
and invitation-access-core.ts. The contract is about ownership of rows, not
about declaring Firestore realtime inherently unsafe or HTTP inherently safe.
