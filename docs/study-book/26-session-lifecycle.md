# 26. Trace the consultation session from admission to completion

## The LiveKit boundary to trace

A consultation is not identical to a browser page or a reusable room name.
The durable session identifies an encounter and records its relevant events.
Admission, connection, reconnect and completion can occur through different
requests and callbacks. The service must preserve their meaning even when
delivery is delayed or a client disappears.

Begin with the session store's public operations. Starting a session should
return the encounter identity needed by later events. Appending an event
must preserve actor and time semantics. Closing a session must target that
encounter rather than whichever visit now occupies the same room projection.
These interfaces make the lifecycle comprehensible without forcing every UI
component to know Firestore document structure.

## A worked investigation

Use two synthetic sessions that reuse one room. Start the first, close it,
then start the second. Deliver a delayed event from the first and inspect
both the exact session and current room projection. The second visit must
not be reattributed or finalized by the stale event. Include a positive
control where a current event still performs the intended update.

Timeline evidence must be interpreted conservatively. A connection event can
support a presence timeline, but it cannot supply symptoms, diagnoses or
clinical recommendations. If a summary has no transcript evidence, the
lifecycle can still be recorded while clinical fields remain unknown or
empty. A useful operational record is not automatically a clinical narrative.

## Exercise with answer

Suppose a patient never joins after an invitation is created. Should the
system invent a short consultation summary based on elapsed time? No. The
deterministic no-show or never-admitted outcome should describe the missing
encounter evidence rather than infer clinical content. The same rule applies
when a call connects too briefly to provide reliable speech evidence.

For a design review, identify where duplicate start events become idempotent
and where a genuinely new encounter is allowed. Avoid a vague promise that
every repeated room name returns the same session forever. Reuse conditions
depend on lifecycle and identity, not string equality alone.

## Source trail

Inspect lib/services/video-chat/consultation-session-core.ts,
lib/consultations/consultation-session-store.ts and the consultation tracking
and finalization services. Historical architecture notes describe intended
contracts; current code and focused tests establish the actual branches.
