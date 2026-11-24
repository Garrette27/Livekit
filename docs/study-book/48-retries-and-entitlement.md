# 48. Retryable failures, exhausted entitlement and durable work queues

## The LiveKit boundary to trace

Not every provider failure should be retried in the same way. A transient
capacity refusal, a transport interruption and exhausted account credit have
different next actions. Repeatedly retrying an unavailable entitlement spends
time and quota without creating evidence. The application records exhausted
credit as unavailable rather than pretending that another immediate attempt
is likely to complete.

Durable summary jobs preserve work across interrupted functions. A lease and
bounded retry policy prevent abandoned processing state from being mistaken
for progress forever. The worker remains authenticated and processes a
bounded page; adding a queue does not remove the need for ownership checks,
idempotency and clear failure outcomes.

## A worked investigation

Use local provider adapters that simulate a retryable error, exhausted credit
and a successful structured result. Count attempts and inspect the resulting
job and summary states. Do not purchase credits or invoke a paid provider
merely to demonstrate classification. The behavior of the decision can be
tested with synthetic responses.

For transcription, inspect route budget and per-attempt timeout together.
An additional retry can exceed the function's practical duration even if each
individual attempt has a reasonable timeout. The bounded attempts must fit
the route's overall operation and leave room for response handling. The call
must continue when optional documentation work pauses.

## Exercise with answer

A dashboard says processing after the provider refused an unavailable
entitlement. What should you inspect? Follow the classification into durable
job and summary state, then the read projection and UI. A stale label can be
a projection or client-refresh problem even when the worker recorded the
correct terminal branch.

Why use a durable queue instead of only an in-memory retry loop? A function
can terminate, deploy or lose its process before work finishes. Durable state
allows later authorized recovery. However, persistence does not imply that
retries are free, immediate or clinically safe. Bounds, provenance and
reviewed-content protection remain part of the design.

## Foundational systems reading - adapted companion material

These adapted queue readings distinguish acceptance, execution and acknowledgement. They provide a general failure model for retry reasoning without claiming a particular external broker is deployed in the teleconsultation application.

## Supplied systems reference - page 155

A queue separates acceptance from execution. The broker can hold a message, a worker can reserve it, the task can perform an effect, and acknowledgement can remove the message from further delivery. Failures between these steps create uncertainty.

## Supplied systems reference - page 156

Idempotency is a property of the complete effect and its identity scope, not of the presence of a retry decorator. A task result entry and the business operation's authoritative state can also differ.

## Source trail

Read lib/services/consultation-finalization/ai-provider-errors.ts,
app/api/summary/process-queue/route.ts and the summary job services. The
current study task makes no new provider requests and supplies no evidence
of live AI documentation efficiency.
