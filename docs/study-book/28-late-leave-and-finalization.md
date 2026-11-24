# 28. Bind late leave and finalization to the correct encounter

## The LiveKit boundary to trace

An event can be validly signed and still be stale relative to the room's
current encounter. The server must ask which visit the event belongs to,
not merely whether the token names the room. This is a temporal ownership
problem: authority includes the exact lifecycle object being changed.

The consultation-integrity repair added identity/session checks and
transactional projection updates so an earlier visit cannot overwrite a
later one. It also keeps patient labels separate when finalizing the exact
session. These are correctness and privacy controls: a misattributed summary
can expose the wrong person's encounter even without an obvious login bypass.

## A worked investigation

Construct an old session and a new session sharing a room. Delay the old
leave until the new session is current. Assert that the old session can be
handled according to its contract without closing or relabeling the newer
projection. Repeat with a transaction interleaving that changes current state
between read and commit. A sequential happy path cannot demonstrate the
race is closed.

Finalization may involve several modules: ending session state, building
evidence, generating or choosing a deterministic summary outcome and writing
a projection. Follow the encounter identifier through every stage. A helper
that rediscovers the session by room name halfway through the process can
undo an otherwise careful binding at the route.

## Exercise with answer

Why should a finalization test include a non-shortcut path? If the test returns
early for insufficient evidence, it may never execute the projection write
that contained the defect. Build a synthetic fixture complete enough to
reach the risky branch, while keeping clinical content fictional. Then add
the shortcut case separately to preserve its intended behavior.

A late event is ignored for the current projection. Does that mean it must
disappear from every audit record? Not necessarily. Recording a bounded,
metadata-only stale-event outcome can support diagnosis without mutating the
wrong encounter. Decide the observation contract independently from the
clinical write contract, and do not log sensitive before/after snapshots.

## Source trail

Read lib/services/consultation-tracking/consultation-tracking-core.ts and
lib/services/consultation-finalization/consultation-finalization-core.ts.
Use the dated race and finalization red-phase evidence to understand which
branches the repaired tests were designed to reach.
