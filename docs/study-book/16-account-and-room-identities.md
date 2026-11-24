# 16. Account identity is not a room identity

## The LiveKit boundary to trace

The account UID answers which authenticated account is calling. The media
participant identity answers which participant connects to a LiveKit room.
The invitation ID identifies a scoped access grant, and the session ID names
an encounter. A room name can be reused across encounters. Treating these
values as interchangeable makes short fixtures easy and real authorization
dangerous.

The current token verification boundary exposes the media subject and room,
and it can carry a separately signed patient UID binding when the server has
verified that identity. A guest credential remains useful for the invited
visit without becoming an account credential. The server must not infer an
authenticated patient UID from a display name, email typed in a form or media
identity string chosen for transport.

## A worked investigation

Construct two synthetic visits in the same room. Give them distinct session
IDs and media identities. Bind only the verified account visit to a Firebase
UID. Ask the tracking service to process a body that asserts another UID.
The signed credential, not the body, must supply trusted identity. Then test
a guest visit and confirm that it does not silently acquire another person's
history because the guest typed that person's email.

This fixture should use visibly different strings for each identifier. If
every ID is test-user, an implementation that reads the wrong field may
still pass. Test-data design is part of architecture review: the fixture must
preserve the distinctions the production contract depends upon.

## Exercise with answer

An old signed token lacks the new UID binding. Should the server invent the
binding from an email match to preserve convenience? No. A newly issued
credential can include verified evidence after revalidation. An old token
does not gain a trustworthy claim retroactively. Historical repair needs
separate authority and evidence.

Now explain why a doctor display name must be bounded even though it is not
an authorization factor. It still travels through token claims and interface
state, so malformed or oversized input can cause resource and presentation
problems. Security involves both authority and the size/type contract of data
crossing a boundary. Valid authentication does not make every request field
well formed.

## Draw the identities before comparing strings

Write five labels on a page: account UID, invitation identifier, waiting-row identifier, media participant identity and encounter identifier. Connect them only where the implementation establishes a relationship. Do not collapse them into one box named “user.” The account identifies an authenticated principal. The invitation identifies a scoped access object. The waiting row represents a visit awaiting or receiving admission. The media identity selects a participant connection within a room. The encounter identifies the durable consultation whose history and evidence must remain isolated.

Now add display name and email as attributes, not universal keys. A display name can change or be duplicated. An email may be self-declared, provider verified or absent. The source of the assertion changes its authority. A server-verified claim can support the allowlist comparison under the invitation policy, while an arbitrary request body's email cannot. The same characters in two fields do not give those fields the same trust level.

Use a synthetic account with a harmless label and change its display name between two requests. Its stable UID should remain the principal used for owned history. Then create another account with the original display name. The second account should not inherit the first account's records. This experiment is simple enough to predict, yet it catches designs that accidentally use presentation text as ownership.

## Guest access is intentionally a different kind of proof

A guest can hold a valid invitation capability and later an admitted room credential without owning a registered account. That is not automatically a defect. The product permits a controlled guest journey. The security question is what that guest credential authorizes and how narrowly it is bound. It must not become an unrestricted account credential or a license to read historical clinical records from other visits.

Consider a guest who later signs in with an address that resembles a field on the visit. Automatically adopting the visit would be convenient, but it would create an ownership transition that needs its own authority. The baseline avoids using the legacy linking endpoint as a reassignment mechanism. A safe study should preserve the distinction between current authenticated account ownership and a previously admitted guest session. Reconciliation is a separate policy decision, not an accidental side effect of login.

The browser can hold several identities at once: Firebase account state, an invitation URL, a waiting credential and a LiveKit token. Their renewal and expiry behavior differ. A valid media token does not prove that the current Firebase account is still the one used when it was issued. Conversely, signing out of Firebase does not by itself explain what happened to an already-established media connection. Trace the explicit lifecycle rather than assuming a global identity switch.

## Duplicate media identities reveal the distinction

When a second connection uses the same permitted LiveKit identity, it can replace the earlier connection. The old browser observes a disconnect, but the durable consultation may continue in the new browser. If the old page interprets every disconnect as the patient's final departure, it can corrupt the shared encounter. The replacement case therefore needs a distinct local cleanup path that does not finalize the continuing visit.

Build a timeline with connection A, connection B and encounter E. A joins E. B joins with the same intended media identity and replaces A. A receives the replacement event and detaches. B remains active in E. The expected durable result is not “two independent patients” and not “encounter ended when A closed.” The test should assert both the old page's cleanup and the encounter's continued availability.

The independent question is whether a single string can safely serve all five identities. Explain the different scopes, lifetimes and authorities before answering. Reusing a string may be a representation choice, but the implementation still needs to preserve the distinctions. Clear names and explicit bindings prevent a convenient shared value from becoming an undocumented universal credential.

## Source trail

Inspect lib/invitations/token-utils.ts, lib/consultations/identity-utils.ts and
the consultation-tracking service. Keep each identity's owner visible when
designing future reconciliation or analytics features.
