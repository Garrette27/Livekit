# 27. Reconnect, duplicate identities and the difference between a tab and a visit

## The LiveKit boundary to trace

Two pages can refer to one continuing visit. When a second connection joins
with the same media identity, the earlier connection may be replaced. The
application must distinguish that transport replacement from a patient
choosing to leave the clinical encounter. Otherwise the old page's disconnect
callback can close state needed by the new connection.

Separate browser profiles make account state easier to control, but they do
not change the server-issued participant identity. Private browsing is not
a performance optimization or a second backend. Use one intended patient
connection during a paired demonstration unless duplicate replacement is
the explicit synthetic experiment.

## A worked investigation

Read the disconnect callback in both invitation and legacy patient routes.
For a duplicate-identity reason, the old page marks cleanup as already
processed, detaches relevant references and redirects with an explanation.
It must not finalize the continuing visit. For an ordinary user leave, the
normal exit path still applies. Test both branches so a broad skip does not
accidentally suppress every legitimate departure.

In a local fixture, invoke the actual callback with controlled transport
reasons. Count finalization calls and inspect cleanup guards. Then simulate
unmount after replacement. A regression that checks only the visible toast
can miss a later unload beacon that still sends a leave event.

## Exercise with answer

An old page redirects to history after another profile joins. Is that enough
to prove the shared visit stayed open? No. Inspect the server event sequence
and current session identity, or exercise the cleanup paths in a controlled
test. Presentation and durable lifecycle can diverge.

Now consider a network interruption rather than duplicate identity. The
correct response may be reconnecting the same visit, not allocating another
invitation use or completing the encounter immediately. Define that policy
in the admission/session boundaries. Do not scatter unrelated timeout guesses
through several components and hope they agree.

## A connection is not the durable visit

Model the patient journey with a durable encounter and one or more transport connections over time. A network interruption can destroy a connection while the same visit remains eligible for recovery. A duplicate identity can replace an old connection with a new one. A final departure can end participation. If all three become the same generic disconnect event, the lifecycle service loses information it needs to preserve the intended consultation.

Use separate labels for the encounter and each connection in a synthetic trace. Connection Pine starts encounter E. Pine loses connectivity briefly. A recovery path reconnects the intended participant to E under the permitted window and binding. The expected result is not a new unrelated encounter for every transport fluctuation. But recovery should not become an indefinite bypass of invitation revocation, expiry or participant authorization. Read the service's actual recovery contract before choosing assertions.

Now test replacement. Connection Oak joins under the same permitted media identity and Pine is disconnected. Pine's page should stop its local media and listeners and explain the transfer without finalizing E. Oak continues. If Pine later sends a delayed leave request, the server must bind that request to its exact scope and reject or safely ignore any effect that would terminate the newer continuing visit incorrectly. The client correction and server guard are complementary defenses.

## Reproduce the ordering deliberately

A useful test controls four moments: new join accepted, old disconnect delivered, new connection becomes active, and old cleanup completes. Explore more than one ordering. Browser callbacks and provider events do not necessarily arrive in the neat sequence shown by a diagram. The service should make legal transitions explicit and treat duplicate or obsolete events according to the intended idempotent policy.

Do not assert only that the old page redirects. A redirect can occur after an incorrect finalization request has already been sent. Inspect the requests and durable encounter state as well as the visible notice. Conversely, suppressing every leave request can preserve the replacement case while leaving genuine departures unrecorded. Include an ordinary final departure as a positive control so the narrow fix does not erase necessary lifecycle effects.

Use separate browser profiles for manual repetitions when the goal is distinct account sessions. Opening another tab in the same profile can share authentication and storage, producing a different experiment. If the goal is duplicate media identity, document that deliberately. Confusing the two scenarios can make a correct replacement behavior look like a capacity failure or an account isolation failure.

## Recovery feedback should describe what is known

During reconnection, the interface can show a pending connection state without claiming that admission was lost. After replacement, it can explain that this connection moved to another page or device. Avoid a generic “consultation completed” message unless the durable lifecycle actually completed. The clinician and patient need to distinguish transport recovery from a clinical workflow decision.

Optional transcription and chat also have resource lifetimes. An obsolete page should not continue sending segments or messages after replacement. Pending operations need their own session and identity guards. A successful media transfer does not automatically prove that every auxiliary resource stopped. Extend the synthetic test to count those effects where the architecture exposes them, while avoiding real audio capture in a routine regression.

The independent exercise is to reason about a delayed successful response from the old connection. It was valid when issued but arrives after the new connection owns the visible state. Should it be applied? Not without checking the request generation and current binding. This is the same temporal-authority pattern seen in authentication refresh and history, now at the transport boundary. Reusing that reasoning is more valuable than writing a special-case flag for every callback.

Document the limitation of a local simulation. It can force lifecycle order and assert service effects, but provider reconnect timing and actual network recovery require a separate controlled media trial. Preserve both layers of evidence without pretending that one replaces the other. A good regression protects the known invariant; a realistic trial investigates behavior that the fake transport cannot model.

## Source trail

Read app/invite/[token]/page.tsx, app/room/[room]/patient/page.tsx and their
duplicate-identity regressions. This chapter explains the distinction between
transport and visit state; it does not promise uninterrupted media under every
network failure.
