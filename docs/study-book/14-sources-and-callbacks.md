# 14. Follow a callback in Sources without losing its authority boundary

## The LiveKit boundary to trace

A breakpoint can explain why a client branch ran. It cannot by itself prove
that a server committed an authorized operation. Use the Sources debugger to
inspect callback order, captured values and cleanup, then connect that evidence
to the server request and domain contract. This is particularly important in
React effects, where an older asynchronous operation can finish after account
or route state changes.

The invitation page has one validation path. A signed-in account refreshes its
token before sending evidence to the server. A failed refresh must not silently
become an anonymous validation, and an obsolete response must not overwrite
the newer account's admission. These are temporal client invariants layered
around a server-owned policy decision. The client does not acquire authority
to skip validation merely because it recognizes an old successful result.

## A worked investigation

In an isolated local test, delay the first validation response, change the
account fixture, and let the second response finish first. Predict the final
state before releasing the old response. The correct final result belongs to
the current validation generation. Then invoke cleanup and confirm that a
late response cannot update the detached page. A cancellation signal and a
cancelled-state guard address related but distinct problems: aborting work
does not guarantee every adapter stops at the same moment.

Inspect what the closure captures. A callback may retain a room token,
selected invitation or session identifier from the render that created it.
That can be correct if the callback acts on that exact encounter. It becomes
dangerous when stale state is later used to finalize the current encounter
without verifying identity. Follow the owner of the committed state, not just
the most convenient variable visible in the debugger.

## Exercise with answer

A developer adds a second validation request after consent to make the screen
refresh. Why can that be a design regression? The new path can omit the
credential or apply different error handling. The current architecture reruns
the single validation path instead. Centralizing the path reduces temporal
policy drift while preserving the server as admission authority.

Do not paste credential values from a debugger into an issue. Describe their
presence, source and verified properties using synthetic fixtures. A useful
breakpoint note explains which generation wrote state and why; it does not
need to include the secret that happened to be in scope.

## Foundational systems reading - adapted companion material

These adapted debugging readings use Python to illustrate stack frames, mutable state and observation side effects. The concepts transfer to JavaScript investigation, but language-specific behavior and APIs must be checked in their own runtime.

## Supplied systems reference - page 94

Cleanup and rollback also differ. A finally block executes under ordinary exception unwinding, but it is not proof of cleanup after process termination or machine failure. A database rollback reverts transactional database changes, while a Python model instance you mutated can retain new values in memory. Reload or discard the object when you need its state to agree with a rolled-back database.

The place an exception becomes visible is not always the place the bad assumption originated. Conversely, not every exception is a bug: a service may deliberately reject a stale decision. Preserve the difference between an expected domain refusal and an unexpected system failure.

After a transaction rollback, can an already-mutated model object's attribute still show the attempted value? Yes. Database rollback does not automatically rewind Python object memory. Refresh it or replace it before relying on it again.

## Supplied systems reference - page 95

Inspect only what you need. In a web process, a breakpoint can block a worker and cause browser timeouts. Use an isolated local environment and understand which request or task owns the process before pausing it.

Pausing one Python worker does not pause the database or other workers. Shared state can continue changing. A value in the paused frame is evidence about that computation, not a frozen system-wide view.

Why might evaluating list(qs) at a debugger prompt alter the investigation? It executes a lazy QuerySet and captures results at that moment, potentially issuing queries and changing what later accesses observe through the result cache.

## Source trail

Read app/invite/[token]/page.tsx and the extracted-callback regressions in
tests/queue-and-auth-regressions.test.mjs. Such tests exercise actual callback
logic with controlled IO; they do not replace a successful live consultation.
