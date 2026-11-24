# 30. Chat identity, message keys, retries and bounded payloads

## The LiveKit boundary to trace

A chat message has several identities: the authenticated or admitted sender,
the encounter, the client idempotency key and the durable message document.
The server must resolve sender authority from the signed session context.
The key used to deduplicate retries must also be safe as a storage identifier.
Text that is valid conversation content is not necessarily valid path syntax.

The defense pass addressed fallback keys containing message text. A phrase
with a slash could become an invalid document path. The repair preserves
already safe identifiers and maps unsafe keys to a stable digest. This keeps
retry deduplication while preventing clinical text from becoming a document
path. A separate message-length bound limits oversized requests.

## A worked investigation

Use a synthetic message containing a fraction or URL and send the same
idempotency key twice in an isolated test. Assert that storage uses one stable
safe ID and that the second send is recognized as a duplicate. Then change
the key and verify that a genuinely new message is not accidentally suppressed.
Do not use real clinical dialogue as a fixture.

Inspect session ownership when reading messages. A valid participant in one
room must not name another session and receive its chat. Attachment references,
when eventually enabled, require the same encounter boundary and server-owned
metadata resolution. A message body cannot simply supply a trusted download
URL or extracted clinical text.

## Exercise with answer

Why not remove every slash from a client key? Different unsafe keys can collapse
to the same transformed string. A stable digest of the whole key preserves
distinctions more predictably. The mapping contract also leaves existing safe
IDs intact for compatibility. Explain collision assumptions and bounds
without claiming a hash authenticates the sender.

A message appears in the local bubble before its persistence request returns.
Has it been saved? The visible optimistic state alone does not prove that.
Observe the response and subsequent authorized read. If persistence fails,
the UI should distinguish unsaved local feedback from a durable transcript
or chat record used later as evidence.

## A message has content, sender and intent identity

Separate the text of a message from the identity of the send operation. Two legitimate messages can contain the same text. One send operation can be retried after a lost response. Deduplicating by text merges distinct intentions, while generating a new operation key on every retry duplicates one intention. The client and server need a stable scope for the retry, bound to the correct session and authorized sender.

The server should resolve sender authority from the authenticated or admitted session context rather than trust a request body's claimed role or display name. A patient who types a clinician's name into a field must not become the clinician in durable chat evidence. Display formatting can still use a safe name, but it should not determine permission. This is another example of presentation and authority sharing a shape without sharing a guarantee.

At the pinned implementation, unsafe message identifiers are normalized through a bounded hash-based key rather than used as arbitrary persistence paths. That preserves a stable retry relationship without allowing separators or unbounded values to alter document addressing. Inspect the actual normalization and its namespace. A deterministic key is useful only when its scope prevents unrelated sessions or senders from colliding in a way that changes meaning.

## The lost-response experiment

Create a synthetic session and send one harmless message under operation key K. Let the store commit, then simulate the response being lost. Retry with the same authorized context and key. Expect the service's intended idempotent outcome without a second stored message. Now send the same text under a new key and expect a distinct message if that is the documented contract. These cases distinguish retry identity from content similarity.

Change the payload while reusing K. Determine how the implementation handles that conflict and document it explicitly. It must not silently authorize a different sender or session merely because a key is familiar. A robust contract either binds the key to the original payload or otherwise defines the duplicate behavior narrowly. Do not infer a stronger exactly-once guarantee than the service actually provides.

Test message length at the documented boundary and above it. The baseline's bounded text protects the server and store from arbitrarily large input, but size validation is not a complete moderation or clinical-safety policy. Keep those claims separate. Also test empty or malformed input according to the route schema. A browser text area limit improves interaction, yet direct requests still require server validation.

## Read projections and ordering

A visible chat list should include only messages available to the authorized session participant. A patient in another encounter with the same room label must not inherit earlier chat automatically. Query ordering should be deterministic enough for pagination and repeated retrieval. A timestamp alone may need a tie-breaker when several messages share the same value. Inspect the implementation rather than assuming that chronological appearance guarantees a stable cursor.

If a message is optimistically displayed before server acknowledgement, distinguish pending from committed state. On a retryable failure, preserve the user's text and intent where appropriate, but do not claim delivery. On an authorization failure, explain that sending did not complete without repeatedly retrying a denied command. Modeless feedback can make the uncertainty understandable while keeping the call usable.

For the independent exercise, a user sees a message twice, but the database has one row. Where should you look? Consider optimistic insertion followed by an unmerged server projection, duplicate subscriptions or unstable render keys. If the database has two rows, investigate send identity and retry scope instead. The same visual symptom can originate on either side of the persistence boundary.

Finally, treat chat as sensitive content. It is not suitable for raw debug logs or DataChannel recording by default. A thesis exercise needs synthetic messages and safe counts, not a transcript of an actual consultation. The security of the send path, the correctness of retry identity and the privacy of diagnostic capture are separate responsibilities that must all remain visible in the design.

## Foundational systems reading - adapted companion material

These adapted contract readings clarify idempotency and semantic compatibility. They complement the message-retry exercise by showing why repeatable components, stable keys and apparently matching types do not automatically create a correct complete operation.

## Supplied systems reference - page 164

When should you inspect beneath an abstraction? When its result, cost, failure, or guarantee cannot be explained from the available contract, or when you need to establish a condition the interface does not promise.

Idempotency gives a useful formal example. An operation is idempotent under selected conditions when repeating it leaves the intended state equivalent to the result of one execution. A set insertion exhibits that property for the selected element.

Idempotent components do not automatically make every composition idempotent. A first step can record a key while a later external effect fails; retrying may then skip the incomplete effect. Or two individually repeatable operations can depend on order and produce a different combined result when repeated. Define the business state and failure point, then prove the property you need.

## Supplied systems reference - page 165

Same syntax, same type, and same business meaning are three different compatibility levels. A composition that satisfies one can fail at another. State units, namespaces, versions, and omission meanings at the boundary.

Why should an idempotency key often retain a payload fingerprint or equivalent request identity? It lets the service distinguish a repeat of the same request from reuse of the key for a different operation and reject a misleading collision.

## Source trail

Read lib/chat/chat-message-key.ts, app/api/session-chat/messages/route.ts and
lib/services/video-chat/chat-message-store.ts. A slash-bearing synthetic key
is a focused regression; it is not an invitation to test malicious payloads
against live clinical sessions.
