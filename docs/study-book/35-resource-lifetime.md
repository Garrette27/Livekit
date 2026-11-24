# 35. Resource ownership, shared polling and repeated lifecycles

## The LiveKit boundary to trace

Several panels can ask for the same queue. If each owns an independent timer
and request, the read workload scales with interface composition rather than
the doctor's task. Shared polling and in-flight request coalescing move that
complexity into one module. The public interface remains a subscription and
refresh operation instead of a collection of timers exposed to callers.

Resource sharing introduces lifetime invariants. The first subscriber starts
the group; peers join it; the last subscriber releases it. A stale cleanup
must not delete the registry entry of a newer same-scope group. Hidden tabs
pause periodic timers and refresh on return, but explicit actions and live
events have their own refresh paths.

## A worked investigation

Subscribe one hundred synthetic consumers to the same scope and assert one
timer. Trigger repeated hide/show cycles and count listeners. Unsubscribe all
consumers and require zero remaining resources. Then test stale cleanup:
close an old group, create a replacement, invoke the old cleanup again and
add another peer. The repaired implementation compares group identity before
releasing shared registry state.

For requests, hold one fetch unresolved while many same-scope callers ask for
it. They should receive the same in-flight promise. After rejection, a new
request must be possible. Different scopes must not share results merely
because a global cache is convenient. Scope keys encode the server question;
UI selection can be applied afterward where the contract permits it.

## Exercise with answer

Does passing the hundred-consumer test prove a hundred simultaneous
consultations? No. It proves a local coordination invariant under synthetic
callbacks. Media clients, network transport and database workload are absent.
Its practical value is still real: a predictable number of local timers and
overlapping requests is easier to budget and maintain.

Why prefer an ownership comparison to another global closed-handle registry?
The existing group identity already names the resource lifetime. Using it
keeps knowledge local and avoids another state structure that can drift.
Introduce additional lifecycle state only when a demonstrated requirement
cannot be expressed clearly with the present ownership model.

## Ownership is the missing half of cleanup

A timer is easy to create and easy to forget. A subscription can be shared by several consumers, while an in-flight request can outlive the component that started it. Merely returning an unsubscribe function does not make the lifecycle correct. The design needs to say who owns the resource, which consumer references keep it alive, and which exact cleanup instance is allowed to stop it.

Imagine consumer A subscribes, then consumer B subscribes to the same scope. If A's cleanup stops the shared timer unconditionally, B loses updates. If neither cleanup stops it, the timer leaks. A reference-counted or otherwise explicit shared owner can handle the relationship, but it must also protect against repeated cleanup and replacement. A stale cleanup callback should not tear down a new resource created later under the same key.

Use instance identity in the reasoning. Resource R1 is created for scope S. R1 is removed. Resource R2 is later created for S. A delayed cleanup from R1 should apply only to R1. Comparing the scope string alone is insufficient because both resources share it. This pattern appears in caches, listeners, media tracks and asynchronous request generations, not only polling.

## A lifecycle test should count effects

Start with no consumers and assert no scheduled work. Add one and count the initial fetch, timer registration and listener registration. Add many consumers for the same scope and verify the intended sharing. Use a different scope and verify isolation. Remove consumers in an unusual order, including repeated unsubscribe calls. End with zero active resources and no subsequent requests after advancing the fake clock.

Now inject a failed fetch. A shared service can become permanently stuck if an in-flight marker is never cleared after rejection. It can also create a storm if every consumer independently retries. Assert recovery after the failure and the intended maximum work. A passing happy-path count does not cover either defect. The error branch is part of the resource state machine.

Visibility changes add another schedule. Hide the page while a request is in flight, unmount the final consumer, then show the page. No obsolete callback should resurrect the resource. Mount a new consumer and verify that it receives a clean initial state. These tests are especially valuable because the UI can appear correct while leaked background work silently consumes database quota.

## Keep the interface smaller than the machinery

Consumers should ask for an authorized projection and release their interest when done. They should not need to coordinate timer IDs, visibility event listeners and deduplication flags individually. Hiding those details in one deep module makes both testing and future policy changes easier. But the module must not become a universal event bus carrying arbitrary state; its scope and authority should remain narrow.

Realtime is an invalidation signal in this architecture. The shared owner can consolidate invalidations and re-query through the authenticated API. It should not treat incoming collection data as a replacement for the server projection. This preserves the security boundary while avoiding one bespoke subscription implementation in every component. Periodic expiry reconciliation remains a semantic choice that should be documented and budgeted.

For an independent exercise, a test reports zero active timers after cleanup, yet network requests continue. What resources might remain? Consider a recursive timeout scheduled by a finishing promise, a retry loop, a realtime callback that initiates fetches or another consumer scope. Counting only interval handles is too narrow. Define the observable no-work condition and trace every path capable of producing the effect.

The design lesson is that lifetime is part of an interface contract. A function that starts ongoing work should explain when that work stops and what happens to late results. Those guarantees are as important as the returned data shape. Making them explicit prevents small local conveniences from accumulating into system-wide complexity and operational cost.

## Source trail

Read the queue coordinator and its maintained regressions. Operation counts,
latency distributions and cloud billing observations are three different
measurements; preserve that distinction when presenting this optimization.
