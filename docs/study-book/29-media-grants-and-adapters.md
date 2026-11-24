# 29. LiveKit adapters, media grants and least privilege

## The LiveKit boundary to trace

The application decides whether a visit may enter; the RTC adapter expresses
that decision in transport credentials and operations. Keeping LiveKit-specific
details behind an adapter lets the domain service discuss admission without
making every route construct SDK behavior independently. This is information
hiding, not an excuse to omit security-relevant grants from review.

Inspect the actual room claim and publication/subscription permissions.
Waiting credentials disable media exchange, while admitted consultation
credentials enable the intended call. A signed token with an overly broad
room or grant is still a validly signed security mistake. Cryptography
preserves the issuer's decision, including a bad decision.

## A worked investigation

Decode only synthetic credentials in a local test and assert their room and
grant shapes. Check initial waiting issuance and reconnect waiting issuance;
one fixed path does not prove the other path uses least privilege. Then
exercise the admitted case to confirm media permission remains available.
A security fix that prevents every participant from publishing is not a
successful teleconsultation repair.

Moderation also crosses the adapter. A doctor rejecting or removing a visit
changes application lifecycle state and may request a transport disconnect.
Consider what happens if the transport operation fails or the participant
is already absent. The domain outcome and operational error should remain
understandable without exposing raw credentials or pretending the disconnect
was observed when it was only requested.

## Exercise with answer

A waiting-page UI never renders the video component. Why still disable media
grants in its token? A client can use a credential outside the intended UI.
The credential itself is the enforceable transport boundary. Hidden controls
are not a substitute for scoped permissions.

Now explain why a normal encrypted transport is not automatically end-to-end
encryption. The thesis must distinguish the configured transport protections
from any additional E2EE mode and key-management design. Do not infer an E2EE
claim from a lock icon or a secure WebSocket URL. If that feature is not
configured and tested, keep the claim out of the report.

## Source trail

Read lib/services/video-chat/rtc-transport-adapter.ts,
lib/invitations/token-utils.ts and docs/production-readiness.md. Never include
real signed room credentials in examples or student exercises.
