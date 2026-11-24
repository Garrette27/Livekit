# 38. Trace room-name ownership and reserved waiting-room namespaces

## The LiveKit boundary to trace

A room name can become an authority coordinate. The server looks up its
owner and may issue transport grants for it. A browser-created room document
is therefore not harmless bookkeeping if another service treats it as proof
that a clinician owns that name. The defense pass found and constrained this
path in room/call creation rules.

The derived waiting-room suffix has a second security meaning. A doctor
must not claim another room's waiting namespace as an ordinary consultation
room. The shared pure room-name policy reserves that suffix and bounds input
before it reaches database keys or token claims.

## A worked lab

In an emulator, test room creation with a patient, a profile-less identity and
a provisioned doctor. Then test the application room-access service with an
ordinary valid name and a case-varied waiting suffix. Include the existing
owner and another doctor so namespace checks do not replace ordinary
ownership enforcement.

Read both the claim and join callers. A rule only in the create form can be
bypassed by another route. A shared boundary is useful because it centralizes
the relevant knowledge, not because every action should be forced through
one generic manager class.

## Exercise with answer

Why is this not fixed by making waiting tokens unable to publish? Disabled
media grants reduce one risk for waiting visitors, but a separate doctor
claim path can issue different grants. Each credential-issuing authority
must enforce the namespace it controls. Defense layers complement one
another; they do not make an unchecked alternate path safe.

A report says the room-creation rules fix is repository-only pending release.
What should the thesis claim? The candidate control passes its emulator
cases, while deployed acceptance remains pending. Do not hide that difference
because the application deployment is green. Rules and application source
have independent release paths.

## Source trail

Read lib/rooms/room-name-policy.ts, doctor-room-access.ts, firestore.rules
and the defense-readiness report. Before running any release command, obtain
the appropriate production authority; this book's lab is isolated and
synthetic.
