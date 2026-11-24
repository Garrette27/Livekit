# 15. Inspect browser storage without collecting credentials

## The LiveKit boundary to trace

Browser storage is useful for explaining continuity, not for granting durable
ownership. A pending consultation ID cached in a tab can help an interface
resume work, but it cannot prove that the signed-in person owns the stored
encounter. The consultation-integrity repair removed self-service historical
reassignment based on browser IDs and email matches. This is a deliberate
security tradeoff, not a missing convenience to restore casually.

Separate Chrome profiles and private windows provide distinct browser-session
contexts. They are useful for testing doctor and patient journeys without
sharing the same local authentication state. They do not create separate
backend projects, isolated Firestore records or different LiveKit identities
when the server issues the same participant identity. Two simultaneous joins
with one identity can replace the earlier connection even across browsers.

## A worked investigation

Use synthetic accounts and observe the names of storage keys, their lifecycle
and the action that reads them. Avoid exporting values containing credentials
or clinical data. Ask whether clearing one key changes a UI shortcut, an
authentication session or a durable backend record. These effects are not
equivalent, and deleting storage indiscriminately can conceal the original
failure while making a test harder to reproduce.

If an invitation token appears in a URL, treat the URL as sensitive. A shareable
report should show a redacted route shape rather than the complete path. The
same caution applies to WebSocket URLs and debug dumps. A tool describing a
recording as local does not make it appropriate to upload or include in a
thesis appendix.

## Exercise with answer

A patient opens the same invitation in two isolated profiles and the first
call disconnects. Does that prove that signing in revoked the first Firebase
session? No. Inspect the transport disconnect reason and issued participant
identity before making an authentication claim. Duplicate-identity replacement
is a transport event; finalizing the shared consultation from the old page
would be a separate lifecycle bug.

A teammate wants to repair missing history by trusting a stored session ID.
Ask what evidence binds that ID to the current authenticated UID. If the
answer is only that the browser supplied it, the proposed repair turns local
state into authority. Keep the history hidden until a separately authorized
reconciliation process establishes ownership. Availability of convenient
state does not make it trustworthy state.

## Foundational systems reading - adapted companion material

These adapted browser-security readings separate origins, cookies and sessions. They support investigation of the actual authentication path without implying that every example mechanism is used by this application or that browser policy replaces server authorization.

## Supplied systems reference - page 110

An origin is the combination of scheme, hostname, and port. Two URLs differing only in port have different origins. "Site," used by cookie SameSite rules, is a different grouping concept; do not substitute it for origin. A cookie is browser-managed data attached according to its scope and policy. A session is the application's arrangement for relating requests to authenticated state, often through an opaque cookie identifier.

Cookie attributes have separate effects. HttpOnly restricts script access to a cookie but does not prevent the browser from sending it on eligible requests. Secure and SameSite affect transmission conditions; Domain and Path affect scope. Browser privacy policies can further restrict cookies. Do not expect a CORS header to override all these policies or a cookie Path to provide robust authorization.

## Supplied systems reference - page 111

Curl can read a response that browser fetch blocks. Does that prove the browser lacks authentication? No. Browser origin policy can block response access independently of server authentication.

A web page is produced by several layers: server output, downloaded scripts and styles, browser caches, client state, and DOM mutations. Editing one source file does not establish that the browser received the resulting artifact. Even receiving it does not prove that a particular selector or component controls the element you are looking at.

## Supplied systems reference - page 112

Clickable appearance is also a behavior contract. A native button supports keyboard focus and activation semantics. The disabled attribute blocks ordinary interaction differently from merely dimming an element with CSS. A pointer cursor or hover color supplies a visual cue, but it cannot create a click handler or authorization. A loading state should make repeated actions understandable and expose eventual success or failure.

Assign a correlation identifier at a trusted boundary, propagate it deliberately, and keep a separate operation or job identifier where completion matters. A request identifier answers "which request context was this?" A job identifier answers "which unit of background work was this?" A retry can share a business-operation identity while receiving a new transport request identity. Do not collapse these distinctions into one string simply because it is convenient to search.

## Source trail

Read lib/consultations/pending-session-client.ts, the legacy linking route and
docs/access-control.md. Use synthetic examples in every storage exercise and
keep real account credentials out of screenshots, logs and study notes.
