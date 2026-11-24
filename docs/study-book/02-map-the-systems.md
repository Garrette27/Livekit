# 2. Map the systems before following the request

## One application, several authorities

The word application is convenient for a user and dangerous for an investigator.
A patient reasonably thinks of signing in, joining a consultation and reading
history as one service. The implementation crosses multiple independently
running systems. The browser keeps local interaction state. Firebase
Authentication establishes account credentials. Next.js routes authorize
commands. Firestore persists domain records. LiveKit transports media. Optional
transcription and summary providers perform additional work. Vercel hosts the
frontend and server functions. Git records source history but does not itself
execute a consultation.

Make a map of these roles before tracing a particular error. A useful map says
who owns a decision, what evidence reaches that decision and where a committed
result survives. It does not need every component name or package dependency.
Too much detail at the beginning hides the boundary you are trying to see.
The first map should fit into a paragraph you can explain aloud.

In this project, a signed-in account can present a Firebase token to a server
route. That route checks identity, permissions and ownership before calling a
domain service. The service may transact against Firestore and issue a signed
room credential through a transport adapter. The browser then uses that
credential with LiveKit. A later consultation event can update durable session
state, from which a history projection is built. Every arrow is an opportunity
for delay, rejection, retry or disagreement between local and durable state.

## The browser owns intent, not clinical authority

A button can represent what a person wants to do. It cannot prove that the
person is permitted to do it. A patient can edit a request body in DevTools,
copy a URL or replay a request outside the page. Therefore the server cannot
derive authority from the button that normally sends the request. The same
principle applies to hidden navigation: not showing a faculty dashboard does
not authorize a future faculty endpoint, and showing a doctor control does
not prove a valid doctor token accompanies its request.

This does not make browser code unimportant. The browser must keep feedback
accurate, avoid stale response overwrites, clean up timers, preserve device
preflight and let a call continue without optional transcription. These are
real responsibilities. They are different from deciding who owns a clinical
record. Good architecture distributes work according to the guarantee each
layer can actually enforce.

Consider a waiting queue. Realtime events can tell the browser that something
changed. The authenticated server projection supplies rows filtered by doctor,
room, invitation validity and freshness. If a listener bypasses that projection
and directly publishes raw snapshot rows, the interface has acquired a second
policy implementation. A refresh may show the correct queue while a later
snapshot replaces it with stale history. The design correction is not another
filter scattered across components; it is restoring one owner for the read
projection.

## Authentication is not transport identity

Firebase and LiveKit answer different questions. A Firebase UID identifies an
account within the authentication system. A LiveKit participant identity names
a connection participant within a room. A room token can be valid for a guest
who has no account. An invitation can grant access to a waiting context without
proving the guest's email address. Confusing these identities leads to unsafe
history repair: the browser says that a connection belonged to an email, and
the server silently adopts another record into that person's account.

The current design can include a separately signed Firebase UID binding in an
admission credential when identity was verified. That does not transform every
media identity into an account. Guests remain guests, and historical records
without reliable account evidence are not automatically attached on login.
The design sacrifices a convenient repair shortcut to preserve ownership.
When a system needs reconciliation, it needs its own authorized process and
evidence; an arbitrary cached session ID is not enough.

## Firestore owns durable records, not every interpretation

Persisted data is stronger evidence than an unsent browser edit, but it still
needs interpretation. A stored invitation status of active can coexist with
an expiry in the past. A legacy consultation projection marked active does not
prove anyone is currently connected. A waiting row marked admitted records a
permission decision, not necessarily the presence of a video track. A summary
job marked ready does not prove a clinician reviewed its output.

The map therefore needs both storage and semantics. Name the collection, then
name what its fields mean in the current service. For invitations, effective
availability depends on more than a status string. For sessions, exact encounter
identity matters when rooms are reused. For patient history, consistent recorded
UID ownership matters more than an email match. Reading a database without
knowing those contracts can produce a confident but false report.

## Source control is another separate system

A commit is a durable source snapshot. A branch name points to a commit but
can move. A local working tree can differ from both. A deployment can still
serve an older commit, and Firebase can enforce rules that differ from the
repository file. These are not exotic edge cases; this project's audits found
deployment drift more than once. A complete release sentence names which
application commit is served and which rules source is active.

Do not infer either fact from a merge button. Merging a change may trigger a
deployment workflow, but that workflow can fail, deploy a different project,
or omit a separately released ruleset. Conversely, a successful Firestore rules
release says nothing about whether the frontend packages were updated. The
investigator must follow the release artifacts individually and then test the
journey they are meant to support together.

## Build your first boundary map

Choose a synthetic action: a doctor views their waiting queue. Write the
browser route, the API path, the credential type, the service that constructs
the result, the collections consulted and the UI state updated afterward.
Next to each edge, write its failure category. A missing credential is not a
database quota error. An empty result is not a parser failure. A hidden browser
tab pausing periodic refresh is not the same as a disconnected realtime stream.

Then remove any item you cannot justify from code or observation. If you have
not inspected the actual deployed handler, mark that edge as repository
behavior. If you have only a browser screenshot, do not label a Firestore
transaction committed. Uncertainty written into the map is useful; uncertainty
silently replaced by a guess becomes a future debugging trap.

## Exercise and worked answer

A patient pastes a valid invitation into a new private window and is queued.
The same patient signs in with a provider-verified allowlisted account and
joins directly. Has the application detected that this is the same physical
device? No. The change in admission is explained by stronger verified account
evidence. Device fingerprints and network correlation are not identity factors
in this product. The correct map changes the identity evidence supplied to the
server, not the physical machine at its left edge.

A doctor sees an admitted count of one after the patient closes their laptop.
Has LiveKit failed to disconnect the participant? The count alone cannot answer.
It represents the queue projection's admission state. Compare transport events,
session lifecycle and the relevant row freshness before blaming the media
server. The map prevents a label in one subsystem from being mistaken for a
fact owned by another.

## Source trail

Read `docs/consultation-modular-architecture.md`, `docs/access-control.md`,
`lib/invitations/token-utils.ts`, `hooks/useWaitingQueue.ts`, and
`lib/services/history-summary/summary-projection-service.ts`. The architecture
document contains historical snapshots and planned hooks; verify current
interfaces against source before treating every paragraph as shipped behavior.
