# 19. Trace direct admission and manual waiting-room admission

## The LiveKit boundary to trace

Admission is a state transition with consequences for transport permissions.
A visitor who is not a verified allowlist match gets a waiting credential.
The owning doctor can then admit the exact waiting visit. The patient polls
with a credential bound to that visit; the server must not select a different
admitted row merely because the caller supplies an email.

The admitted response mints a consultation credential. The waiting credential
is not upgraded by changing a browser boolean. Server issuance checks the
current visit and invitation authority, and waiting grants disable media
publication and subscription. This prevents a shared waiting context from
becoming a place where unadmitted visitors can exchange private media.

## A worked investigation

Create two synthetic waiting rows under one invitation. Admit one row and
leave the other waiting. Present the waiting visitor's signed credential
while trying to name the admitted row. The route must reject the mismatch.
Then omit the row ID and supply the admitted person's email. The route must
not perform an email-based fallback that returns the other visit's token.

Repeat the authorized path after expiry and revocation. A token suitable for
polling when issued does not authorize unlimited future consultation-token
renewal. Read the persisted invitation again at the decision boundary. Do
not confuse this issuance rule with the broader operational question of
disconnecting credentials already accepted by a transport server.

## Exercise with answer

Why should admission reuse a reserved visit instead of consuming another
invitation use? The reservation already accounts for that visit. A refresh or
poll should not spend a second visit merely because transport connection is
retried. The transaction and deterministic waiting-row identity keep visit
accounting distinct from browser request count.

The interface says Admitted rather than In room. Explain the difference.
Admission is a permission/lifecycle fact in the queue projection. Live media
presence belongs to transport state and supporting events. A person may be
admitted but still checking devices, disconnected or using a stale page.
Accurate labels reduce the temptation to repair a UI misunderstanding with
destructive database cleanup.

## Read admission as a state transition

The clinician's Admit action is a command expressing intent. The committed waiting-row state is a fact. The browser should display that fact through an authorized projection rather than treating a click as proof that the patient entered the consultation. The patient's media connection is another observation. Admission can succeed while the patient's network is temporarily unavailable, so a label such as “Admitted” is more accurate than “In room” unless the system has evidence of current presence.

Trace the manual path with a synthetic patient. First confirm that validation creates or reuses the correct waiting row and returns only waiting-scoped access. Next have the owning clinician admit that exact row. Then let the patient's admission check obtain the consultation credential under the row's binding. Finally observe the media connection and encounter tracking separately. Each step has a distinct failure mode and a distinct piece of evidence.

Try the same admit request as a different clinician. It must fail even if the room label is known. Then retry the owning clinician's successful request. The service should handle an already-admitted state according to its idempotent contract without creating a second visit. Now reject a waiting row and verify that a stale patient poll cannot use the old row to obtain consultation access. These cases test ownership, repeat intent and stale state rather than merely button visibility.

## Make the waiting-room credential deliberately weak

A waiting token is not a lower-quality version of a full consultation token. It has a different purpose and should lack consultation media privileges. Verify publish, subscribe and data grants explicitly. A room name ending in the reserved waiting suffix must not allow an untrusted caller to create a normal consultation that collides with another room's waiting namespace. Shared namespace policy prevents one layer from accepting a name another layer treats specially.

Do not assume that the patient cannot inspect the token because the interface hides it. Browser-delivered credentials are available to the browser's user. Security therefore depends on grant scope and server validation, not obscurity. The thesis can discuss the grant fields using synthetic decoded structures without saving a live raw token. If a real token has already been pasted into a chat, treat it as exposed and avoid reproducing it in further artifacts.

## Design feedback around the clinician's goal

The invitation workbench should answer what the invitation currently permits and what action is available. A queued visitor, an admitted visitor and an expired invitation are different objects or states. Grouping every historical row under “In room” forces the clinician to infer a lifecycle the system already knows. Modeless inline pending and error states let the clinician understand incomplete commands without blocking the entire call interface.

A retry action should be specific about the operation. Retrying queue retrieval is not the same as retrying admission. Copy feedback should confirm that the link was copied, not claim that a patient joined. Revocation feedback should describe the invitation's new policy state without asserting that every existing media session was terminated unless that effect was actually performed and verified. Precise labels reduce both user confusion and audit ambiguity.

Use keyboard navigation to exercise the card actions. A card containing buttons should not also act as an ambiguous clickable container. Give queue viewing a named action and preserve focus when a modeless update arrives. A clinician using assistive technology should receive meaningful status changes without being moved unexpectedly. These interaction details do not replace authorization, but they reduce operational errors around a security-sensitive workflow.

The independent exercise is to explain a case where the server says admitted but the patient is still on the waiting screen. Possible causes include stale presentation, an unavailable follow-up credential request or a disconnected client. The next observation should distinguish them. Repeatedly clicking Admit may be harmless under an idempotent service, but it is not a diagnosis and can obscure the original sequence.

## Source trail

Inspect app/api/waiting-room/check-admission/route.ts,
lib/services/shared/waiting-room-auth.ts and invitation-access-core.ts. The
exact-visit binding is a security contract, not optional client convenience.
