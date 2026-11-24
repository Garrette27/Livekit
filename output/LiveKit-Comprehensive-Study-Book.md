# 1. A green build and a broken consultation

## Begin with a contradiction

A patient opens the login page. The page itself appears. The Google button is
visible, the browser has downloaded JavaScript, and a deployment dashboard says
the application is ready. Yet the patient cannot load consultation history.
The screen displays a parser error beginning with an unexpected less-than
character. In another window the doctor's queue fails, and the doctor-access
request returns an HTML error document. These observations seem inconsistent
only if you treat the application as a single operation with one status.

The useful question is not whether the website works. It is which operation
failed, which interpreter produced the failure, and what the successful build
actually established. A build can establish that source transforms and selected
checks completed in its build environment. It does not establish that every
runtime dependency can load in a hosted function, that credentials can reach a
database, or that two participants have exchanged media. Each is a different
claim with a different witness.

This book starts with that distinction because the LiveKit thesis application
has already supplied a concrete example. In the November investigation,
production functions reported an error while a CommonJS dependency attempted
to require an ESM dependency. The path involved Firebase Admin authentication,
jwks-rsa and jose. The failure happened before the intended route handler could
return its normal JSON envelope. A client that immediately parsed the HTML
failure as JSON then showed a secondary parsing error. The visible message was
real, but it named the wrong layer for repairing the cause.

## Separate the four observations

Write four sentences before editing anything. First, the login document was
available. Second, one or more API requests returned a server error. Third,
their response body was HTML rather than the JSON the caller expected. Fourth,
runtime logs identified a module-loading failure. These sentences are not
interchangeable. The first concerns rendering an entry page. The second
concerns an endpoint invocation. The third concerns a response contract. The
fourth supplies a candidate mechanism connecting the failed invocation to
the unexpected body.

Now state an alternative. Perhaps the browser called an incorrect endpoint
and received a framework fallback. Perhaps deployment protection intercepted
the request. Perhaps a server import failed. The browser response alone cannot
choose between every alternative. The next discriminating check is therefore
to match the request path and time to the responsible deployment's runtime
output. Looking at an unrelated deployment's build log might be interesting,
but it would not discriminate these explanations.

When investigating, preserve enough context to perform that match without
preserving secrets. A sanitized record can include the path, method, status,
response content type, deployment identifier, approximate time and generic
error category. It does not need the bearer token, full invitation URL, patient
email or clinical response. The investigation becomes safer and easier to
share when the evidence is narrower than the browser's default export.

## Follow the causal chain

The chain in this incident is a sequence of conditional guarantees. A browser
action caused an API request. The platform attempted to load the function.
Loading the function required its dependencies. A dependency used an import
mechanism incompatible with the effective runtime behavior. The function
therefore failed before its normal application response. The platform supplied
an error page. The client parser expected JSON and raised another error.

Notice how different repairs would affect different links. Wrapping response
parsing in a friendly error message improves the patient's explanation but
does not repair dependency loading. Changing the dependency boundary can
restore the endpoint but does not prove the client behaves well during the
next outage. Disabling authentication to avoid loading its dependency would
destroy the security boundary rather than repair availability. A strong repair
must preserve the intended operation and its authority, not merely remove
the visible red message.

The repository records a narrow jose override beneath jwks-rsa and a startup
regression that loads Firebase authentication with experimental require-module
support disabled. The point is not to memorize that override for every future
project. It is to learn why the test targets the missing guarantee. Compilation
had not exercised the same loading constraint. The added regression did.

## A controlled local investigation

Use a clean checkout or worktree and inspect the declared Node version before
running a build. The source baseline for this book declares Node 22.x. Record
the executable and its version rather than relying on the terminal's color or
the fact that another terminal worked yesterday. Inspect the dependency chain
with npm's package listing command, and read the relevant installed package
metadata. Do not copy production environment files merely to reproduce a
module import. The startup question does not require patient credentials.

Predict the result of loading the authentication package under the selected
runtime constraint. Run that single check before launching the entire app.
If it fails, retain the exit code and the generic module error. If it passes,
do not declare the incident solved yet: the local package tree or runtime may
differ from production. Compare the lockfile and deployment source. The same
module path in two error messages is useful evidence, but identical filenames
are not a substitute for matching versions and environment.

After a candidate repair, run the narrow startup test, then the broader gate.
For this repository the gate includes maintained security regressions, lint,
typecheck and a production build. Next.js development and build tasks share
generated state, so run them sequentially when the same worktree is involved.
An overlapping process can make generated type files disappear and create a
runner failure that looks like a source defect.

## What counts as success

There are several legitimate stopping points, and each needs its own label.
The startup regression passing means the tested local dependency boundary
loads under that constraint. A successful deployment means the platform
published a particular build. A missing-credential request returning JSON 401
means the tested public endpoint rejected an unauthenticated request without
the previous HTML startup failure. None of these proves successful authenticated
history loading, and none proves a working consultation between two people.

This precision is not pessimism. It lets the team make progress without
inventing evidence. You can close the startup incident while leaving a
positive authenticated journey pending. You can acknowledge a clean production
dependency inventory while retaining a separate development-tool advisory.
You can explain why optional AI is unavailable without claiming that the video
transport is broken. Good engineering keeps these conclusions separate.

## Exercise and worked answer

Suppose the landing document returns 200, the queue endpoint returns HTML 500,
and a media-region request returns 200. What has been proved? The landing
document and region-list requests succeeded at their respective boundaries.
The queue operation failed, and its body did not satisfy the client's expected
JSON contract. No observation yet proves that a doctor and patient exchanged
audio or video. The next useful evidence is the queue request's matching
runtime failure, not another screenshot of the landing page.

Suppose a teammate proposes catching every API error and returning success
with an empty array. Reject that proposal. It erases the distinction between
an empty queue and an unavailable queue, misleading the doctor at precisely
the moment reliable feedback matters. A better response is a generic,
retryable service explanation where appropriate, while preserving denial for
authorization failures. The repair should make the state understandable
without pretending that an uncompleted operation succeeded.

## Source trail

Read `package.json`, `lib/firebase-admin.ts`,
`tests/queue-and-auth-regressions.test.mjs`, and
`docs/testing/rules-release-2026-11-19.md`. Use the dated readiness reports as
historical evidence, not as proof of the current deployment. This chapter is
an explanation of a recorded incident; its exercises are not new production
test results.


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


# 3. Evidence, authority and the smallest useful experiment

## Start by choosing a claim you could lose

An investigation is useful when an observation could show your explanation
wrong. If every possible result can be described as confirmation, you are not
testing an explanation. You are collecting illustrations. The distinction is
especially important in a thesis prototype because a team can accumulate
screenshots, test logs and diagrams without resolving the question the panel
actually asks: what does this evidence establish about your system?

Take the sentence, "The video call is fast." It has no defined workload,
population, metric or threshold. A fast login document and a low-latency audio
stream could both be offered as support, although they measure different
operations. Replace it with a claim whose conditions are explicit. For example,
under a specified pair of devices and network conditions, the selected media
transport's round-trip time remains within the predeclared budget for the
specified fraction of observations. That is narrower, but it can be tested.
It also immediately exposes information you have not collected.

Security claims need the same treatment. "Patients cannot change roles" could
mean the interface lacks a role selector, a particular API refuses a role
parameter, or the deployed Firestore policy denies a direct role update.
Those are three different boundaries. The original profile incident mattered
because source intent and deployed enforcement differed. The decisive test
was not a screenshot of a patient dashboard. It was the relevant operation
against the relevant policy, with a positive control showing that permitted
owner access still worked.

## Authority and evidence are not synonyms

Authority is the system allowed to decide an operation. Evidence is what you
observe about that operation. A browser screenshot is evidence of displayed
state, not authority to update a clinical record. Firestore rules are one
authorization boundary for client SDK operations. A server using privileged
administrative access must enforce its own policy; it cannot assume those
client rules will protect every server query. A signed LiveKit token gives
transport permissions within its claims, but it does not retroactively prove
the person using it controls an email address.

This distinction helps locate an experiment. To test patient-history
ownership, exercise the server projection with identities and conflicting
record shapes. To test direct client writes, use an isolated Firebase emulator
with the exact rule source under review. To test a rendered status message,
observe the interface and its accessible status semantics. A single test can
cross several boundaries, but you should know which assertions cover which
guarantees. An end-to-end label is not a substitute for that accounting.

## Control the variables you can

Imagine two hypotheses for an allowlisted patient being queued. One says the
server deliberately ignores Google verification. The other says a later
validation request omitted the Firebase token. Change the sign-in provider and
many incidental variables may change with it: profile existence, consent state,
token freshness and cached browser state. A better first experiment compares
requests that differ only in verified identity evidence, while holding the
invitation and policy fixture constant.

The admission policy tests can establish that Google and verified password
accounts provide equivalent evidence. A wiring test can establish that the
single invitation-validation path sends the refreshed token. A browser test
can then exercise the chosen journey. These tests complement one another.
Neither a pure policy test nor a screenshot of successful Google login alone
proves that every client path supplies the correct credential.

Use synthetic identities in isolated environments. Write down what a fixture
represents. A patient UID, a media participant identity and an invitation ID
should not accidentally share one string merely because the fixture is short.
That can make an invalid implementation appear correct by collapsing the
very distinction the test is meant to protect. If the production bug involved
two encounters sharing a room, the test needs two encounters, not one record
with an updated label.

## Positive and negative controls belong together

A negative control asks whether an operation that should fail actually fails.
A positive control asks whether the corresponding permitted operation still
works. Denying every request is an easy way to make a negative-only security
suite green and an excellent way to destroy a product. The thesis application
needs both privacy and an achievable doctor/patient journey.

For private profiles, pair another-user read denial with owner-read success.
For consultation rules, pair denied client writes with allowed reads for the
intended current and legacy participant shapes. For faculty preparation, pair
wrong-reviewer, wrong-session, expired and malformed-assignment denials with a
valid exact assignment. Remember that this policy remains preparation, not a
shipped review interface. A local positive case must not become a claim that a
faculty user can currently browse clinical records.

For queue performance, a useful positive control is the refresh that occurs
when a hidden tab becomes visible. If a test only asserts that hidden tabs
have no timer, a broken implementation that never restarts could pass. Add
the return-to-foreground behavior and final cleanup assertions. The invariant
is efficient reconciliation, not permanent inactivity.

## Keep time and counts in their proper roles

A deterministic test can prove that one hundred same-scope consumers share one
in-flight request. That is an operation-count result, not a production latency
measurement. It supports the architectural claim that duplicate callers do not
necessarily multiply concurrent requests in the tested module. It cannot tell
you the number of Firestore reads billed during a real day, because realtime
listeners, query result size, cache behavior and other routes contribute work.

Likewise, several thousand per-second samples from one call are not several
thousand independent calls. They describe variation within a particular run.
If your thesis discusses repeatability across conditions, repeat calls and
preserve device and network strata. Do not hide a difficult run by averaging
its percentile with an easier run's percentile. Keep the raw numeric sample
set, the derivation method and any predeclared exclusion rule.

## Preserve the failed experiment

The repository keeps dated red-phase observations and passing retests. That
history matters because it shows what the repair was designed to distinguish.
A test written only after a repair can still be valuable, but you have not yet
shown that it would catch the former defect. One way to gain confidence is a
controlled mutation: remove the relevant binding in a local candidate and
confirm the focused regression fails. Restore the source before the passing
gate and record both states honestly.

Do not perform a production attack merely to get an impressive before-and-after
image. Retrieved active rule source can be tested in an emulator with synthetic
documents. The source-match observation and the emulator result establish
different parts of the argument. State them separately: the deployed source
matches the reviewed file; the matching policy denies these synthetic attack
operations under these identities. Avoid claiming an exhaustive independent
penetration test from a bounded suite.

## Exercise and worked answer

A teammate says that twelve rules tests passed, so authentication is secure.
Ask what each test exercises. A rules suite may cover client read/write paths
while a server endpoint uses administrative access. It may use repository
rules while production still serves an older source. It may contain only
negative controls. The correct next step is to identify the missing boundary,
not dismiss the suite. Tests are useful evidence when their scope is visible.

Another teammate measures a cached landing page ten times and proposes a
five-hundred-user call-capacity claim. The valid conclusion concerns those ten
HTTP observations under that cache and client condition. A call-capacity
experiment needs concurrent media clients and authenticated application work,
with a safe staging environment and stop conditions. The original pilot can
stay in the thesis; its interpretation must become smaller, not disappear.

## Source trail

Read `tests/security-policies.test.mjs`,
`tests/queue-and-auth-regressions.test.mjs`,
`functions/test/security-rules.test.cjs`, and
`docs/testing/performance-assessment.md`. The performance protocol supplies
proposed project budgets, not universal clinical standards. Write your
experiment's conditions before interpreting its numbers.


# 4. Read the repository as a set of decisions

## Do not begin by reading everything

A repository contains many kinds of text: implementation, tests, configuration,
historical reports, generated files, plans and examples. Reading them in file
order is rarely the fastest path to understanding a symptom. Instead, identify
the decision that must have occurred for the observed behavior to happen. Then
find the module that owns that decision and inspect the information it receives.
You are building a causal explanation, not memorizing a directory tree.

If a patient is queued, the question is why the admission decision selected
waiting rather than direct entry. Start with the validation route and the
admission policy, then inspect verified identity and invitation constraints.
Do not begin with the video layout. If a chat message fails only when it
contains a slash, inspect the path from client idempotency key to document ID,
not the CSS of the chat bubble. If a later visit appears to close when an older
tab disconnects, inspect encounter binding and lifecycle updates.

This technique makes a large application manageable. Each investigation names
a small set of files, but it does not pretend those files form an isolated
world. Follow imports when they carry an important policy or side effect.
Stop following when a dependency's interface is sufficient to answer the
current question. Information hiding is useful to the reader as well as the
original author.

## Classify the file before trusting its claims

The architecture guide describes deep modules and stable contracts. Some
sections are historical implementation snapshots and others describe future
hooks. Current source may have evolved. A testing report records what happened
in a dated environment, not an eternal promise about the latest deployment.
An AGENTS.md file supplies engineering instructions, but a local modified copy
is not automatically the same text used by CI. Generated framework output can
show what a particular build produced without being the correct place to edit
the feature.

Before using a paragraph as evidence, label its role. Is it executable policy,
an asserted test, a design intention, a recorded observation or a proposed
experiment? These labels prevent a common mistake: quoting a planned module
as though it were an implemented route. They also prevent the opposite
mistake, discarding valuable historical context merely because newer source
exists. Old reports explain why an invariant was introduced; current code
shows whether it remains enforced.

## Follow the input across trust boundaries

Consider doctor room access. The request supplies a room name, but the server
must decide whether the authenticated doctor may claim or join that name.
The current baseline uses a pure room-name policy to reserve the waiting-room
suffix. That suffix is not cosmetic. It identifies the derived waiting context.
Letting another doctor claim that namespace as an ordinary consultation room
could create an unintended transport permission path.

Read the policy's interface comment before its expression. It explains why
the rule belongs in a shared room-access boundary rather than in one form.
Then inspect its callers. If both claim and join paths use the boundary, a
future UI change cannot silently bypass the suffix rule. A source-contract
test can pin that wiring, while a pure policy test covers malformed values,
case handling and bounds. Neither test alone replaces ownership checks on
the persisted room record.

Notice a second boundary: rules governing browser writes to room documents.
Even a correct server room-access service cannot prevent every direct Firebase
client write if deployed rules allow an unintended actor to create the
authoritative record. The November defense report records such a fix and
explicitly separates repository policy from its publication status. The reader
must preserve that separation rather than assume one shared function secures
every route to durable state.

## Find the owner of repeated knowledge

Repetition is a signal, not automatically a defect. Two functions can use the
same word while enforcing different concepts. A Firebase UID and a LiveKit
identity are both identifiers but should not be merged into one generic
identity field. Conversely, five screens interpreting one reusable-invitation
sentinel independently create opportunities for presentation drift. A named
constant and one presentation helper give that storage convention a clear owner.

Ask whether changing a rule requires synchronized edits in several places.
If it does, determine whether those places are legitimate adapters or
duplicated policy owners. A transport adapter converting a room-token request
into SDK claims has a distinct abstraction. A UI helper repeating the entire
server admission decision does not. The goal is not to remove every small
function. It is to remove the need for readers to understand several modules
simultaneously just to know one rule.

## Read failure paths as carefully as success paths

Routes often look straightforward when their dependencies work. A real
incident exposes how they classify failure. Does a quota error become a
retryable service-unavailable response? Does a permission denial remain a
denial? Does a missing secret fail closed? Does an arbitrary exception leak an
internal document path or clinical text into a browser message? A broad catch
block can make a route appear robust while destroying these distinctions.

The repository centralizes unexpected-error responses and database
availability classification. This is a deeper module because callers request
an appropriate response without knowing every SDK error representation. It
does not authorize swallowing every exception. A classifier that treats a
permission error as a temporary outage sends the wrong instruction to both
the user and the operator. Tests should include confusing nearby inputs, not
only the desired status codes.

## Use tests as executable counterexamples

When you find a guard, ask what would happen if it were absent. In the chat
key policy, unsafe client keys become stable hashed document IDs. A test with
a slash-bearing fallback key exercises the reason for the policy. A test that
only passes a simple alphanumeric key could leave the original failure
untouched. For summary edits, test the boundary lengths, wrong types, list
limits and edit-history bound. A valid short summary is necessary but not
enough to demonstrate resource-exhaustion protection.

Then inspect how the test reaches the real code. Some tests transpile the
actual TypeScript module and replace IO dependencies with controlled adapters.
This is stronger than testing a duplicate implementation inside the test,
but it still has limits. If the fake database cannot represent a transaction
race, passing the fake does not prove that race impossible. If the test extracts
a callback from source, a large refactor may require changing the extraction
without changing the underlying behavioral contract.

## Exercise and worked answer

You are asked to explain why summary edits are limited. Start with
`summary-edit-policy.ts`, not the textarea component. Identify allowed fields,
their type checks, individual bounds and the edit-history limit. Next inspect
the summary-management service to see whether it uses the validated result and
preserves ownership and reviewed state. The answer should connect the input
boundary to storage behavior. Merely listing constants does not explain why
the design resists malformed clients.

Now imagine a teammate proposes a universal validation framework for this
single policy. Compare the cost of learning and configuring the framework
against the current dependency-free function. A proven pattern is not a
license to add abstraction everywhere. The existing function is testable,
has a narrow typed result and owns the current edit contract. Extend it when
the product needs a new field; introduce a broader framework only when repeated
real requirements justify its interface and migration cost.

## Foundational systems reading - adapted companion material

These adapted editor readings deepen the distinction between textual navigation, language analysis and runtime evidence. Use their disposable editing examples to improve source investigation; they do not establish that any particular LiveKit request executed.

## Supplied systems reference - page 64

Moving to the first nonblank character expresses a boundary; moving left seventeen times expresses a measurement that must remain true. Yet structural commands also make assumptions. A blank line, missing delimiter, wrapped search, or altered mapping can change the path of replay. Try one execution and inspect it before applying a larger count. When a sequence causes a movement error, repeated execution may stop rather than provide an all or nothing transformation.

Dot does not mean replay the entire last macro or any arbitrary Ex command. A macro stores keys, not a snapshot of the buffer or guaranteed outputs from external commands. It uses current editor state, and recording into a replaces that register's previous contents. Undo grouping can differ between typed changes and macro execution; inspect the actual history instead of promising one undo for every imagined logical task.

## Supplied systems reference - page 65

Why does a macro that ends with j compose naturally across consecutive lines? Answer: it leaves the cursor where the next execution expects to begin. At the last line that assumption fails, so inspect the boundary instead of extrapolating the earlier success.

Search describes a candidate location; substitution describes a transformation over a chosen range. Keeping those two stages separate is a strong editing habit. Before changing text, first make sure your pattern identifies the intended candidates. A matching spelling can still occur in a comment, string, unrelated variable, or example.

## Supplied systems reference - page 66

Confirmation is useful when textual candidates require judgment, but it is not a substitute for a good pattern. If every proposed match is surprising, cancel and revise the description. The feedback tells you which assumption failed: range, case, boundary, or interpretation of punctuation. You are debugging a small language expression rather than guessing a more powerful command.

Normal commands operate from a cursor position. Ex commands give you another useful perspective: select lines, then apply an operation to that selection. A :global command first identifies matching lines in its range and then executes its command for those lines. It does not require you to move manually to every occurrence. That separation resembles choosing a set of records before applying an operation, although text lines do not have database transaction guarantees.

## Supplied systems reference - page 67

What has been demonstrated when a quickfix window contains two KEEP entries? Answer: a particular search found two locations in the specified fixture. No test executed, and no claim about two runtime executions follows from those locations.

Navigation tools answer different kinds of question. Text search asks where a spelling occurs. A tag index records named locations, often declarations or definitions extracted from source. A language server can use language analysis to offer definitions, references, types, or diagnostics. A runtime trace records what happened during a particular execution. Each makes some uncertainty smaller; none should silently inherit the authority of the others.

## Supplied systems reference - page 68

Language servers are not uniformly simple static indexes, and tag generators are not uniformly mere string scanners. The useful boundary is the evidence each operation actually provides. Neither an LSP reference count nor a tag jump proves a complete runtime call graph or a behavior preserving rename.

## Supplied systems reference - page 69

A definition jump reaches a function successfully. What remains unproved? Answer: that the relevant request actually invokes that function with the values and environment you are investigating.

Good navigation preserves the question that caused you to move. A jump into a helper can answer one question while making you forget the caller's context. Vim provides two complementary ways to preserve locations: an automatically maintained jumplist and deliberately placed marks. Their value is continuity of reasoning, not just reducing the number of keystrokes used to travel.

## Supplied systems reference - page 70

Marks are handles for navigation, however, not durable semantic addresses for an expression through arbitrary rewrites. Project search supplies breadth that local motion cannot. Choose the root and file set intentionally, then use a result list to visit candidates. Record the question next to the list: "Which request entry calls this service?" is more useful than an unexplained collection of matching names. As your investigation branches, preserve an anchor for the question you temporarily suspended. Returning to it should recover an argument, not only a cursor position.

Control I is often transmitted as the same character as Tab, so terminal handling and mappings can affect it. Jump history, marks, and the tag stack are distinct mechanisms. Position tracking may adjust as text changes, but it does not guarantee that the location retains the same program meaning. Search scope and ignored or missing files limit any apparent project coverage.

When should you place a mark instead of trusting repeated Control O? Answer: when a particular location must remain an explicit anchor while the investigation creates many intervening jumps.

An editor configuration layers executable behavior onto a program. Startup files can set options, define mappings, and load other files. Runtime directories supply plugins, filetype support, and help. A plugin may introduce mappings, background processes, dependencies, or work performed whenever a buffer changes. Understanding that cost is part of understanding the tool, just as understanding middleware helps explain a web request.

## Supplied systems reference - page 71

A mapping still changes the language your fingers use, so choose its scope deliberately. A buffer local mapping for a specific filetype can be appropriate when the action depends on that filetype. Overwriting a common motion globally changes every experiment that assumes the original motion.

Add configuration to resolve an observed need, then retain a way to explain and disable it. Startup timing can identify loading costs where the build supports --startuptime; it does not capture every later cost of completion, indexing, or rendering. A capability that saves real effort may justify its overhead. The goal is behavior you can account for.

Option scope varies: number is window local, while many text editing settings are buffer local or global. Nonrecursive mapping rules have documented special cases, including plugin mapping conventions. A clean startup and a configured startup can also differ in compiled features or executable selection if you launch different binaries; configuration is not the only possible variable.

A key behaves unexpectedly. What should you inspect before editing a vimrc? Answer: the applicable mode's mapping with :verbose, the relevant option values, and the executable's features. Diagnose the active behavior before changing its source.

## Supplied systems reference - page 72

Deliberate practice begins with a question you can answer. A useful ten minute session might ask whether you can select a word predictably, preserve a yank across a deletion, or return to a caller after three investigative jumps. Choose one behavior, predict its result, execute it on disposable text, and explain any mismatch. Your goal is reliable control under ordinary working conditions.

Treat surprising editor behavior as a debugging problem. Reproduce the smallest input sequence, identify the expected state, and compare a configured session with the controlled baseline. Change one factor at a time. Terminal input, editor version, compiled features, mappings, options, and plugins are different possible causes. Installing a different configuration before locating the cause can hide the problem without teaching you what happened.

## Supplied systems reference - page 74

For each proposed call-graph edge, record its basis: explicit call, imported binding, attribute access, textual coincidence, tag destination or language-server suggestion. Follow the actual code toward a request entry and the service boundaries relevant to the question. Do not force every function into a preferred architecture when the evidence shows a different arrangement. Use simultaneous editor views only when they preserve useful context.

In scratch notes, record three short statements: an observation about the input, an observation about an operation using it, and a remaining uncertainty about execution or persistence. Include source locations. A diagram is optional; precise sentences suffice.

Finally, practice one editing idea on a disposable excerpt you created yourself. Predict an inner word change, repeat it at another word, and undo it. Inspect a register before putting text. If a command surprises you, reproduce it in the clean lab and inspect its mode, mapping, and options. Do not turn that exercise into a repository fix. Quit the scratch session according to whether you intend to retain its notes, and leave the reading session without saving unintended changes.

You have completed the capstone when you can explain both the code investigation and the editor's behavior: which information you followed, which evidence supports each relationship, which operations changed only memory, and why your exit did or did not write a file. That explanation is a more durable achievement than recalling the longest command in the chapter.

## Source trail

Read `lib/rooms/room-name-policy.ts`,
`lib/services/room-access/doctor-room-access.ts`,
`lib/chat/chat-message-key.ts`,
`lib/services/summary-management/summary-edit-policy.ts`, and
`docs/testing/defense-readiness-2026-11-22.md`. Keep the source baseline visible
when discussing these examples: this chapter teaches how to examine that
implementation, not how to infer that every fix is already active in production.


# 5. Keep an investigation notebook that another person can use

## Write for the person who was not there

An investigation often feels obvious while its windows are open. You remember
which profile was signed in, which tab was old, what the screenshot omitted
and why a command used a particular directory. Tomorrow, those details are
gone. A teammate reading the report never had them. The notebook's job is to
preserve the distinctions required to reconstruct your reasoning without
preserving every sensitive byte you happened to see.

Start each entry with a question, not a verdict. "Why does the patient see an
empty history?" is a useful question. "Firebase is broken" is an explanation
that has outrun its evidence. Next identify the environment and source state.
Record whether this is an isolated emulator, local application, staging system
or production observation. If you know the source commit, name it. If you know
only the remote branch tip, say that instead of inventing a deployment match.

Then record the actor category and action using synthetic or generic labels.
"Patient account A refreshed its own history" is enough for a shareable
fixture report. Real names and email addresses rarely improve the causal
argument. Their presence creates an unnecessary privacy obligation and can
make a useful report impossible to share with a professor or independent
reviewer.

## Keep observation separate from interpretation

An observation might be that a request returned 503 with a generic database
unavailable code. An interpretation might be that a free-tier quota was
exhausted. The status code alone supports only the first sentence. To support
the second, connect the operation to a specific provider error or approved
quota observation. The distinction protects you from reporting every timeout
as a billing issue and every billing issue as a software crash.

Use two paragraphs when the distinction matters. In the observation paragraph,
describe what an instrument returned. In the interpretation paragraph, explain
why that result favors a hypothesis and what remains uncertain. This simple
writing habit improves technical conversations because another person can
challenge the interpretation without having to dispute a faithfully recorded
observation.

The notebook should also preserve an alternative explanation. If a queue
appears to contain months-old patients, one possibility is stale database
state. Another is that a realtime callback overwrote a correctly filtered API
projection. Both can produce similar pixels. The next discriminating check is
to compare the data path before and after the callback, not immediately delete
old rows. Writing the alternative makes the eventual repair more strategic.

## Choose an artifact for each claim

Different claims need different artifacts. A source hash supports exact file
comparison. A sanitized test log supports a recorded assertion and exit code.
A numeric WebRTC series supports a metric calculation under its sampling
conditions. A screenshot can support an interaction or layout observation.
No artifact is universally authoritative, and a folder full of them is not
automatically an evidence package.

For a regression, retain the failing assertion, the source state that produced
it, the candidate change and the passing retest. If you keep a structured
summary instead of a verbatim log, label it as such. Do not recreate a plausible
log after the fact and present it as captured output. The structured red-phase
records in this repository can be useful precisely because their scope and
provenance are stated.

For a deployment, retain the publication outcome and a separate active-source
check. A deployment command saying complete establishes an action by the
deployment tool. Retrieving the active Firestore source and comparing it to
the reviewed policy establishes the resulting rule state. Testing equivalent
source with synthetic identities in an emulator then exercises its behavior
without hostile writes to the live project. These observations form an
argument together; none should be silently substituted for all the others.

## Make the result reproducible without secrets

A command that requires a bearer token pasted into its text is a poor artifact
for a study book. Shell history, terminal capture and copied snippets can all
spread that token. Prefer commands that use established local authentication
or synthetic fixtures. When a secret is required operationally, name the
configuration variable and its purpose, not its value. Avoid dumping an entire
environment to prove one variable exists.

The same rule applies to browser exports. A HAR, WebRTC dump, screenshot or
storage snapshot can include more than the metric you need. A safe numeric
record might contain a pseudonymous run label, sample time, RTT, jitter,
interval loss and delivered frame rate. It does not need the invitation path,
network candidate addresses, access token or chat text. Removing these fields
is not hiding evidence; it is selecting evidence appropriate to the claim.

Before sharing an artifact, ask what a recipient could do with it. Could it
grant access? Identify a patient? Reveal a private consultation? Correlate a
person's activity beyond the experiment? If so, redesign the record or use
the team's authorized incident process. A reference manual should teach the
safe observation, not normalize exporting sensitive sessions as homework.

## Maintain one current-status projection

Historical reports should remain historical. If an audit fails on Monday and
passes on Thursday, overwriting Monday's report erases the reason the repair
exists. Yet forcing every reader to reconstruct the entire history is also
unhelpful. This repository uses a current verification ledger pointing to
dated evidence. That is the same conceptual separation used elsewhere in the
application: immutable or preserved observations feed a current projection.

Update that projection whenever a result changes. A dependency scan can
return zero findings at one time and a new advisory later. A successful local
policy test can coexist with deployed rule drift. A previously blocked
production-source check can become available after authorization. The status
must name the environment and date, not just display a permanent green check.
Use precise labels such as historical pass, current pass, fail, blocked and
not tested.

Code and explanatory evidence should travel together at a coherent checkpoint.
Do not push a change that alters an authorization rule while leaving the
report claiming the former behavior. Equally, do not claim a change is live
because a documentation commit was pushed. Record the source commit, CI
outcome and deployment observation separately. Small checkpoints protect
against interrupted work without turning every incomplete experiment into
a release claim.

## A worked notebook entry

Question: can stale cleanup break shared queue polling? Environment: local
test adapter, synthetic consumers, source pinned before the repair. Prediction:
after unsubscribing an old group, creating a replacement, and calling the old
cleanup again, adding a peer must leave one timer and one visibility listener.
Observation: the original implementation produced two timers. Interpretation:
the stale cleanup removed the registry entry for a replacement it did not own.

The repair checks group identity before releasing shared state. The passing
test repeats the same sequence and verifies final cleanup reaches zero timers
and listeners. The supported conclusion is that the tested resource-lifetime
bug is closed. The unsupported conclusion is that production Firestore bills
fell by half or that one hundred simultaneous calls now work. A good notebook
records both the useful pass and the boundary of what it proves.

## Exercise and worked answer

Rewrite this report: "Everything passed; the call is secure and fast." A better
entry names the commit and environment, lists the specific passing suites,
states the dependency scan's time, and separates published application and
rules observations. It explicitly leaves media quality, concurrent-call
capacity and clinician efficiency pending if those experiments were not run.
The corrected entry is longer but more useful: a reader can decide what to
trust and what to test next.

Finally, practice handing an investigation to someone who cannot ask you a
question. Give them the sanitized entry, source paths and reproduction steps.
Ask them to state the claim and its strongest remaining alternative. If they
need a credential value, a real patient's identity or your memory of which tab
was active, the handoff is not finished. Improve the record before collecting
another screenshot.

## Foundational systems reading - adapted companion material

These adapted systems readings extend the investigation notebook method. Their examples show how to preserve a prediction, execution identity and uncertainty, so a later investigator can reconstruct the reasoning without copying sensitive operational data.

## Supplied systems reference - page 17

More integration can create more hidden state: plugin versions, language servers, PATH alterations, services, keymaps, and generated caches. Integration is valuable when its benefits exceed its maintenance and diagnosis costs. Count both.

What justifies adopting a heavily configured Neovim distribution now? A demonstrated need that it solves, willingness to understand and maintain its dependencies, and a way to reproduce behavior with or without that configuration.

Write your prediction before running the command. This prevents rewriting your explanation after seeing the result. State what would make you change your mind. A useful note might say: "If the package metadata exists but find_spec resolves to the project directory, shadowing is more plausible than a missing installation." That is a small, falsifiable argument.

Repeat with a changed condition only when it addresses a remaining uncertainty. Run the same inspection inside the web container if the failure occurred there. Compare an interactive shell with a script if startup behavior is relevant. Avoid collecting large logs with no question attached; they increase the amount of evidence you must interpret without necessarily increasing certainty.

## Supplied systems reference - page 18

Add a third environment: a project container, using only the established read-only inspection commands for that project. Record the interpreter path and a selected non-sensitive version inside it. If the project is not running, leave this step for later; do not start the wrong Compose project merely to complete a checklist. The purpose is to explain the boundaries, not to manufacture activity.

Your final artifact is a small table of observations with columns for surface, execution environment, working directory, selected runtime, and endpoint. The Windows browser's row should identify the URL it is observing rather than inventing a Linux interpreter. A Git client's row should identify its repository. A database client's row should identify its destination as far as you can establish it without credentials.

Explain three differences in prose. For example, two shells can share files while retaining different directories; the host and container can resolve Python differently; the browser can reach an older application process while your editor displays newer source. If you cannot explain a difference, preserve it as a question for the following chapters. The map is useful when it makes a future diagnostic command more precise.

## Supplied systems reference - page 175

The fourth is time between decisions. A human can review a row, wait, and submit after another person has changed it. A request can validate a schedule and enqueue work that runs after the validation status changes. The gap is part of the operation. Treating an operation as one instantaneous function call can erase the concurrency question you needed to ask.

## Source trail

Read `docs/testing/verification-status.md`,
`docs/testing/follow-up-2026-11-22.md`,
`scripts/thesis/verify-remediation.mjs`, and
`scripts/thesis/verify-rules-release.mjs`. The scripts demonstrate evidence
collection patterns; check their output paths and deployment scope before
running them. A historical reproduction command is not permission to write
to production during a new investigation.


# 6. Know which computer and shell owns your command

## The LiveKit boundary to trace

This repository is commonly opened through a Windows UNC path while its files
live inside Ubuntu under WSL. A PowerShell prompt and a Bash prompt may both
display a directory that looks like the same project. That does not mean they
resolve node, npm, Java, Python or Git to the same executable. Before a failing
build becomes a source investigation, establish which process is interpreting
the command and which filesystem contains its working directory.

In PowerShell, inspect Get-Command for an executable. In Ubuntu, inspect
command -v and the executable's own version output. Run the project's Node
version manager in the shell that will actually execute npm. The project's
declared Node 22 requirement is not satisfied merely because Windows has some
other Node installation. Record the version in the evidence log, especially
when an earlier successful run used Node 20 or a bundled runtime.

## A worked local investigation

Suppose npm works in a standalone Ubuntu terminal but an automated command
reports a missing binary. First compare working directories and PATH
resolution, not package.json. A login shell may initialize nvm while a
non-login shell does not. Conversely, inheriting Windows PATH entries can
select an unintended binary. The diagnosis is an environment difference until
you show that the same executable, source and arguments behave differently.

The command interpreter also owns quoting. A dollar expression expanded by
PowerShell cannot later be recovered by Bash as literal text. When invoking
wsl.exe, keep the command boundary explicit and avoid constructing destructive
commands from unresolved variables. For ordinary investigations, a read-only
version check is a better first probe than an installation or cleanup command.

## Exercise with answer

Predict whether changing a Windows terminal profile changes an already running
Ubuntu process. It does not rewrite that process's existing environment. Start
a new controlled shell or inspect the live process directly. Now explain why
a task that passed yesterday might fail after opening a different terminal:
the source may be unchanged while startup files, executable resolution, working
directory or environment differ. Compare those facts before reinstalling
dependencies. Reinstallation can erase the evidence of the difference.

For a LiveKit build handoff, write a short environment receipt containing the
OS context, shell, repository root, Node version, package-manager version and
source commit. Do not print the entire environment, because credentials may be
present. The receipt should let a teammate reconstruct the tool boundary
without receiving any secret configuration values.

## A practical two-environment notebook

Make a notebook with two explicitly named environments: Windows PowerShell and Ubuntu WSL. Do not call them “terminal one” and “terminal two,” because those names describe windows rather than execution contexts. In each environment record the current directory, operating-system identity, selected interpreter and repository root. Use the normal read-only commands for that shell, and write down the resulting values rather than a screenshot of the prompt decoration. A customized prompt can be stale or abbreviated; the process's actual directory and executable are stronger evidence.

Now identify which environment owns the project files. In this workspace, the Linux project is available through a Windows UNC path and through a Linux home path. Those are two access routes, not two independent clones. Editing through one route can change what the other sees. Conversely, a similarly named directory on the Windows drive can be a separate checkout. Verify repository identity with the root and commit rather than assuming that a folder named Livekit is the same working tree everywhere.

Consider a hypothetical test that passes in WSL and fails in PowerShell. Before changing application code, compare runtime selection and path interpretation. One shell may select Node from a version manager while the other selects a globally installed version. One command may use a Linux package installation while another uses Windows executables through interoperability. Native packages, executable permissions, newline conventions and dependency paths can differ. The useful question is not which operating system is better; it is which difference can explain the observed failure.

Change only one condition in the next experiment. Run the same source revision under the declared runtime in the environment where the project normally builds. If it succeeds there but fails under an accidental global runtime, the result supports an environment-selection explanation. It does not prove that every Windows development configuration is unsupported. Record the actual executable and version with the test log so another student can reconstruct the distinction.

## Keep configuration and secrets out of the experiment

Environment comparison can become an accidental credential disclosure. Printing every environment variable may reveal service-account material, database settings or provider keys. Instead, compare the presence and intended source of required names, and inspect harmless synthetic variables when learning inheritance. For a real secret, report “present from local configuration” or “not available” unless its value is essential to an authorized operation. Never put that value in the teaching notebook.

A child process receives an environment when it starts. If you change a variable in one shell, an already-running development server does not automatically acquire it. A second shell also retains its own state. This explains why editing a configuration file and refreshing the browser may leave server behavior unchanged. The browser might have new client assets while the existing server process still uses old initialization. Establish the read point and process lifetime before deciding that the configuration edit was ignored.

Do not solve confusion by copying every configuration file between environments. That can duplicate secrets, introduce contradictory sources and make future diagnosis harder. Identify the owning configuration path, document how the runtime obtains it, and keep machine-specific overrides narrow. The goal is a dependable laboratory, not an environment whose behavior depends on remembered manual copying.

## A recovery exercise

Imagine that you accidentally start the application from a separate Windows checkout while editing the WSL checkout. The browser shows no effect from your change. First identify the listening process and its working directory without killing unrelated programs. Then compare its source revision to the edited tree. Stop only the process you started, launch from the intended project environment, and repeat the smallest visible check. Do not delete dependency directories across both trees or reinstall the entire toolchain before establishing which tree the browser reaches.

The expected learning artifact is a short environment map and a resolved causal claim. It should say which runtime read which files and which process served the browser. If you can explain that chain without relying on window position or prompt color, you have a foundation for diagnosing builds, emulator tests and deployment scripts safely.

## Foundational systems reading - adapted companion material

These adapted environment readings explain the boundaries beneath the LiveKit laboratory. References to Python, editors or containers are comparative teaching examples, not a claim that the teleconsultation application uses those tools as its production backend.

## Supplied systems reference - page 8

When a developer types quickly in a dark window, several programs cooperate. The terminal emulator displays characters and translates keyboard activity into input for a terminal session. The shell parses commands and launches programs. An editor interprets its own editing language. The operating system supplies processes, memory, files, and communication facilities. A multiplexer can keep terminal sessions and organize their views. A graphical window manager arranges application windows on the desktop.

The distinction becomes concrete when the same terminal window first displays a Bash prompt and then Vim. Its display role remains, but a different program receives the input. In Vim Normal mode, the letter j is a movement command. At a Bash prompt, j is part of a command name. In a Python prompt, it can be an expression containing an identifier. A key has no universal application meaning.

## Supplied systems reference - page 9

After Vim exits, must Bash be restarted? Normally no. Bash launched the editor, waited while it owned the foreground interaction, and continues afterward. The shell and editor had separate responsibilities and lifetimes.

The practical value of WSL is access to Linux interfaces and tools while keeping the Windows applications you need. Your browser and communication tools can stay on Windows. Source inspection, Git, Python, and Linux containers can use Linux-friendly workflows. Decide where each task belongs from its dependencies and semantics, rather than from the visual appearance of its window.

## Supplied systems reference - page 10

A boundary can remain even when integration makes it convenient. File paths, executable formats, permissions, networking, process identifiers, and startup mechanisms can differ. A command that works in Ubuntu may not exist in PowerShell. A Windows path supplied to a Linux program may identify nothing unless translated. A tutorial about an ordinary Linux desktop may assume a display server or service setup that your distribution does not have.

WSL2 is not an emulation of every Linux desktop installation, and Ubuntu is not the Linux kernel. WSL version, distribution version, and individual package versions are separate facts. Inspect the one that constrains the behavior being investigated.

Does a newer Ubuntu distribution automatically mean a newer Python inside an existing application image? No. The image can contain its own interpreter and packages, built independently of the distribution that launched Docker.

A pathname is interpreted within a filesystem namespace. In Windows, a path can begin with C:\\Users. In WSL, the Windows drive is commonly available beneath /mnt/c, and Linux home directories are beneath /home. These are not merely spelling conventions.

## Supplied systems reference - page 15

The visible speed in a keyboard-led workflow partly comes from reliable changes of focus. Several layers can interpret keys: Windows, a terminal tab, a tmux pane, Vim, and a plugin within Vim. A shortcut that makes sense in one layer may be consumed before reaching another. Understanding the receiver is more dependable than memorizing a large unclassified shortcut list.

Begin with a modest layout. Put the editor where you can read a function without scrolling sideways, keep a terminal for tests and logs, and leave a browser available for application behavior and documentation. Windows Snap can provide this arrangement.

## Supplied systems reference - page 16

If Ctrl C copies text in one window but interrupts a program in another, which general question resolves the ambiguity? Identify the component receiving the key and its current interpretation rules, including terminal selection and shortcut settings.

A workflow should be small enough to reconstruct. Begin with your existing Windows Terminal profile for Ubuntu, Bash, the editor you are learning, Git, and the project's established runtime. Add tmux when session persistence or pane organization solves a concrete problem. Add a graphical tiling utility when repeatable desktop layout matters.

Keep configuration under version control when it becomes useful, but separate it from secrets and machine-specific state. A minimal .vimrc or documented terminal profile can be easier to maintain than a full dotfile collection copied from someone else's machine.

Read each setting. Record why it exists and how to disable it during diagnosis. A clean Vim invocation, such as vim -Nu NONE -n -N, lets you distinguish editor behavior from your configuration.

The baseline is successful when you can open a project, find code, make a controlled edit, inspect the diff, run the relevant check, and inspect the application result. It need not match anyone else's colors or window placements. The mechanism you understand can be rebuilt with other tools as your needs change.

## Source trail

Inspect package.json, the quality workflow and scripts/thesis/verify-remediation.mjs.
The adapted computer-systems readings below supply general tool mechanics;
they are not evidence that a particular executable is installed on your PC.


# 7. Files, paths, permissions and executable identity

## The LiveKit boundary to trace

A path is interpreted within an environment. The Windows workspace view can
show the Ubuntu repository through a UNC share, while a Linux process sees
/home/garre/Livekit. A package installation under a Windows directory is not
automatically the package installation used by a Linux build. Treat file
identity and executable identity as questions to inspect, not visual
similarities to trust.

Generated Next.js files create another distinction. They are real filesystem
objects but not the authoritative source of your feature. Editing a generated
route or type file can disappear on the next build. If a typecheck complains
about missing generated files, check whether a dev server or build is
concurrently replacing .next before assuming the application contains a type
defect. A stable sequential check is a useful control.

## A worked local investigation

Create a clean verification worktree only after checking existing working
state. The original checkout can contain a user-modified AGENTS.md, archives
and diagnostic logs. Those changes belong to their owner. A clean worktree
lets you test committed source without silently discarding them. Record
whether dependencies were installed cleanly or symlinked from another
checkout, since that difference affects reproducibility.

When a file changes, compare its content or hash rather than only its
modification time. Line-ending conversion can change object bytes while
leaving readable source effectively equivalent. A rules comparison in this
project explicitly documents normalization of carriage returns and surrounding
whitespace. Do not silently use that normalization for binary artifacts or
for a case where whitespace is semantically meaningful.

## Exercise with answer

Two developers report the same branch name but different behavior. Is the
branch name sufficient evidence that they ran identical code? No. They may
have different commits, dirty files, generated output or installed dependency
trees. Ask for the commit, relevant diff and runtime receipt. Do not ask for
production secrets. A screenshot of the editor tab proves little about the
process that served the browser request.

A report contains a hash for firestore.rules. Decide whether it names raw
file bytes or normalized source. Either can be useful if the method is stated.
The mistake is comparing a normalized hash to a raw-byte hash and treating
their difference as proof of different policy. The method belongs in the
evidence record next to the digest, not only in the investigator's memory.

## Follow a file from the editor to the build

Choose a harmless documentation file in a disposable exercise directory. Open it in two editor views, change the in-memory text in one view, and inspect the disk from a separate read-only command. The disk still contains the last saved version until the editor writes. This distinction matters when a build appears to ignore a correction. The compiler reads a filesystem path, not the text you can currently see in an unsaved buffer. Two editor windows may show one buffer, two buffers for one file, or two different paths with similar names.

Save the file, then undo the edit without saving again. The visible buffer and disk now disagree in the opposite direction. A Git diff reports the filesystem state, not necessarily the editor's unsaved state. This small exercise explains why “I reverted it in the editor” is not sufficient evidence that a test ran against the reverted code. Record when the save occurred and inspect the actual file that the command consumed.

Next compare a relative path from two working directories. The same text can resolve to different objects because the process supplies the starting directory. A script should either define its input base clearly or accept an explicit path. A fragile instruction such as “run this from somewhere near the project” exposes temporal and environmental complexity to every user. A deeper tool resolves its own repository-relative resources or fails early with a precise missing-input explanation.

## Names, contents and permissions answer different questions

A filename is not a permanent content identity. A build can replace a file under the same path, and a process can retain an open handle to an older object. A checksum identifies content under the selected algorithm; it does not tell you who authorized that content or whether it is safe. A timestamp can help locate a change, but preserved or rounded timestamps are not proof of equal bytes. Use the right identity for the claim you are making.

Permissions also have scope. A readable file may be inaccessible through a directory the process cannot traverse. An executable bit on a script does not select the right interpreter or guarantee that its dependencies exist. Windows and Linux access models are not interchangeable labels. When an operation fails, record the acting process and filesystem view before proposing a broad permission change. Recursively making a project writable to everyone can conceal the immediate symptom while weakening the environment.

The LiveKit repository contains generated build output, dependency packages, source files, test fixtures and evidence archives. They should not all be treated alike. A source edit belongs in a reviewed diff. A generated file should be reproducible from its inputs. A test fixture should contain synthetic data. An evidence archive may be a user's retained artifact. Do not remove an untracked item simply because Git does not manage it; untracked means outside the index, not disposable.

## Executable identity and safe correction

Resolve a command name before trusting it. A shell function or wrapper can select another interpreter, inject arguments or change directories. A global tool may have the same name as the project's package script while using different dependencies. Prefer the documented project invocation, then record the runtime it actually selects. If a failure depends on that selection, preserve a minimal comparison rather than editing source to satisfy an accidental tool version.

For a safe correction, first name the exact target. Read it, inspect the intended diff, and verify that the resolved path stays inside the authorized workspace. Apply the smallest edit through the normal patching workflow. Re-read the changed region and run the relevant check. This may sound slower than a broad replacement, but it reduces the chance that a shell glob or escaped path touches unrelated files. Precision is a performance improvement for the investigation as a whole.

An independent exercise is to explain why two commands reporting the same filename can read different contents. Possible answers include different working directories, mounts, container images, separate checkouts, symlinks and a file replaced while a process holds an older handle. Choose one, construct a synthetic demonstration, and state which observation distinguishes it from the others. Understanding the namespace is more useful than memorizing another path command.

## Foundational systems reading - adapted companion material

These adapted filesystem and editor readings examine representations that source work depends on. Practice only on disposable text. A buffer, pathname, mount and running process have different lifetimes even when their visible names look similar.

## Supplied systems reference - page 11

Open the directory from Windows with explorer.exe . if WSL interoperability is available. Windows Explorer can present the same Linux-hosted project through WSL's supported interface. Avoid reaching into the distribution's internal storage files through an unsupported path. The public filesystem interface is the right integration boundary.

Windows case sensitivity is configurable in some contexts, and mounted filesystem behavior depends on mount settings. Treat "Windows ignores case" as a common default, not a universal law. Avoid projects that depend on two filenames differing only in case when multiple environments will access them.

If you copy a file to another filesystem and preserve its timestamp, is it the same filesystem object? No. Content and metadata can be similar while object identity and storage location differ.

Typing python3 does not inherently select a particular file. Bash checks definitions such as functions and builtins, then resolves external programs using its command lookup rules, including PATH and cached locations. Your activated virtual environment, an alias, or a wrapper script can alter the result. The command name is the beginning of a resolution process.

## Supplied systems reference - page 12

PATH is a colon-separated directory search list in typical Unix environments. Display it when diagnosing selection, but do not assume that printing it establishes every lookup behavior. Aliases, functions, builtins, cached locations, and explicit paths are distinct cases. If you intentionally change PATH after relocating an executable, Bash's hash -r can clear remembered external command locations. Understand that operation before using it as a ritual.

An executable path is better evidence than a prompt decoration, but a wrapper can launch another program. When diagnosis requires it, inspect the script and the running process. A version string also does not prove the configuration, installed modules, or database target.

Why can python -m pytest help when pytest alone fails? It selects the pytest module through the chosen Python interpreter instead of relying on an independently resolved command wrapper. It cannot help if that interpreter does not have pytest installed.

## Supplied systems reference - page 47

A pathname is a sequence of directory lookups. It is not the file's complete identity. On a typical Linux filesystem, a directory entry maps a name to an inode, which represents the file's metadata and data relationship. A hard link adds another directory entry for the same inode. A symbolic link instead contains a pathname to follow, which may later resolve to a different object or no object.

Opening a file creates a descriptor that refers through an open file description to the opened object. Renaming a directory entry does not retarget that descriptor. Unlinking removes a name; the file's data can remain available while an open descriptor still refers to it. Storage can therefore stay allocated after a large file disappears from a directory listing. This model connects log rotation, temporary files, and safe artifact publication.

That prevents readers from observing a half-published replacement through that name, but atomic visibility does not itself guarantee persistence after a power failure. Cross- filesystem moves may require copy and deletion rather than one rename operation.

## Supplied systems reference - page 48

"The file was deleted" can mean its name vanished, all links vanished, or its storage was reclaimed. These are separate events. Never infer descriptor state solely from a directory listing.

After rotating a log by rename, must the old writer append to the new pathname? No. Its descriptor can still reference the rotated file until it closes and reopens.

File permissions and directory permissions answer different questions. Reading a regular file requires permission to read its contents and permission to traverse the containing path. Reading a directory permits listing names. Executing a directory permits searching through it by known name. Writing a directory governs changes to its entries, subject to other rules such as the sticky bit. This is why a read-only file can sometimes be deleted by someone who can modify its directory.

## Supplied systems reference - page 49

Text begins as bytes with an interpretation. UTF-8 encodes Unicode code points using variable-length byte sequences. A visible character may consist of several code points, such as a letter followed by a combining accent. Therefore byte count, code-point count, and user-perceived character count can all differ. A tool that slices bytes can split an encoding sequence; a tool that slices code points can still split a visible grapheme.

Newlines are another interpretation boundary. Linux tools commonly use LF, while Windows text files often use CRLF. Python text mode can normalize line endings during reading, masking the difference that a byte-oriented parser or checksum will observe. A text editor's clean display does not prove the absence of carriage returns, a byte order mark, or an invalid byte sequence.

## Supplied systems reference - page 50

Choose an encoding and error policy at each input boundary. Silently replacing undecodable bytes can produce a plausible-looking value while destroying information needed for diagnosis. Normalization can be appropriate for some comparisons, but apply it according to the data contract: exact identifiers, signed data, and checksummed payloads can require preserving original bytes. Human names also deserve their full Unicode representation rather than a guessed ASCII substitute.

Unicode does not mean UTF-8, and UTF-8 does not guarantee one byte per character. LF normalization, Unicode normalization, and whitespace stripping are three distinct transformations with different consequences.

Two strings render as the same accented letter but compare unequal. Is the font necessarily broken? No. Their code-point sequences can differ; inspect representations and the intended normalization policy.

## Supplied systems reference - page 51

A path acquires meaning inside the filesystem view of the process using it. /home in one WSL distribution does not automatically refer to another distribution's home directories.

For a container discrepancy, first identify the daemon with docker context show and docker info, then inspect only the relevant container's mounts. A bind mount places host content at a container path and can obscure files originally present in the image at that path. A Docker volume has its own managed lifecycle. Neither the host directory's spelling nor the image's filesystem listing proves what an already-running container currently sees.

Also distinguish pathname existence from current directory identity. A process can keep a directory open while its name is moved or removed, just as it can hold an open file.

## Supplied systems reference - page 52

A mount changes which filesystem object a path reaches. It does not merge file contents into the directory it covers. WSL access paths and Docker daemon locations are environment-dependent.

The image contains /app/config.txt, but a running container cannot see it. Could a mount explain this? Yes. A mount at /app can cover the image's original directory.

A system call crosses from a user-space program into the kernel. strace observes that boundary: opening files, reading and writing descriptors, creating processes, and waiting. It does not show every Python function call or SQL interpretation inside a library. This narrower view is powerful when the question concerns an operating system operation, such as which path was opened or whether output was actually written. Buffering explains many surprising traces. A call to Python's print can update a user-space buffer without immediately invoking write. When output goes to a file, Python generally uses different buffering from an interactive terminal. The program can execute two print statements while the kernel observes one combined write at shutdown. Neither statement count nor visible timestamps alone tell you how many system calls occurred.

## Supplied systems reference - page 57

A key is an event, not an action with a fixed universal meaning. Vim interprets the event against its current state. In Normal mode, j ordinarily moves down one line. In Insert mode, the same key inserts a letter. After d in Normal mode, Vim is waiting for a movement or another valid continuation. That intermediate condition is called Operator pending mode. The editor has received part of a sentence, but cannot yet determine the text the deletion should affect. This is a useful first model of dispatch. Imagine a function receiving the current state and an input event and producing the next state. The state includes more than a visible mode indicator: the cursor, pending count, active mapping, and current buffer matter too. You need not know Vim's source code to use this model. You need to ask which facts determine the interpretation of the next key. That question replaces the unhelpful impression that the editor has become unpredictable.

## Supplied systems reference - page 58

Vim's editing language gains much of its economy by separating an operation from its target. d deletes, y yanks, and c changes a target, entering Insert mode after removing it.

## Supplied systems reference - page 59

Conversely, a structural command is only reliable when the editor's definition of that structure agrees with your intention. A programmer's identifier, a natural language word, and a space separated field are not automatically the same object.

In Vim, word depends partly on iskeyword; WORD treats nonblank runs differently. Inclusive and exclusive rules have documented boundary exceptions, particularly when a motion ends at column one. Doubled operators such as dd operate on lines. Also, cw has special historical behavior, so do not assume every change command is mechanically a deletion followed by insertion. The ciw operation offers an explicit inner-word target for practice.

## Supplied systems reference - page 60

Confusing buffers, windows and tab pages makes navigation feel dangerous and some destructive commands seem harmless. For a first working arrangement, one window is enough. Add a split when you need two positions visible at once. Add a second buffer when you need another document. Add tab pages when separate layouts serve separate tasks. This order keeps the concepts attached to real needs. A tab page need not correspond to one file, and a buffer need not currently appear anywhere on screen.

## Supplied systems reference - page 61

Two splits show the same buffer. Where should you undo an accidental change? Answer: in either view of that buffer. The change belongs to its text history, not to the particular pane in which you typed it.

Editing history and file contents are different timelines. A buffer can contain a new state while its file still contains the old one. Undo changes the buffer's state. A write serializes the current text to a file. Saving does not erase the ability to undo, and undoing a saved change does not silently rewrite disk. Your Git knowledge adds another distinct timeline: repository history records committed content, not every buffer state or every write.

## Supplied systems reference - page 62

You write a change, then undo it. Which version will another process read from disk? Answer: the written version, until you explicitly write the newly restored buffer. Undo is an editor state transition rather than a filesystem rollback.

Registers are named storage slots used by editing commands. The unnamed register supplies a normal p or P when no other register is selected. Deletes and changes can replace its contents, so recovering an earlier copy requires a more precise intention. Register 0 retains the most recent yank that did not explicitly target another register. The black-hole register accepts deleted text without retaining it in the ordinary deletion registers. Clipboard integration is a further boundary whose behavior depends on the editor build and operating environment.

## Supplied systems reference - page 63

After yanking one line and deleting another, how do you recover the yank? Answer: use "0p, provided the original yank used no explicit alternative register. First inspect :registers if you are uncertain about the preceding operations.

## Source trail

Inspect firebase.json, .gitattributes, next.config.ts and the dated rules-release
reports. Use read-only filesystem checks first; this chapter does not authorize
recursive deletion of build directories or user work.


# 8. Compose safe commands and inspect their exit status

## The LiveKit boundary to trace

A shell command is a program with parsing and control flow. An invocation that
prints a reassuring line can still fail later, and a wrapper can hide the exit
status of the operation you care about. Before putting a command in a thesis
reproduction guide, identify which program's status is being returned and where
its standard output and standard error go.

The maintained verification runner executes checks separately, stores their
logs and records each exit code. This is more useful than chaining several
checks and reporting only the last one's result. It also allows a failed
dependency audit to remain visible while unrelated policy, lint and build
results are recorded honestly. A red job is a reason to inspect its failed
step, not a reason to rename every result a failure.

## A worked local investigation

Suppose security tests fail but a later echo prints complete. Do not use that
word as acceptance evidence. Run the test directly, record its exit status,
and read the failing assertion. If a runner intentionally continues after
failure to collect several results, its final status should still reflect
whether every required gate passed. Continuing observation and declaring
success are different decisions.

Quoting errors deserve the same discipline. A regular expression intended to
match a carriage return can become a literal letter after crossing several
interpreters. A bulk rewrite then corrupts source instead of normalizing line
endings. Prefer explicit patch tools for source edits. For mechanical
formatting, inspect a small diff before applying the operation broadly and
keep unrelated files out of the target set.

## Exercise with answer

You need to compare two rule files and deploy only the reviewed Firestore
rules. Which command scope is safer: the whole Firebase project or the
explicit firestore:rules target? The explicit target expresses the approved
operation and avoids releasing Functions, Storage rules or indexes merely
because they share a configuration file. Verify the project identifier before
the write. A default project alias is convenient, not a substitute for
checking the destination of a production action.

Now design a safe failure demonstration. Use a synthetic local test that exits
nonzero, capture its status and retain its message. Do not deliberately break
the live database to prove your wrapper notices an error. The notebook should
state whether the command was a read, an emulator operation or a production
write; otherwise a future reader can reproduce the wrong kind of experiment.

## Preserve structure across command boundaries

Suppose you need a report of failing test cases. One approach prints human-readable output, searches for the word “fail,” and counts matching lines. Another consumes the test runner's structured result and counts cases whose status is explicitly failed. The first approach may count an explanation containing “fail closed,” miss a differently formatted failure, or include a historical baseline. The second still needs schema validation, but it preserves the meaning of the field instead of guessing from appearance.

The same distinction applies to command arguments. A filename containing spaces is one value, not several words that happen to be adjacent. Quoting preserves the shell boundary, but the receiving tool may still interpret a leading hyphen as an option. A JSON string, regular expression, URL and shell argument each have different escaping rules. Do not assume that safely quoting one layer makes the value valid at every later layer. Trace which parser receives the bytes next.

When invoking WSL from PowerShell, there can be several parsers: PowerShell constructs arguments for the launcher, the launcher selects a Linux command, and Bash may parse another command string. Avoid composing destructive operations through that stack. Keep filesystem operations in one shell with literal paths and read-only validation first. For teaching experiments, use a disposable directory created for the exercise, never a broad home directory or project root as a deletion target.

## Exit status is evidence with a defined boundary

A command can print an error and exit successfully if its author chose that behavior. It can also exit nonzero for a condition that is expected in the workflow, such as a search finding no matches. Therefore, inspect the tool's documented semantics and the relevant output. A process exit status reports termination under that interface; it does not independently prove the business invariant you care about.

Pipelines add another trap. In some shells, the pipeline status defaults to the last stage, so a successful formatter can hide an earlier failing producer. Even when pipeline failure detection is enabled, it covers that pipeline, not every asynchronous process or nested command substitution. Capture the status at the boundary where it matters and avoid printing another command's status accidentally. A test report should preserve the runner's exit result, not only the success of the command that displayed its log.

Keep machine-readable results on the intended output channel and diagnostics separate. If a helper prints a friendly banner before JSON on standard output, a downstream parser can fail even though the JSON fragment itself is valid. This resembles the browser symptom of receiving HTML where JSON was expected: the consumer's parse error identifies a contract mismatch, not necessarily the original failure. Inspect the complete response type and producing stage.

## A synthetic reporting exercise

Use two small synthetic result files, one passing and one containing a deliberate failure. Define the expected count before writing the reducer. Then supply malformed JSON, a missing field and an unknown status. Decide explicitly whether the report rejects the input or records an unknown category. Do not silently treat malformed input as zero failures. That would make the least trustworthy data produce the cleanest-looking result.

Publish the completed report only after validation succeeds. A temporary output and final replacement can prevent readers from seeing a half-written report, but atomic publication is not the same as durability or concurrency control. Another writer may still publish a different valid report later. If that matters, add an explicit version or ownership policy rather than assuming that a rename solves every race.

Finally inspect the report's own wording. “No failing cases were returned by these inputs” is narrower than “the application is secure.” Include input identity, scope and exclusions. Command composition becomes reliable when each stage preserves structure and each conclusion stays within the stage's guarantee. A clever one-liner that obscures those boundaries is not necessarily an improvement over a small readable script.

## Foundational systems reading - adapted companion material

These adapted shell readings explain parsing, arguments, streams and publication. Bash and Python examples are supporting systems models rather than LiveKit implementation listings. Preserve each interpreter boundary when translating an exercise into your own shell.

## Supplied systems reference - page 13

Formatting is often a one-way loss of information. A human-readable table can truncate a value, round a number, or insert spaces. Parsing that table may produce an apparently successful script whose assumptions fail on another input. Keep structured data structured when possible. In PowerShell, postpone Format-Table until presentation. In Python, parse CSV with the CSV module and JSON with the JSON module. In Bash, let a structured-data program own the relevant parsing.

Crossing into a native executable adds another boundary. PowerShell versions have changed some native argument and redirection behaviors. A PowerShell object pipeline does not magically pass .NET objects into a Linux program launched through wsl.exe.

A similar-looking command is not proof of equivalent semantics. An alias named ls in PowerShell may invoke a PowerShell command whose options differ from GNU ls. Use Get-Command to identify the receiver of the command.

## Supplied systems reference - page 19

When you type a command, the program does not receive the visible command line as one string. Bash first recognizes words and operators, parses a command structure, expands its words, arranges redirections, and executes the resulting command. That sequence explains why a quoted semicolon can be data while an unquoted semicolon separates commands. Redirection syntax belongs to Bash and is removed from the arguments delivered to the program. For an external Linux executable, the useful interface is an argument vector: an ordered sequence of strings. Argument boundaries survive execution; the original choice of single quotes, double quotes, or backslashes does not. The kernel interface uses NUL terminated strings, so an individual argument cannot contain a NUL byte. Spaces and newlines are allowed inside an argument. A program may subsequently interpret an argument as an option, filename, expression, or configuration value according to its own rules.

## Supplied systems reference - page 20

There are therefore two parsers to consider. Bash interprets shell syntax; the selected command interprets its arguments. In rg -F 'annual leave' report.txt, Bash makes four words, and ripgrep decides what -F means. Quotes preserve one pattern argument but do not make that pattern immune to ripgrep's interpretation. Likewise, quoting a filename beginning with a hyphen preserves its bytes without necessarily preventing a command from treating it as an option.

Removing quotes is not equivalent to removing characters from the final argument. Quotes originally participate in parsing and expansion. Also, a semicolon stored inside a variable does not automatically become a command separator when that variable expands; Bash does not normally parse expansion results again as shell source.

## Supplied systems reference - page 21

The unquoted expansion rules depend on context. An assignment such as message=$other does not perform the ordinary word splitting and pathname expansion applied to command arguments. [[ ... ]] also has different expansion rules. Avoid transferring a rule from one syntactic position to another merely because the same dollar sign appears in both. For external command arguments, "$value" is the normal choice when the value represents one item.

Command substitution has another boundary: it collects stdout and removes trailing newline characters. Internal newlines remain, but the exact original ending cannot be recovered from the resulting value. A shell variable also cannot store NUL bytes. This makes command substitution useful for small textual results, such as a synthetic label, but unsuitable as a general transport for arbitrary file contents. For binary data or a large export, keep the data in a file or stream instead of forcing it through a shell variable.

## Supplied systems reference - page 22

Quoting protects shell boundaries; it does not validate a value for SQL, JSON, a regular expression, or another interpreter. Avoid building a command string and feeding it to eval. An array of arguments preserves the intended structure without a second round of shell parsing.

A relative path is interpreted from a process's current working directory. That directory is inherited when a child starts; it need not contain the script. An absolute Linux path begins at /. Under WSL, a Windows path such as C:\work is not interchangeable with /mnt/c/work. Case behavior and permissions depend on the filesystem. Home directory fixtures avoid relying on a particular Windows mount configuration.

A glob selects pathnames. In a normal Bash pathname pattern, * matches a sequence within one component, ? matches one character, and bracket syntax specifies a character set. A slash separates components and must be matched explicitly. Initial dots require explicit matching unless relevant shell settings change the default. A plain ** does not promise recursive traversal; Bash's globstar option gives that form its recursive role.

## Supplied systems reference - page 24

A process has a table of file descriptors. By convention, descriptor 0 is standard input, 1 is standard output, and 2 is standard error. These handles can refer to terminal devices, files, pipes, or other resources. <source replaces descriptor 0, >destination replaces 1, and 2>diagnostics replaces 2. An inherited descriptor tells a program where its bytes go without requiring knowledge of the shell spelling.

For a regular file, a descriptor refers through the kernel to an open file description containing state such as the current offset. Duplication makes another descriptor refer to that same open description. In 2>&1, the ampersand tells Bash to duplicate descriptor 1 onto descriptor 2. It does not name a file called 1, and it does not install a permanent relationship saying that stderr must follow future changes to stdout.

Bash applies redirections from left to right. In >result 2>&1, descriptor 1 first becomes the open output file; descriptor 2 then duplicates that connection. In 2>&1 >result, descriptor 2 first duplicates the original stdout destination; only descriptor 1 then moves to the file. This distinction remains true if the original stdout destination is itself a pipe rather than a terminal. Redirection also happens before the program starts. Opening with > normally truncates an existing output file immediately. A program that then fails may leave an empty or partial file. Appending with >> changes that opening behavior but does not make an operation transactional. Keep diagnostics separate from machine readable stdout: a warning inserted into JSON can make an otherwise successful consumer reject it.

## Supplied systems reference - page 25

stdout is a designated channel, not a synonym for the screen. stderr is another channel, not a special class of bytes that the kernel recognizes as errors. After merging both streams, ordinary downstream reads cannot recover their original channel identities.

A pipe connects a writer's bytes to a reader. producer | consumer is not shorthand for completing the producer, storing everything, and then starting the consumer. The processes can run concurrently. A pipe has bounded buffering: when that buffer fills, a blocking writer waits for room; when it is empty but writers remain, a blocking reader waits for data. This pressure propagates upstream when a consumer cannot keep pace.

The stream has no inherent concept of CSV rows, objects, or lines. Programs implement those boundaries. One write need not correspond to one read. A producer can have bytes in its userspace buffer that have not reached the kernel pipe. A program that prints promptly to a terminal may delay output when connected to a pipe, depending on its buffering policy.

End of file also has a concrete condition. The reader sees it when buffered data has been consumed and every open copy of the pipe's write end has closed. A stray descriptor kept open by another process can therefore leave a reader waiting even after the apparent producer has finished. Think in terms of handle lifetime, not merely the lifetime of the process whose name you recognize.

## Supplied systems reference - page 26

A pipe provides bounded kernel buffering, not a bound on the entire pipeline's memory consumption. A consumer that calls read() with no size can still accumulate its whole input. Backpressure also does not imply that every stage is equally busy or equally fast.

Why can a reader wait after the producer exits? Another process may still hold an open write descriptor. EOF requires all write ends to close, after the remaining buffered bytes are read.

## Supplied systems reference - page 27

In Bash, the rightmost pipeline stage means its position in the pipeline, not the process that finished last. PIPESTATUS exposes individual stage statuses, but the next command replaces it; capture it immediately. Even an apparently harmless assignment or status-printing command counts as the next command.

These mechanisms report termination, not correctness. A parser that accepts a malformed business identifier can exit zero. A producer can emit half its intended dataset and incorrectly report success. pipefail neither validates the result nor rolls back an output file, and it does not promise to cancel every stage as soon as one fails.

Early termination can create legitimate nonzero statuses. head reads the requested prefix and closes its input. A writer that subsequently writes into a pipe without readers receives SIGPIPE unless its signal policy changes that behavior. A producer such as GNU yes normally terminates under that signal; Bash commonly reports 128 plus signal number 13, giving 141.

## Supplied systems reference - page 28

pipefail observes only stages in that pipeline. It does not automatically include the status of a producer started by process substitution, such as the command inside < <(...). Nor does it make a background launch's immediate status equivalent to the eventual job outcome; that requires waiting.

A shell variable belongs to a shell process. An environment entry is a name and string value passed when an external command starts. Bash maintains an export attribute that determines which variables participate in that environment. A newly assigned ordinary variable need not be visible to Python; an exported one normally is. A variable inherited through the environment starts with the export attribute in Bash. Inheritance is a snapshot, not a shared dictionary. A child can change its own environment without updating the parent, its siblings, or an already running service.

Starting another process later can pass a newer value because the parent constructs that later environment from its current state. This is the same distinction you use when reasoning about process address spaces: similar initial contents do not imply shared mutable storage.

## Supplied systems reference - page 29

If two children start before and after LAB_MODE changes, must they see the same value? No. Each receives the value supplied at its own creation; neither observes subsequent parent assignments automatically.

## Supplied systems reference - page 30

A reproducible script states its interpreter and its assumptions. A Bash shebang can select Bash when the file is directly executed, but sh script.sh explicitly selects sh and bypasses that choice. On Ubuntu, sh is commonly a different implementation.

Establish where relative inputs come from, check required tools, and diagnose missing settings at the boundary. Reproducibility requires identifying environment entries that affect the result. For experiments, a small environment helps isolate a cause. Application launchers should preserve their documented environment and supply explicit configuration. Disabling profile and rc files does not itself neutralize BASH_ENV for a noninteractive invocation.

A syntax check does not verify tool availability, input schemas, permissions, or runtime branches. Likewise, a valid shebang does not control an explicit sh file invocation. State the supported entry point and test it in the environment that will actually launch the script.

## Supplied systems reference - page 31

Why might an alias defined in .bashrc be unavailable to a Bash script? A normal noninteractive invocation does not simply replay interactive startup, and alias expansion also has its own interactive default. Use a real function or executable with an explicit dependency contract.

Start code investigation by identifying candidate files, then search their contents. rg -- files answers which pathnames belong to the search universe. A content search locates literal or regular expression matches within that universe. Both operations need a scope.

## Supplied systems reference - page 32

Finding every occurrence of a word in the selected files does not find every possible use of the underlying object. Conversely, additional matches do not necessarily indicate additional executable references. Preserve that distinction when estimating the risk of a rename or migration.

## Supplied systems reference - page 33

Parsing and validation are separate. A parser can produce a row with the wrong field count, missing identifier, or invalid decimal. Establish the expected header and field count, then convert values according to the schema. For decimal arithmetic, build Decimal from the original text without an intermediate binary float. Validate special values such as infinity. Large magnitudes and many significant digits also require an appropriate Decimal context precision.

A reduction accumulates a smaller result from records. A synthetic departmental report might retain a count and a total per department. Reading one row at a time avoids retaining every record, although the dictionary grows with distinct departments. Choose the accumulator according to the question. A total discards details; identifying which record contributed an unexpected amount requires rereading input or preserving a separate audit trail.

JSON makes output structure explicit but does not invent a schema. A report can deliberately encode decimal totals as strings; consumers must follow that contract. The standard encoder handles control characters safely. Printing a Python dictionary produces Python syntax rather than JSON; manually assembling strings reintroduces escaping mistakes. Keep diagnostics on stderr so stdout remains one valid JSON document. Bash can coordinate files and processes while a format-aware program owns record boundaries and numeric meaning.

## Supplied systems reference - page 34

A CSV validator that checks header, field count and numeric values does not thereby establish that identifiers are unique or departments are authorized values. Successful parsing and those particular checks justify only those particular guarantees. Add schema rules because the workflow requires them, not because a filename ends in .csv.

A shell wrapper preserves structure while adding a label, environment setting, or output destination. A function normally executes in the calling shell, so directory changes or assignments can persist after it returns. local limits variable scope within Bash function calls. A separately executed script cannot simply assign values back into the calling shell.

Positional parameters describe the current argument vector: $# is its count, $1 its first item, and shift removes the first item from that vector. "$@" forwards each remaining item as its own argument, preserving empty values and internal whitespace. "$*" instead makes one joined string. That distinction is structural; no later splitting operation can reliably reconstruct arbitrary boundaries once values have been joined.

## Supplied systems reference - page 35

A shell wrapper should preserve the command as an argument vector. If it removes a label argument and invokes the remaining quoted argument vector, the first remaining item identifies the command and the rest become its arguments. The wrapper should not reinterpret embedded wildcards or shell operators.

Return the command's status by making it the last operation, or capture its status before printing anything else. Use return to leave a function. An exit inside a function running in your interactive shell can end that shell instead of returning a failed status to the caller.

A quoted value beginning with - can still be an option to the receiving command. Preserve boundaries with quoting, then use that command's supported option terminator, such as GNU cp --, where appropriate. There is no universal promise that every executable understands -- identically.

Why does "$@" preserve an empty argument that $@ may lose? The quoted form preserves one word per positional parameter. Ordinary unquoted expansion can apply splitting and remove empty results.

## Supplied systems reference - page 36

Atomicity answers a different question: what intermediate state can another observer see? Directly redirecting output onto an existing configuration file truncates it before writing finishes. Creating a complete temporary file and renaming it into place on the same filesystem can publish the new pathname in one replacement step. Existing readers with the old file already open can continue reading the old object; later opens find the new one. This is a property of publication, not a transaction spanning several independent files. Create temporary files in the destination directory so the final move stays on that filesystem, and check creation, writing, and replacement outcomes explicitly. mktemp avoids a predictable temporary filename. A cleanup trap removes the unpublished file on ordinary exit. Crash durability is a further requirement: a successful rename alone is not proof that file data and directory changes survive sudden power loss. That requires appropriate synchronization and a filesystem specific analysis.

Linux filenames can contain spaces, newlines, and leading hyphens, but not NUL or / within a component. Do not parse ls output or transport arbitrary filenames as newline separated text. NUL framing preserves boundaries; argument arrays preserve them inside Bash. Quoting prevents splitting; an option terminator or path prefix prevents option confusion when supported. These techniques cannot secure traversal against an attacker replacing directories or symlinks concurrently. Our fixture directory is controlled by you.

## Supplied systems reference - page 37

Comparing contents does not guarantee that two concurrent writers agree on the intended state. A single atomic replacement does not serialize a read modify write sequence. Locks, version checks, or a database transaction may be needed for a broader invariant, and cleanup cannot run after every possible termination.

Why put the temporary file beside its destination? A rename can publish it atomically within one filesystem. A cross filesystem move may instead require copying and removing, exposing different intermediate behavior.

## Supplied systems reference - page 38

Build a report from two synthetic CSV files, publish it only after validation succeeds, and then deliberately introduce a duplicate identifier. Your contract is concrete: every input has the exact header, three fields per record, a nonempty unique identifier, and finite nonnegative decimal hours. stdout contains one JSON document; stderr carries diagnostics. A failed run must leave the previous published document intact.

## Source trail

Inspect scripts/thesis/deploy-reviewed-rules.mjs and verify-remediation.mjs.
Their existence is not permission to deploy. The authorized scope must come
from the task, while the script makes that scope explicit and reproducible.


# 9. Processes, ports and environment boundaries

## The LiveKit boundary to trace

The editor, development server, browser and emulator are separate processes.
They can read different environments and keep different state alive. Closing
an editor tab does not stop a dev server. Updating a configuration file does
not guarantee that a long-running process reloaded it. A browser page may
continue communicating with a server that was started from another worktree.

This matters when a test base URL points at a port rather than an immutable
deployment. A reused port can make a browser test appear to validate a new
candidate while it is actually reaching an old process. Record the server
startup, working directory, source state and base URL. If the test runner
starts its own server, inspect that configuration instead of assuming the
currently visible terminal owns the endpoint.

## A worked local investigation

Run a local browser regression and a build sequentially, not concurrently in
the same .next directory. The repository's prior tests encountered generated
type collisions when processes shared that output. A missing-file error can
therefore be a runner artifact rather than a product defect. Reproduce the
check against stable output, retain the initial failure category, and explain
why the sequential control changes your interpretation.

Environment variables are copied into process context according to the
runtime and framework's rules. A variable available to a command-line test may
be absent in a deployed function. A server-only secret must not be promoted to
a browser-exposed variable merely to make a client component work. Correct
configuration follows the authority boundary: the backend signs tokens; the
browser receives a scoped credential, not the signing key.

## Exercise with answer

A terminal displays the correct source commit while the browser shows old
labels. List three explanations before clearing every cache. The browser may
reach another server process, the deployed alias may point to an older build,
or a client bundle may be stale relative to the intended server. Compare the
actual request destination and build identity. Clearing caches changes the
environment, so record the before state if cache behavior is part of the
question.

For emulator tests, verify that the application is using the emulator
configuration and a synthetic project before creating fixtures. A local
terminal does not make every network request local. The destination, not the
keyboard's location, determines whether an operation touches production.
That distinction is the foundation of safe fault injection.

## Diagnose the server you actually reached

A browser is open to a local address, yet your new log message never appears. The tempting response is to add more logging. First identify the listener. Another server may already own the port, the development tool may have selected a different port, or the browser may be using an old tab connected to another environment. Record the host, address family and port as a complete endpoint. The word localhost describes a caller-relative loopback context, not a universal machine shared by Windows, WSL and every container.

Inspect the listening process with read-only tools appropriate to its environment. Correlate its process identifier, command and working directory with the launch you intended. Do not terminate every Node process on the computer; the user may have unrelated work. If a supervisor launches workers, distinguish the parent from the worker that serves requests. A log line from the parent does not necessarily prove that every child loaded the same code or configuration.

Now send one harmless local request and observe the matching log or response marker. Use a synthetic request label if the application supports safe correlation. Avoid logging headers or request bodies indiscriminately. The decisive observation is that this endpoint reaches this process running this artifact. Once that chain is established, application-level debugging has a stable target.

## Process lifetime explains configuration surprises

A running process can retain old configuration after a file changes. It may read settings only during module initialization. A development reloader can replace it automatically, but that is a tool behavior to verify, not a universal property of servers. Build-time public frontend settings introduce another lifetime: changing a server environment variable does not necessarily rewrite already downloaded JavaScript. Describe when the value is bound and when a new artifact or process is required.

A process also has its own current directory and inherited environment. Changing directories in another terminal does not move it. Exporting a new value in a parent shell does not update an already-running child. A command that works after opening a fresh login shell may depend on a profile-defined version manager. Record that dependency so automated runs do not accidentally select a different interpreter.

Stopping a process is an operation with consequences. A graceful termination can allow cleanup, while a forced kill prevents application handlers from running. Neither guarantees that every external effect was undone. A database transaction may have committed before the process died, or a provider request may have succeeded without its response reaching the caller. Recovery needs idempotent intent and durable state, not the assumption that termination means nothing happened.

## Separate waiting from computation

When a local route is slow, compare elapsed time with CPU work and dependency timing. A process sleeping on a network response can have low CPU usage and high elapsed latency. A busy parser can consume CPU before issuing any database call. A browser may also wait because a paused debugger blocks its server worker. These mechanisms produce similar user-facing delay but require different corrections.

Construct two synthetic local operations: one performs bounded computation, the other waits on a controlled delay. Measure both under the same instrumentation. The point is not their absolute speed but the shape of evidence. A CPU profile should reveal repeated computation in the first. Dependency timing should explain the second. If your measurement cannot distinguish them, it is too coarse for the optimization claim.

End the exercise by cleaning up only the resources you created. Stop the known process, verify that its port is no longer listening, and preserve useful logs with their source revision. Do not infer cleanup from closing a terminal window; a detached session or supervisor may keep work alive. Resource ownership should be explicit enough that another investigator can tell what remains running without guessing from the desktop layout.

## Foundational systems reading - adapted companion material

These adapted process and container readings explain execution lifetime, terminals and isolation. Container examples are comparative models, not a description of the application's hosting architecture. Observe your actual environment before applying an operational command.

## Supplied systems reference - page 14

Record where a value is read. A database URL may be read when the application initializes. A frontend public variable may become part of browser JavaScript during build. A per-request parameter may be read repeatedly. A parameter stored in AWS Systems Manager is another resource with its own retrieval policy. Similar names do not make these values interchangeable.

Environment inspection can expose secrets. For exercises, use harmless variables. In actual diagnostics, select the property you need, such as the database host or whether a credential exists, without dumping the entire environment into a chat or log. The durable distinction is configuration scope, not a blanket rule that every variable is safe or secret.

Environment variables are strings supplied to a process, not a typed configuration system or a secure vault. Validation and secret handling must be designed around their contents and access paths.

## Supplied systems reference - page 40

Keep a short lab notebook containing your prediction, the command, the result, and the remaining uncertainty. That notebook is not administrative overhead. It forces you to expose the assumption that the next experiment must discriminate. With practice, debugging becomes a sequence of smaller questions that each have an observable answer.

## Supplied systems reference - page 41

A process is a running program together with operating system state. A program file is only one input to creating that process. Several processes can execute the same program while having different memory, directories, environments, and open descriptors.

Conversely, one process can replace its program through exec while retaining its process identifier. A tree produced by ps describes parentage; it does not tell you whether the child is executing the same application as the parent.

When inspecting a real tree, record both PID and parent PID, plus the actual command. A server supervisor may spawn a worker, and that worker may execute a different binary.

A worker can outlive its original parent and be reparented. PID values are also reused after exit, so a number remembered from yesterday is not a durable identity. Add start time when identity matters.

## Supplied systems reference - page 42

A child changes a list after fork. Must its parent observe the change? No. Ordinary private Python memory diverges; use an explicit shared mechanism if both need the result.

A shell variable belongs to the shell. Export marks a variable for inclusion in the environment passed to future child processes. Export does not update children that already exist, and a child's environment changes do not flow back into its parent.

## Supplied systems reference - page 43

Many modern language APIs create non-inheritable descriptors by default; close-on-exec flags also affect program replacement. Inheritance is a rule to inspect, not a promise that every descriptor will reach every child.

Exporting a new settings value changes an already-running worker? No. The worker retains its environment unless its own code changes it or a replacement process receives new configuration.

An interactive shell distinguishes foreground work from background jobs. The foreground process group receives terminal-generated signals and can normally read from the terminal. A background job frees the prompt but still belongs to the surrounding process and terminal arrangement. Appending & does not create a reliable service, detach every descriptor, or guarantee survival when the terminal closes.

In an interactive Bash terminal, start sleep 300, press Ctrl Z, and run jobs -l. Expect a stopped job. bg resumes it in the background; fg brings it to the foreground. Press Ctrl C after fg to terminate it. Ctrl Z normally causes a terminal stop signal, whereas Ctrl C normally generates an interrupt signal. Applications can alter terminal settings, and some signals can be handled or ignored, so these are configured behaviors rather than magical keyboard laws.

## Supplied systems reference - page 44

SIGTERM requests termination and permits a handler. SIGKILL cannot be caught and gives application cleanup no opportunity to run. A process blocked in an uninterruptible kernel wait may still not disappear immediately after KILL. A shutdown policy therefore needs a grace period, evidence of progress, and a defined escalation, not an endless series of increasingly angry signals.

Signals can target a process or a process group. A shell pipeline may contain several processes, so stopping only one PID can leave others alive. Inspect the group before choosing the shutdown scope.

kill sends a signal; it does not prove the target exited. wait observes completion of this shell's child and retrieves its exit status. Reused PIDs make careless later signaling dangerous.

## Supplied systems reference - page 45

A terminal window is a connection through which you interact with processes. Closing that window can break the connection while the work itself could, in principle, continue.

Finish by running exit in its only pane, or from outside use tmux -L tool-lab kill- session -t lab. That deliberately ends the lab session and its pane. Do not use a broad server-killing command on a server that contains work you want to retain.

A session survives detachment because the server and pane processes remain alive. Survival requires their operating system environment to remain running; restoring a layout later does not restore arbitrary process memory.

## Supplied systems reference - page 46

Linux terminal settings can collect input into lines, echo typed characters, translate newline conventions, and interpret control characters. A pseudo-terminal supplies that terminal interface without a physical serial device. Terminal emulators, SSH, and tmux use pseudo-terminals to connect interactive programs to a user interface.

Inspect intr, icanon, echo, and isig in stty -a rather than changing them blindly. Raw-mode applications such as editors can disable line processing or signal interpretation and handle keys themselves. A broken terminal display after a crashed program can therefore reflect leftover device settings. stty sane is a useful recovery command in the affected interactive terminal; it restores conventional settings, not every previous custom preference.

Ctrl C is a key gesture interpreted by the emulator and terminal configuration. SIGINT is an operating system signal. A byte whose numerical value is 3 is neither inherently a signal nor inherently a keyboard gesture.

## Supplied systems reference - page 148

A file created in container A must appear in container B from the same image? No. Their writable layers are separate unless a shared mount supplies that path.

Compose describes related services, but four different mechanisms often get confused. A network lets attached services communicate. Port publication exposes a container port through a host address and port. Environment entries supply strings to the container's processes. Volumes provide storage whose lifecycle can extend beyond a particular container. None of these substitutes for the others, and each has a different inspection point.

## Supplied systems reference - page 149

Compose uses service names for peer discovery on its networks. A peer can use a service name and internal port while a host client uses the explicitly published host port. A host port does not become the internal service port merely because both reach one application. Likewise, .env interpolation helps construct the Compose model, while container environment values require explicit configuration. Volumes preserve data across container replacement, but preservation is not a backup.

Running two copies of a project requires more than two directories. Compose project names ordinarily scope generated resources such as networks and named volumes.

## Supplied systems reference - page 150

Docker documents project-name selection, with the command line -p taking precedence over several other naming mechanisms. Prefer an explicit lab name when an experiment could otherwise target a directory-derived project accidentally. Stable development names are convenient, while concurrent branches or CI jobs need distinct names and storage policies.

Distinct container projects and storage names do not establish security isolation against a user with daemon access. They also do not prove that two applications use different external databases when configuration points to the same endpoint. Review every shared dependency, including brokers, databases, object stores, email sinks, callback URLs and external volumes.

Name collision is especially subtle when two application copies share a synthetic database inadvertently. A successful page load can conceal cross-project writes. A useful staging check uses a distinct harmless fixture marker through each copy and verifies that each reads only its intended marker. Do not perform this mutation against production merely to inspect configuration.

Distinct project names do not permit two listeners to publish the same host address and port simultaneously. Storage names and application endpoints must also be distinct when independence is intended.

## Source trail

Inspect playwright.config.ts, firebase.json, lib/firebase.ts and
lib/firebase-admin.ts. Configuration establishes possible destinations;
runtime observations establish which destination a particular process used.


# 10. Git as a model of history, working state and release evidence

## The LiveKit boundary to trace

Git records content snapshots and relationships between commits. Your working
tree, index, local branch and remote-tracking branch are different states.
Fetching updates what you know about the remote; it does not by itself replace
your current files. A safe update begins with status inspection and preserves
uncommitted work. In this project, the local AGENTS.md has repeatedly differed
from the committed version, making that distinction practically important.

Use immutable commit IDs when citing evidence. A report saying latest main
becomes ambiguous as soon as another commit is pushed. A source snapshot can
be tested locally, then published, then deployed later. Keep those timestamps
and results separate rather than compressing them into one word, shipped.

## A worked local investigation

Before pulling, inspect the branch and dirty files. If the remote can be
fast-forwarded safely, do so without inventing a merge strategy. If unrelated
edits overlap, preserve them explicitly and inspect the result after recovery.
Do not use a hard reset as a shortcut to a clean audit. A clean verification
worktree is often the smaller, more explainable experiment.

The repository also documents a squash-merge workflow. A follow-up branch can
retain commits whose changes already exist in main under a different merge
identity. Blind rebasing or force pushing can then damage history or lose
work. Follow the repository's prescribed recovery process, inspect the exact
commit intended for delivery, and use guarded updates rather than assuming
that matching messages mean matching objects.

## Exercise with answer

An application test log names commit A, but the rules file was modified after
that commit. Is the log worthless? Not necessarily, but the candidate must be
identified as A plus a specific diff or source hashes. A test result attached
to an unqualified commit would be misleading. Record the tested files and
their hashes, then tie the later publication commit to those bytes.

A documentation-only commit follows a passing application commit. Must you
claim the new documentation commit has already passed CI? No. State the
commit whose code was tested and the status of the newer checkpoint
separately. Evidence should not become a self-perpetuating claim that every
future descendant automatically inherits every test result under every
environment. Git ancestry helps explain change; it does not execute tests.

## Read three comparisons instead of one vague status

Git's working tree, index and current commit represent different states. An unstaged edit changes the working file relative to the index. A staged edit changes the index relative to the current commit. A file can have both kinds of changes at once. If you stage a correction and then edit the file again, a normal commit includes the staged version, not an automatic snapshot of every later visible change. This is why reviewing only the working-tree diff can miss what will actually be published.

Use a disposable repository to observe the distinction. Start with one short note, commit it, change one line, stage it, then add another line without staging. Predict the two diffs and inspect them. Commit only after the prediction is clear. In the real LiveKit repository, do not use this learning exercise to stage the user's unrelated AGENTS modification or existing evidence archives. A clean demonstration belongs in its own sandbox.

Record a stable commit identifier when citing implementation. A branch name moves. A merge message describes intent but does not prove file content or ancestry. A recent author date does not establish that the commit is the ancestor of the deployed artifact. Use graph relationships and actual content comparisons for those questions. In a forked workflow, identify which remote owns each branch; origin is a local configuration name, not a guarantee that it points to the authoritative repository.

## Fetching, integrating and releasing are separate acts

Fetching updates remote-tracking information without making every local file equal to remote main. Integration may fast-forward, merge, conflict or require a different recovery strategy under the repository's history policy. Read that policy before choosing rebase or cherry-pick. Do not solve a conflict by resetting away a dirty working tree. The local edits may be the only copy of the user's work.

After integration, inspect the new source and rerun the checks relevant to the changed behavior. A previous test result belongs to its original tree and environment. If the merge changes a policy file, dependency lock or test harness, the old pass cannot simply be copied into the new status row. Preserve it as historical evidence and record the new verification separately. This append-only approach makes progress visible without rewriting inconvenient failures out of history.

A push transfers source commits to a remote branch. It does not necessarily start a deployment, satisfy project permissions, publish Firestore rules or activate a new runtime. CI can pass while a deployment fails. A deployment can succeed while the production alias still points elsewhere. A rule release can update the database boundary independently of the frontend. Release evidence should identify those artifacts individually.

## Review the publication as an interface

Before committing, read the exact staged diff. Look for credentials, real identifiers, generated noise, unrelated changes and claims broader than the evidence. Include documentation when security or performance status changes. A reviewer should not need the author's memory to understand why a test was added or which environment passed. A concise commit can contain both the correction and the evidence note that explains it.

If the task is interrupted, leave a handoff with the last completed step and next unfinished one. State whether a change is local, committed, pushed, in CI or deployed. Those words should not be interchangeable. A future investigator can then continue from the correct boundary instead of repeating an audit or assuming a release happened.

For the independent exercise, examine a hypothetical commit whose message says “secure consultation writes” while the active rule source is older. What is the correct readiness state? The repository change may be reviewed and locally tested, but production security acceptance remains incomplete for that boundary. The next step is an authorized rule release and source verification, not another reassuring commit message. Git supplies trustworthy history only when the investigator asks a precise question of it.

## Foundational systems reading - adapted companion material

These adapted Git readings distinguish content history, references and operational state. Work through them in a disposable repository first, then use the same reasoning to inspect LiveKit without discarding unrelated changes or assuming a deployment.

## Supplied systems reference - page 75

A commit records a tree of versioned content together with metadata and parent relationships. Your working tree can contain edits that are not in that commit. Your database, media volume, running worker, and browser cache hold other state. A complete description of an application therefore requires several identities. A commit is essential release evidence, but it is not a snapshot of the entire operational system.

## Supplied systems reference - page 76

Git gives you several views because your work has several states. The working tree contains editable files. The index records the content selected for the next commit. HEAD identifies the current commit. A default git diff compares tracked working-tree content with the index. git diff --cached compares the index with HEAD. git status summarizes these relationships and additional path states.

## Supplied systems reference - page 78

Content addressing supplies integrity properties: an identifier depends on object content, so changing that content changes its identity. It does not establish that the code is correct, authorized by your organization, or deployed. A hash is an identifier and integrity mechanism under its algorithm's assumptions. A signature can add a claim about a key, but trust in the key's owner and review of the change remain separate concerns.

A visually recent date or a merge message does not prove that one commit is an ancestor of another. Use git merge-base --is-ancestor old new when ancestry is the question, and inspect its exit status.

Can a merge commit have no visible file changes against one parent? Yes. A merge records parent relationships as well as a tree. Its significance can be ancestry integration even when one comparison yields no content difference.

A local branch name points to a commit and normally moves when you commit on that branch. A remote-tracking reference such as origin/develop records the remote state last fetched into your repository. It is local information about a remote, not a live query of the remote server. HEAD can point symbolically to a local branch or directly to a commit.

## Supplied systems reference - page 79

Multiple remotes add another namespace. In a fork workflow, origin may be the personal fork while upstream names the company repository. One developer's origin can be another developer's upstream. The URL gives the meaning of the name. A command that is harmless when origin means a fork can have a different organizational consequence when origin means a production deployment repository.

Remote history can also be rewritten under permitted policies. A remote-tracking update may then no longer be a fast-forward. Record the old and new IDs if you are investigating such a change. Reflogs may preserve prior local reference movement for a limited period; they are not permanent remote audit records.

A branch being up to date means up to date with some identified comparison at some observation time. It does not mean every remote is synchronized or every build is current.

What does git fetch change if you are detached at yesterday's commit? It can update remote-tracking references and download objects while your detached HEAD and working tree remain at the selected commit. You then choose whether to switch or inspect another snapshot.

Detached HEAD means HEAD identifies a commit directly rather than a local branch name. It is useful for reading and testing a historical or fetched snapshot. You can still edit and commit, but a new commit is not attached to a branch unless you create or move a reference to preserve it. The state is ordinary Git behavior, not a damaged repository.

## Supplied systems reference - page 80

Two worktrees can accidentally launch Compose against the same project name and volumes. Give development experiments explicitly distinct service projects, ports, and test resources when they need to run simultaneously. If the objective is only source reading, do not start another application stack.

Shared Git objects and refs mean worktrees are related checkouts, not independent clones. Default Git rules also prevent checking out the same local branch in two worktrees at once. Separate directories do not guarantee operational separation.

## Source trail

Read docs/testing/verification-status.md and .github/workflows/quality.yml.
Use the ledger as the current projection and dated reports as preserved
history. Never silently rewrite a failed baseline to make the release story
look simpler than the actual sequence.


# 11. From URL to HTML, JavaScript and pixels

## The LiveKit boundary to trace

Opening a consultation page initiates several kinds of work. The browser
requests a document, parses markup, loads styles and scripts, constructs a
rendered interface and later performs application requests. A visible page
does not establish that authentication completed or that a media connection
exists. The first useful observation is the sequence of dependencies between
those operations, not the final color of a status badge.

Next.js can send HTML before client behavior is ready. In the patient journey,
that makes initial guidance important: someone should not stare at a blank
surface while JavaScript and authentication settle. Read the route's initial
render and then follow the client component. Distinguish a server-rendered
loading explanation from the later decision that validates an invitation.

## A worked investigation

Use a synthetic invalid invitation in a local environment. With Network
recording active, compare the initial document request, script downloads and
validation call. Predict which response can decide whether the invitation is
valid. The document can carry the interface and loading state; server
validation must check the signed capability and persisted policy. A successful
document response cannot grant direct admission by itself.

Now repeat with JavaScript disabled only in an isolated browser experiment.
Record what information remains readable, but do not interpret the missing
interactive flow as evidence that server authorization vanished. The browser
has simply stopped executing the code that normally sends the next request.
Restore the experiment's setting afterward. Do not change privacy or security
permissions in another user's active clinical session.

## Exercise with answer

A screenshot shows a spinner, while Network shows the document returned 200.
What should you inspect next? Identify the specific asynchronous operation
that controls the spinner: authentication initialization, validation, room
access, or another request. Check its outcome and the component branch that
updates state. Rebuilding CSS because a spinner is visible is not a causal
repair unless layout actually prevents access to a completed result.

Compare the meaning of a first paint, an enabled Join button and remote media
being received. They are three milestones. A performance report should name
the milestone it times and the start event it uses. Otherwise two researchers
can report very different durations while both honestly describing them as
page load time. The measurement becomes useful when its operational definition
is precise enough to reproduce.

## Foundational systems reading - adapted companion material

These adapted network readings separate naming, listening, framing and TLS identity. They provide models for diagnosing a request path; container and local-server examples must not be mistaken for the deployed teleconsultation system's topology.

## Supplied systems reference - page 101

Change one assumption at a time using a test whose possible outcomes point to different next steps. This avoids random configuration edits and browser-policy folklore. Separate transport reachability, message semantics, browser access rules, rendering behavior and asynchronous completion while retaining a connected account of the user's action.

## Supplied systems reference - page 102

localhost describes loopback from the caller's network environment. It does not name a universal shared machine. A process running in an ordinary Linux container generally reaches that container's own network namespace when it connects to 127.0.0.1. A process in WSL and a Windows browser can have different views, with WSL integration providing particular forwarding or mirrored-network behavior. State the caller before interpreting a loopback address.

Binding to 0.0.0.0 means listening on all available IPv4 interfaces there; it is not a usable remote destination address or proof of Internet exposure. Routing, port publication, firewalls, and surrounding virtualization still determine reachability. IPv6 ::1 is a separate loopback address. A client resolving localhost to IPv6 can fail against a listener that only accepts IPv4.

Windows-to-WSL localhost behavior depends on the WSL version, networking mode and firewall configuration. Microsoft documents typical NAT and supported mirrored-networking behavior, but a particular machine still needs its own observation. Test the Windows browser separately from a Linux command-line client rather than assuming that one successful path proves the other.

For Docker, published host ports and service-internal ports are distinct addresses. A browser uses the host's published port; a peer container usually uses the service name and container port. The choice belongs to the caller, not to the framework.

## Supplied systems reference - page 103

Resolution can consult local files, operating system resolver configuration, DNS servers, caches, or application-specific mechanisms. Once an address is returned, a separate connection attempt must reach a listener. Separating these stages gives a precise meaning to "DNS works": a chosen resolver returned an answer for a chosen name at a chosen time.

Compose networks provide service-name discovery to attached containers; those names are not automatically names the Windows browser can resolve. Docker documents this scope and recommends service names instead of retaining container IP addresses across replacement. A replacement can have a new IP while keeping the service name.

## Supplied systems reference - page 104

Do not fix every resolution failure by editing a hosts file. Record the caller environment, expected resolver, actual answers, address families, and whether the failure occurs before connecting. Hard-coded addresses can conceal a discovery problem and become stale. When a proxy performs the destination lookup, the client machine's lookup may not be the decisive one at all.

## Supplied systems reference - page 105

If messages may contain newline characters themselves, this framing needs escaping or another boundary rule. A length-prefixed protocol solves a different version of the problem by specifying how many bytes follow before parsing the next message.

## Supplied systems reference - page 106

TLS protects a connection using cryptographic negotiation and authentication. For a typical HTTPS client, certificate verification must establish a chain to a trusted authority and match the requested hostname to the certificate identity. An encrypted connection to the wrong party is not the intended guarantee. A certificate can be internally valid but untrusted by your client, or trusted for one name while wrong for another. This gives a disciplined interpretation of common errors. "Unknown authority" concerns the trust path. "Hostname mismatch" concerns identity. An expired certificate concerns time validity. A protocol negotiation failure can occur before the application exchanges HTTP at all. Fix the demonstrated category instead of removing verification globally, which erases the evidence and changes the security contract.

Certificate verification is not the same test as a live TLS handshake or browser compatibility. Trusting a certificate and accepting its hostname are distinct checks. A real service can also present intermediate certificates, select a certificate using SNI and negotiate protocol parameters. Testing by an IP address can change the requested identity and SNI behavior, so it is not always equivalent to testing the original hostname.

## Supplied systems reference - page 107

HTTP defines request methods and response semantics, but an application's business contract decides what "success" means for a workflow. GET is intended to be safe; PUT and DELETE have idempotent semantics; POST does not have a universal idempotency guarantee. Idempotent means repeated identical requests have the same intended effect, not necessarily identical response bodies or absence of logs. The difficult retry case is an ambiguous outcome. A client can send a POST, the server can commit its effect, and the response can be lost before the client sees it. A timeout then proves only that the client did not obtain a timely response. It does not prove the operation failed. Automatically replaying the request can create a duplicate unless the application offers a suitable identity and deduplication contract.

## Source trail

Inspect app/invite/[token]/page.tsx and the patient room components. Use the
initial-response guidance fix in the dated verification history as a case
study, not a promise that every slow connection renders identically.


# 12. Read Network without mistaking one response for the whole feature

## The LiveKit boundary to trace

The Network panel shows requests, not a single unified feature result. In a
consultation you may see HTML, script chunks, Firebase traffic, application
JSON, LiveKit region discovery and a signaling connection. Their statuses
answer different questions. A region response with status 200 does not measure
video latency. A signaling upgrade does not prove the other participant is
receiving decoded frames. An application denial may be the correct security
outcome rather than an availability defect.

Begin by clearing misleading filters. A Fetch/XHR-only view can hide the
document that supplied an error page. Preserve log when navigation is part of
the investigation, then narrow to the relevant time window. Record whether
cache was disabled and whether the request came from the foreground tab you
intend to study. A panel containing old red rows can make a repaired action
look broken if you do not match timestamps and initiators.

## A worked investigation

Study the historical patient-history missing-token incident with a synthetic
fixture. Identify the linking request and inspect whether its Authorization
header exists without copying its value. The source repair routes the request
through the shared authenticated fetch boundary. Then inspect the response
envelope and the client branch that handles failure. A 401 from a request
missing credentials is expected; silently swallowing it is a separate client
feedback problem.

The later legacy linking endpoint intentionally became an authenticated
acknowledgment without reassignment. Do not teach the older request-body
identity repair as the current architecture. A successful response now means
that the legacy call was handled compatibly, not that cached IDs were accepted
as ownership evidence. Network interpretation depends on the endpoint's
current contract.

## Exercise with answer

An endpoint returns HTML and the caller expects JSON. Before editing the
parser, inspect status, content type, destination and server failure. The
parser error explains why the UI failed to interpret the response; it may
not explain why the server returned that body. Preserve both levels in the
incident note and repair the causal boundary first.

For a safe handoff, summarize method, sanitized path, status, content type,
approximate time and expected envelope. Do not export request credentials,
invitation tokens or clinical bodies. The colleague needs enough evidence to
identify the contract failure, not enough material to impersonate a patient.

## Foundational systems reading - adapted companion material

These adapted browser and HTTP readings connect a user action to requests and completion. Their small fixture endpoints are explanatory examples, not LiveKit routes. Apply the evidence method while following the actual application endpoint.

## Supplied systems reference - page 108

A sequential idempotency demonstration that returns one stored row on retry is not a production deduplication implementation by itself. Simultaneous requests require an atomic uniqueness strategy, and real systems must define key scope, retention, payload equivalence and result storage. A key without such rules is merely a header with a hopeful name.

Read responses at the right stage. A 202 indicates acceptance rather than completed processing. A 200 can describe a successful submission endpoint while a returned job identifier still refers to pending work. A 4xx or 5xx says something about this response, but proxy errors and interrupted connections can still leave downstream effects uncertain. Retrying safe reads and retrying money-changing writes demand different application policies.

A POST times out after the server commits. Is an unconditional retry safe? No. Query or retry through an explicit deduplication contract that handles the uncertain first outcome.

The browser exposes several distinct models. The DOM represents current document structure, which may differ from original HTML after scripts run. JavaScript event handlers decide what a click does. The Network panel shows requests made while it is recording. A server response can change application state without visibly changing the page. Inspect these models in sequence when "the button does nothing."

## Supplied systems reference - page 109

Inspect the button in Elements, select a click event listener breakpoint in Sources, and click once. Expect execution to pause inside the handler. Resume execution and inspect the /result.txt request in Network, including its method, status, response body, and initiator. Chrome documents event listener breakpoints and request initiator inspection; labels vary across browsers and releases. This creates an evidence chain: the selected DOM node exists, the click reaches a handler, the handler initiates a request, and the response becomes text in the output node. If a stage is absent, investigate that stage before jumping to a later one. A paused debugger deliberately prevents subsequent work, so a pending request or unchanged page while paused can be caused by your own observation.

The Network panel must be recording at the relevant time. Preserve log can retain requests across navigation; otherwise a navigation can remove the request you meant to inspect. Source maps can map bundled code back to authored sources, but a missing or mismatched map limits confidence in the displayed location. The served JavaScript and its execution are the authoritative runtime evidence.

A missing Network row can mean no request was made, recording started too late, or filters hid it. A successful request does not prove its response was rendered.

## Supplied systems reference - page 114

Network troubleshooting improves when each test distinguishes competing explanations. "Try restarting everything" changes many variables and can destroy the evidence of the original failure. Instead, state two plausible causes and select a test that would produce different observations under them. For example, a nonexistent listener and a wrong HTTP path both look like "the endpoint fails," but a TCP connection attempt and a recorded status code separate them immediately.

For a real failure, proceed through caller environment, name resolution, address family, listener and port, connection, TLS identity, HTTP response, browser policy, and business completion as appropriate. You need not test every layer every time: a captured valid response already establishes several earlier stages for that request. Use existing evidence to choose the next missing boundary.

A diagnostic endpoint's success proves that endpoint's tested path, not all database queries or workers. Reproduction should preserve the original caller, input, and authentication context without exposing secrets.

## Supplied systems reference - page 115

A request returns 403. Is opening firewall ports the demonstrated next step? No. An HTTP responder replied; inspect the responder and its authentication, authorization, or request-validation evidence.

The answer should explain why a network response can reach JavaScript even when its status represents failure. It should also explain why a missing downstream request cannot be established from browser evidence alone when a BFF makes server-side calls.

## Source trail

Inspect lib/auth/authenticated-fetch.ts, app/api/link-patient-consultations/route.ts
and the patient dashboard. Historical screenshots are clues, not immutable
descriptions of the current endpoint's semantics.


# 13. Use Elements and accessibility state to inspect the actual interface

## The LiveKit boundary to trace

The DOM, computed styles and accessibility tree reveal different aspects of
the same interface. A button can exist in the DOM yet be off screen, covered,
disabled or missing an accessible name. A visually prominent message can fail
to announce an important state change. The investigator should identify which
representation is relevant to the user's difficulty rather than treating one
screenshot as a complete interface audit.

LiveKit's responsive room shell must preserve the ability to join and leave,
check devices and understand connection state. Side panels can become mobile
surfaces rather than fixed desktop columns. When testing a small viewport,
inspect the actual hit targets, focus order and scroll ownership. A panel that
looks compact can still trap keyboard navigation or hide the action needed
to return to the call.

## A worked investigation

Use a local synthetic consultation page and inspect the waiting-room message.
Find the accessible name of its sign-in action and the status text describing
why the patient waits. Then change only viewport size and compare whether the
same action remains reachable. This is a layout and interaction experiment,
not a test of allowlist identity. Keep admission policy fixtures constant so
you do not confuse a changed server decision with a hidden control.

For invitation cards, prefer named actions such as View queue over a clickable
card containing nested buttons. The latter creates ambiguity for pointer and
keyboard users: clicking a child can trigger a parent action unless event
ownership is carefully designed. An explicit action makes intent visible and
reduces the amount of event choreography needed to maintain the interface.

## Exercise with answer

A copied invitation shows an inline success message but focus remains on the
copy button. Is that automatically inaccessible? No. Modeless feedback can
be appropriate when it is perceivable through accessible status semantics.
Moving focus unnecessarily can disrupt the task. Test whether the feedback
is announced and whether the user can continue, not merely whether a dialog
appears.

Now compare a sort button labelled Newest first with a toggle that displays
the action it would perform next. The former describes the selected order
unambiguously; the latter may be read as the current order. The repository's
UI contract chooses explicit selected values. Accessibility and information
design overlap here: clear state vocabulary helps every reader, not only
people using assistive technology.

## Source trail

Read docs/invitation-flow-design.md and the invitation components. Browser
emulation is a useful controlled test, but a device preset alone does not
represent every physical phone, input method or assistive-technology stack.


# 14. Follow a callback in Sources without losing its authority boundary

## The LiveKit boundary to trace

A breakpoint can explain why a client branch ran. It cannot by itself prove
that a server committed an authorized operation. Use the Sources debugger to
inspect callback order, captured values and cleanup, then connect that evidence
to the server request and domain contract. This is particularly important in
React effects, where an older asynchronous operation can finish after account
or route state changes.

The invitation page has one validation path. A signed-in account refreshes its
token before sending evidence to the server. A failed refresh must not silently
become an anonymous validation, and an obsolete response must not overwrite
the newer account's admission. These are temporal client invariants layered
around a server-owned policy decision. The client does not acquire authority
to skip validation merely because it recognizes an old successful result.

## A worked investigation

In an isolated local test, delay the first validation response, change the
account fixture, and let the second response finish first. Predict the final
state before releasing the old response. The correct final result belongs to
the current validation generation. Then invoke cleanup and confirm that a
late response cannot update the detached page. A cancellation signal and a
cancelled-state guard address related but distinct problems: aborting work
does not guarantee every adapter stops at the same moment.

Inspect what the closure captures. A callback may retain a room token,
selected invitation or session identifier from the render that created it.
That can be correct if the callback acts on that exact encounter. It becomes
dangerous when stale state is later used to finalize the current encounter
without verifying identity. Follow the owner of the committed state, not just
the most convenient variable visible in the debugger.

## Exercise with answer

A developer adds a second validation request after consent to make the screen
refresh. Why can that be a design regression? The new path can omit the
credential or apply different error handling. The current architecture reruns
the single validation path instead. Centralizing the path reduces temporal
policy drift while preserving the server as admission authority.

Do not paste credential values from a debugger into an issue. Describe their
presence, source and verified properties using synthetic fixtures. A useful
breakpoint note explains which generation wrote state and why; it does not
need to include the secret that happened to be in scope.

## Foundational systems reading - adapted companion material

These adapted debugging readings use Python to illustrate stack frames, mutable state and observation side effects. The concepts transfer to JavaScript investigation, but language-specific behavior and APIs must be checked in their own runtime.

## Supplied systems reference - page 94

Cleanup and rollback also differ. A finally block executes under ordinary exception unwinding, but it is not proof of cleanup after process termination or machine failure. A database rollback reverts transactional database changes, while a Python model instance you mutated can retain new values in memory. Reload or discard the object when you need its state to agree with a rolled-back database.

The place an exception becomes visible is not always the place the bad assumption originated. Conversely, not every exception is a bug: a service may deliberately reject a stale decision. Preserve the difference between an expected domain refusal and an unexpected system failure.

After a transaction rollback, can an already-mutated model object's attribute still show the attempted value? Yes. Database rollback does not automatically rewind Python object memory. Refresh it or replace it before relying on it again.

## Supplied systems reference - page 95

Inspect only what you need. In a web process, a breakpoint can block a worker and cause browser timeouts. Use an isolated local environment and understand which request or task owns the process before pausing it.

Pausing one Python worker does not pause the database or other workers. Shared state can continue changing. A value in the paused frame is evidence about that computation, not a frozen system-wide view.

Why might evaluating list(qs) at a debugger prompt alter the investigation? It executes a lazy QuerySet and captures results at that moment, potentially issuing queries and changing what later accesses observe through the result cache.

## Source trail

Read app/invite/[token]/page.tsx and the extracted-callback regressions in
tests/queue-and-auth-regressions.test.mjs. Such tests exercise actual callback
logic with controlled IO; they do not replace a successful live consultation.


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


# 17. Follow verified Firebase claims into server permissions

## The LiveKit boundary to trace

Authentication establishes a caller; authorization decides what that caller
may do. The shared request-auth module reads a Bearer header, asks Firebase
Admin to verify the token, and returns a normalized requester. It carries
email verification explicitly rather than treating the presence of an email
string as proof of control. A permission check then resolves a recognized
role from trusted claims or a server-read profile.

Resource ownership is still a separate domain check. A doctor role does not
grant every doctor's invitations, rooms or summaries. A future reviewer role
does not grant a collection-wide clinical read. The permission map states
which kinds of actions a role may attempt; the resource boundary decides
whether this actor owns or has an exact assignment for the requested record.

## A worked investigation

Use a synthetic patient token against a doctor-only command. Assert the
denial, then use a provisioned doctor fixture and test ownership of two
different doctors' resources. Finally simulate a profile-read outage. The
service must not guess a default privileged role because Firestore is
temporarily unavailable. A retryable availability response can preserve
honest feedback while still failing closed.

Inspect the path for missing configuration separately. An uninitialized
authentication service is not a valid token denial, and neither should be
silently converted into a successful anonymous action. Error vocabulary helps
operators distinguish a bad credential from a broken dependency without
revealing sensitive internals to the browser.

## Exercise with answer

A client hides the doctor navigation when profile.role is patient. Is the
doctor endpoint protected? Not from that observation. Exercise its server
authorization and ownership checks. A request can be sent without using the
normal navigation. Conversely, an authorized endpoint can exist without a
visible UI for a reserved feature; hiding the feature does not remove the
need for deny-by-default policy.

Consider a reviewer assignment with empty identifiers on both sides. Equality
alone can say they match. The policy must require meaningful identifiers,
bounded metadata and valid time evidence before comparison. The November
follow-up hardened that pure preparation policy without exposing a faculty
route. Describe that as defense-in-depth readiness, not as proof that a live
faculty dashboard was secured.

## Trace a principal through the server boundary

Start with the request, not with the navigation menu. A hidden button is an interaction choice; a direct HTTP request can still reach the server. Identify how the route obtains credentials, verifies them and constructs its trusted principal. Then locate the permission decision for the requested object. A role name in a profile document is not automatically a trusted claim, especially if the client can edit that field. The provenance of the role is part of the security model.

Make the authorization question concrete: may this principal perform this command on this encounter now? The word “doctor” alone is incomplete. A clinician should not automatically gain access to every other clinician's consultation. Ownership, participant relationship and the command's scope still matter. Similarly, a patient role does not authorize access to another account's history. Capability names should make the operation visible rather than hiding broad authority behind a generic authenticated check.

Use three synthetic principals: an owner, a same-role non-owner and an unauthenticated caller. For each operation, write expected outcomes before running it. The same-role non-owner case is especially important because a role-only implementation can pass both the owner and unauthenticated tests. Add a malformed or missing assignment case for any prepared reviewer policy. Denial should be the default when the relationship cannot be established reliably.

## Separate claim verification from profile convenience

A profile is useful for display and preferences. It may also contain role-related metadata, but client mutability must be constrained. The profile rules examined in the earlier security work protect identity, permissions and role fields from unauthorized client changes. The corresponding positive controls matter: owners should still read their own profile and permitted login timestamps should still refresh. A rule that denies every request is not a successful access-control implementation.

Provider email verification is another distinct claim. A string stored in a profile does not inherit verification merely because the account signed in successfully. Follow the trusted token claim used by the direct-admission policy. If it is absent or false, a matching allowlist address must not bypass waiting. This conservative branch preserves the distinction between possession of a login session and proof of the intended address.

Do not make correlation signals into authentication factors. Keyed hashes can help relate bounded audit events without retaining raw IP addresses or device details, but they do not establish patient identity. A repeated browser signal can belong to different people on a shared machine, and a single person can use different networks. Security copy should describe the actual verified-account policy, not promise automatic location or device verification that the implementation does not provide.

## Prepared RBAC is not a released reviewer workflow

The faculty reviewer role remains backend-only preparation. Its existence does not justify a route, dashboard or broad clinical-data permission. An actual reviewer feature would need assignment scope, allowed projections, audit expectations and a review interaction design. A blank assignment identifier or malformed expiry must not accidentally mean unrestricted access. The denial behavior is a useful test even while the feature remains disabled.

When reviewing a proposed role change, ask which object relationship it adds and which existing callers gain authority. A new enum value can be harmless by itself but dangerous if a default branch treats every non-patient as a clinician. Exhaustive handling and explicit capabilities make that risk easier to see. Test unknown values as well as known roles where the boundary accepts external data.

For the independent exercise, explain why a valid Firebase token is necessary but not sufficient for a clinician's session mutation. Verification establishes the principal. Authorization establishes the principal's permitted relationship to the object and command. Keeping those steps separate produces a server interface that is both easier to audit and harder to misuse from a second client.

## Source trail

Read lib/services/shared/request-auth.ts, lib/auth/access-policy.ts and
lib/auth/review-assignment-policy.ts. Claim parsing, role permission and
resource ownership should remain distinguishable in your explanation.


# 18. An invitation is a bearer capability, not a patient identity

## The LiveKit boundary to trace

A signed invitation proves that its holder possesses a grant issued by the
service. The link can be forwarded, photographed or pasted into another
browser. Its signature prevents undetected modification of signed claims; it
does not identify the human holding the link. The application therefore
combines capability access with verified account evidence and human admission.

Every token-issuing path must check more than cryptography. Persisted
invitation identity, room binding, active state, expiry, ownership, use policy
and applicable capacity remain current authority. A valid old signature can
refer to a revoked record. The database record exists partly so the doctor
can stop future issuance without pretending that a signature can be edited
after it was given to a visitor.

## A worked investigation

Use the same synthetic invitation under several identities: no account,
anonymous account, unverified email account, verified non-allowlisted account
and verified allowlisted account. Only the final case should skip the queue
when the allowlist is configured accordingly. Then revoke the persisted
invitation and repeat validation. The correct decision must change even if
the original token bytes are unchanged.

Typed email is useful labeling for a doctor, not evidence for direct admission.
Network and user-agent HMAC values are correlation signals, not identity
proof. A returning browser may correlate with a recent anonymous visit, but
that observation must not become an automatic clinical identity decision.
The distinction is a privacy and accessibility benefit as well as a security
one: legitimate networks, browsers and devices change.

## Exercise with answer

A visitor copies a token and edits its room claim. Why should the request fail?
The signature check detects tampering. Now keep the original signature but
change the persisted invitation's status to revoked in a local fixture. Why
should it fail again? Current server policy must refuse issuance from the
revoked grant. These tests exercise separate layers and both belong in a
defensible explanation.

A report contains the full invitation URL so another researcher can reproduce
the test. Replace it with a synthetic fixture and redacted route. A real
invitation is access material. Reproducibility should preserve the operation
and policy inputs, not distribute a live capability.

## Model the capability as a constrained promise

An invitation capability says that its holder may ask the server to follow a particular admission policy for a particular persisted invitation. It does not say that every encoded field is sufficient or that the holder is the intended patient. A valid signature protects the signed content from undetected alteration under the key; it does not make an expired, revoked or mismatched persisted invitation usable. The server must join cryptographic validity with current durable policy.

Create a small decision matrix using synthetic labels. Keep the signature valid while changing the persisted room, status or expiry. Then keep the persisted invitation valid while presenting an altered token. The expected rejection in both directions demonstrates that neither half is sufficient alone. Add an ownership mismatch for clinician actions. This matrix is more revealing than testing only a completely fabricated token, which may fail before reaching the more subtle policy checks.

Expiry also has a time boundary. Record the clock and intended comparison in the test. Do not rely on manually waiting until a real production link expires. A controlled clock makes just-before, exact-boundary and just-after cases reproducible. If UI labels round remaining time, remember that presentation rounding is not the server's acceptance rule. A card saying “expires today” does not grant access for the rest of the calendar day.

## Reserve a visit atomically

A limited-use invitation is a concurrency problem. Two visitors can both observe one remaining use before either writes. A read-then-increment sequence outside a transaction can oversubscribe the invitation. For a new waiting visitor, use reservation, access audit and waiting-row creation belong in one atomic operation. Otherwise a counter may advance without a usable row, or a row may exist without a recorded reservation.

Design the test with explicit overlap. Hold two attempts after their initial observation, then let them contend at the mutation boundary. Assert the final counter, row count and outcomes. A sequential loop is not a concurrency test merely because it runs quickly. Include a retry that represents the same active visitor and verify that it reuses the intended row rather than consuming another visit. The identity scope of that retry must be defined by the service, not guessed from arbitrary request text.

Capacity is a different limit from total uses. A reusable invitation may permit many visits over its lifetime while allowing only a bounded waiting queue at one time. Test those constraints independently. An admitted or departed row should not necessarily count the same way as an actively waiting row. Read the actual policy and projection rather than treating the total number of historical rows as current queue occupancy.

## Keep the bearer secret out of routine evidence

The complete invitation URL is needed for navigation and an explicit copy action. It is not needed in ordinary logs, screenshots, analytics events or thesis tables. A route can preserve the first-party HTTPS shape while displaying a redacted token label. A server log should record bounded identifiers and safe outcomes rather than the full capability. An audit event's usefulness depends on its correlation and semantics, not on retaining every credential it observed.

Forwarding a capability is part of the threat model. The forwarded visitor may reach the invitation, but should still wait unless their non-anonymous provider-verified account satisfies the allowlist. This is why the policy is not “only the named email can open the link.” Describe the actual admission effect clearly before creation. The clinician should understand both the direct-join group and the fallback waiting behavior.

For the independent exercise, distinguish revocation from deleting the URL from the interface. Revocation changes the persisted authority consulted on future issuance; hiding a string changes presentation. Previously issued credentials may have their own lifetime and revocation behavior, which must be examined separately. A good design note names those boundaries instead of claiming that one button erases every possible existing connection.

## Source trail

Read docs/invitation-access-model.md, token-utils.ts and validate-service.ts.
The security model is capability plus verified identity plus admission; none
of those layers should be described as a substitute for all the others.


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


# 20. Consent versions, account refresh and stale asynchronous responses

## The LiveKit boundary to trace

An account already establishes an authentication identity. The consultation
journey should not ask someone to retype an address as though that second,
unverified string were stronger evidence. What remains necessary is informed
agreement to the current statement, recorded with the version the person saw.
The consent endpoint accepts only the current version and derives identity
from the verified account token.

Optional transcription consent is separate from the consultation agreement.
The call must remain usable with transcription off. A clinician's browser
speech-notes fallback has its own explicit start and verbal-consent
confirmation. Do not merge these controls into a generic checkbox that
silently authorizes every present and future data use.

## A worked investigation

Use an account profile with an old consent flag but no current version. The
policy should ask for the present statement rather than assume the older
agreement covered it. After the synthetic consent response succeeds, the
client reruns its single validation path, including refreshed account evidence.
It must not create a second tokenless validation route.

Now fail the signed-in token refresh. The client should show a retryable
service problem rather than silently queueing the patient as an anonymous
visitor. Delay one response across a change in account state and confirm
cleanup prevents it from overwriting the newer result. These temporal tests
protect the reliable journey without changing who the server may admit.

## Exercise with answer

The consent copy promises automatic summary deletion after a retention window.
What operational evidence should accompany that promise? Inspect retention
configuration, the scheduled worker and the scope of actual deletion. A
constant in UI copy is not proof that enforcement runs in every deployment.
The production-readiness guide explicitly treats retention approval and
configuration as separate decisions. Flag any mismatch rather than describing
an unverified promise as a measured control.

When revising a consent statement in substance, change its version so stored
agreement continues to name definite words. Do not alter historical records
to make everyone appear to have agreed to new text. Versioning preserves
meaning; it is not paperwork added after the important engineering work.

## Consent has an identity, version and scope

A checked box is evidence of a browser interaction, but durable consent needs a defined subject, purpose and version. The product distinguishes core consultation access from optional transcription. A patient should be able to complete a call without opting into the optional feature. Do not merge those decisions merely because both occur near the preflight interface. The data path must honor the optional state as well as the visible control.

Follow the account transition from signed out to signed in. The application may need to refresh profile or consent state after authentication. A response obtained for the old principal must not overwrite the new principal's state. Bind asynchronous results to the identity and request generation that created them. Cleanup should also stop obsolete polling and listeners; ignoring one promise result does not necessarily stop repeated network work.

Construct a deterministic schedule with two deferred responses. Request A starts for the anonymous visitor. Request B starts after account authentication. Resolve B first and verify the intended authenticated state. Resolve A last and assert that it is ignored. Repeat the inverse order to ensure that normal early completion still works. Then sign out before either completes. Neither result should restore account-specific state after the principal has gone away.

## Test the meaning of optional capture

For a synthetic consultation, leave transcription off and complete the core join path. Verify that the media journey does not depend on a transcription provider succeeding. Then enable capture only under the intended participant consent and verify the session binding of submitted segments. Use harmless synthetic speech or mocked segment text in local tests. Do not record a real participant's microphone to explore the feature without separate consent and authority.

The clinician's browser speech-recognition fallback has a separate interaction contract: it is labeled as browser-generated notes, started by the clinician after confirming verbal patient consent, and not described as a complete recording or transcript. That wording matters because browser recognition can omit, mishear or duplicate speech. Provenance should survive into the evidence consumed by a summary, rather than being erased by treating every text segment as equally reliable.

If consent is withdrawn or the page changes identity, consider pending work explicitly. Which audio buffers, requests or segment subscriptions remain active? Which already persisted text is subject to the approved retention policy? Do not invent deletion semantics from a checkbox alone. The operational policy must define what happens to existing evidence, and the implementation must make the relevant transitions observable without exposing clinical content in logs.

## Version changes are not ordinary refreshes

A consent version can change when the meaning of the permission changes. An old acceptance should not silently satisfy a materially different current policy merely because the same Boolean field is true. Conversely, a routine profile refresh should not invent a new consent event or ask for the same accepted version indefinitely. Model the version relationship clearly and test both current acceptance and stale acceptance with synthetic records.

Avoid a repair that catches every consent fetch error and assumes acceptance. That makes dependency unavailability expand authority. Also avoid blocking the entire core call indefinitely when only optional transcription state is unavailable. The safe behavior depends on which permission is unresolved: preserve the core journey where allowed, keep optional capture off when its authorization cannot be established, and explain the limitation inline.

For an independent exercise, imagine that a slow profile response arrives after a different user signs in on the same browser. List every state it might contaminate: displayed name, consent status, history projection, pending invitation context and capture controls. Then identify one shared lifetime boundary that can prevent the family of errors. A deep identity-scoped state owner can be easier to reason about than scattered Boolean cancellation flags, provided its interface and cleanup are explicit.

The final lesson is that time is part of authorization. A correct response can become inappropriate when applied to a different principal or revision. Tests should therefore control the ordering, not only the payload. That method transfers to admission, history, summaries and every other asynchronous projection in the application.

## Source trail

Read lib/consent/telehealth-consent.ts, app/api/patient/consent/route.ts and
docs/production-readiness.md. This chapter does not approve any retention
period or grant permission to enable transcription for a participant.


# 21. Read Firestore safely through bounded masked observations

## The LiveKit boundary to trace

A current-data audit should request the smallest field set needed for a
decision. Counting lifecycle states does not require names, emails, messages
or transcripts. The existing recon script uses field masks, bounded pages
and aggregate output. It records whether pagination completed, because a
partial scan must not be reported as a complete collection count.

Choose the project and database explicitly. A familiar collection name is
not sufficient evidence that you reached the intended environment. Inspect
database edition and location when they affect the work. Do not provision a
new database or change a project alias merely to inspect an existing system.
Read-only investigation and infrastructure mutation are different authorities.

## A worked investigation

The November snapshot contained stored-active invitations whose expiry times
were already past. The useful conclusion was that effective availability
must consider expiry, not that every such document should be deleted. Queue
rows similarly contained admitted and waiting lifecycle values from older
visits. Those counts did not establish live participants.

For a narrow usage question, request registration and session timestamps,
then aggregate by the relevant timezone. In the earlier follow-up, the profile
field was registeredAt rather than createdAt. A missing createdAt result
therefore could not establish that nobody registered. Verify schema names in
source before interpreting an all-missing field as a product defect.

## Exercise with answer

How should you answer whether anyone used the video feature yesterday?
Separate new profile records, invitation creation, admission events and
session start/end records. State the timezone and window. A session record
can indicate consultation activity, but it does not independently prove audio
or video was exchanged successfully. Transport statistics or an observed
paired journey are needed for that stronger conclusion.

Now inspect a generic recon counter called missingConsentVersion. Is it a
defect on every collection? No. A waiting row or rate-limit record may have no
reason to contain that field. Interpret counters only against the schema
contract of the collection being examined. Automated summaries are useful
instruments, not substitutes for domain meaning.

## Source trail

Read scripts/thesis/firebase-recon.mjs and the dated aggregate evidence. Do
not run production writes merely to learn a field shape. If access is blocked,
record the boundary and continue from repository contracts without inventing
current database facts.


# 22. Distinguish collections, references, projections and authoritative records

## The LiveKit boundary to trace

The database stores several views of consultation work. Invitations represent
access grants. Waiting rows represent visit admission state. Session records
represent encounters. History and summary projections present selected facts
to different audiences. A collection's existence does not tell you whether
it is the authoritative owner of a decision or a derived read model.

This matters when older data shapes coexist with newer ones. A room-level
projection can outlive the encounter that last updated it. A patient history
must not trust whichever email happens to appear on a convenient row. The
current design checks consistent recorded UID ownership and keeps clinician
drafts and other queue participants out of the patient-facing projection.

## A worked investigation

Trace one synthetic session through its durable record, events and history
response. Record which fields establish ownership and which merely label the
display. Then create a conflicting legacy shape: a root patient UID and a
metadata UID disagree. The projection should fail closed rather than choose
the value most convenient for displaying a result.

Do not repair disagreement by overwriting every legacy document. First audit
aggregate shapes and references. A destructive migration can orphan history
or remove evidence required for reconciliation. Prefer additive fields and
explicit compatibility readers when they preserve meaning without pretending
that missing ownership is known ownership.

## Exercise with answer

A summary document exists but is not visible in patient history. Is that a
bug? Check the audience contract. Clinician AI drafts may intentionally be
excluded. A missing patient metadata item is a different question from a
private summary being withheld. Interface convenience cannot decide clinical
data-sharing policy implicitly.

For a design review, draw the write owner and read consumers separately.
If several services can mutate the same identity field under incompatible
assumptions, the problem is authority leakage, not just duplicate storage.
Normalization helps, but a normalized schema still needs one clear contract
for identity and lifecycle changes.

## Foundational systems reading - adapted companion material

These adapted data-model readings use relational and Python examples for comparison. Firestore has its own APIs and transaction semantics. Transfer the distinctions between identity, snapshots, ordering and constraints, not an unverified storage implementation.

## Supplied systems reference - page 116

A primary key identifies a row within a table. A business identifier identifies something under a domain policy. A foreign key relates rows and can enforce referential integrity.

## Supplied systems reference - page 119

Iteration, list, boolean testing, and other operations can evaluate it. The QuerySet can then cache its retrieved results. Constructing a second QuerySet or asking for a modified query does not automatically reuse all that state. The cache is not a global database cache shared by every process.

## Supplied systems reference - page 120

Two evaluations can observe different committed states depending on isolation and timing. A Python list of model instances is a snapshot of retrieved objects, not an automatically refreshed view. refresh_from_db updates a selected instance's fields under its rules; it does not rewind every associated cache or produce a system-wide snapshot.

## Supplied systems reference - page 121

Offset pagination still has a concurrency limitation. If a new early position is inserted between reading page one and page two, the numeric offsets shift. A row can be repeated or skipped even with a deterministic ordering. Keyset pagination continues after a previously seen ordering key and can avoid some shifts, but it still requires clear behavior for updated sort keys, changed populations, and snapshot consistency.

An index is a maintained data structure that helps an engine locate or order data under suitable predicates. A unique index can additionally enforce a uniqueness property. Its benefit depends on columns, ordering, selectivity, statistics, engine behavior, and the query. An index also consumes space and imposes maintenance cost on writes.

## Supplied systems reference - page 122

Why might the optimizer scan a small table despite an available index? A scan can cost less than index traversal and row lookup for the table size and selectivity. The presence of an index does not force its use.

## Supplied systems reference - page 166

The same reasoning transfers to stream processing and editor commands. A pipeline that sorts all input needs different memory behavior from one that counts fixed categories. A macro repeated on every line performs work that grows with line count. An index reduces repeated search at the cost of storage and maintenance.

Big O describes asymptotic growth under a model, not elapsed milliseconds or a guarantee about all inputs. Constant factors, I/O, caching, and concurrency still require representative measurements.

A hash identifies content under an algorithm but does not reconstruct the content from its digest. A SUM preserves an aggregate but loses which rows contributed unless provenance is stored separately. A screenshot preserves pixels but can lose searchable text, hidden state, and exact command history. A static type narrows possible values in a model but does not prove what crossed a runtime boundary.

## Source trail

Read lib/services/history-summary/summary-projection-service.ts,
docs/data-model-readiness.md and docs/identity-and-record-integrity.md. Treat
the latter's historical reconciliations as recorded operations, not blanket
permission to repeat them against new data.


# 23. Transactions, use reservation and concurrent invitation redemption

## The LiveKit boundary to trace

A use counter is meaningful only if concurrent requests cannot both spend the
same final use. Reading a counter, deciding in application memory and writing
a larger value later leaves a race between those operations. The reservation
boundary therefore rereads current invitation authority inside a transaction
and commits the use, access evidence and new waiting visit together.

The visit is the accounting unit, not the HTTP request. Reconnects should reuse
an active row rather than consume a new use every time a browser retries.
Conversely, a completed or rejected visit should not be treated as indefinitely
open merely because its deterministic identity is familiar. Read the lifecycle
conditions along with the key derivation.

## A worked investigation

Construct a synthetic invitation with two allowed uses and launch more than
two concurrent reservation attempts. Assert both the accepted count and the
durable counter. Then repeat a reconnect for an already reserved visit and
confirm that its request does not allocate another visit. A test that checks
only the final numeric counter can miss duplicate rows or missing audit
events; inspect the whole atomic contract.

Transaction callbacks may run again after contention. Keep external side
effects outside a retrying decision unless they have their own idempotent
contract. A token returned only after successful authority checks is not the
same as an email or external mutation performed during a callback that later
retries. Know which work the database can roll back and which work it cannot.

## Exercise with answer

Why not reserve the use first and create the waiting row in a second write?
If the second write fails, the visitor may spend a use without receiving the
visit state needed to continue. Grouping the dependent durable effects
preserves their relationship. Optional telemetry that is not part of access
correctness can have different failure semantics, but that distinction must
be designed rather than accidental.

An invitation uses a legacy sentinel for reusable access. Should the UI show
that huge number as a capacity promise? No. The named storage convention
means reusable until expiry. Its presentation belongs to a helper so server
and interface interpretations cannot drift through repeated magic numbers.

## A race has a schedule, not merely two users

Imagine an invitation with one remaining visit. Visitor Birch reads that value. Visitor Elm reads the same value before Birch writes. Each decides that access is available. If each later increments and creates a waiting row independently, the system can grant two visits despite a correct-looking check in both requests. The defect is not that either request skipped validation. It is that the observation and mutation did not form the required atomic decision.

Write the interleaving explicitly before implementing a test. Mark the reads, decision points and writes. Then identify the invariant: the committed visit reservations must not exceed the permitted use policy, and each successful new reservation must have its corresponding waiting row and audit effect. A transaction pulls that concurrency complexity into the service rather than asking every caller to coordinate. The browser should not need to know whether another visitor is redeeming the same invitation.

Firestore transactions can retry their function when concurrent state changes. That means the transaction body must not perform uncontrolled external effects as though it runs exactly once. A provider call, email or raw log append inside the retried body can be repeated. Keep the transactional work focused on the durable records requiring coordination. If an external effect is needed, design its own identity and retry boundary rather than assuming the database transaction covers it.

## Test all sides of the atomic effect

For a successful new waiting visitor, assert the use counter, waiting-row creation and bounded access audit together. For a rejected attempt, assert that no partial reservation remains. Inject a failure at a controlled persistence point through the test adapter and verify the final state rather than only the thrown exception. The user-facing result and durable effect must agree sufficiently for safe retry. An error response after a committed effect is a different case from a rolled-back transaction.

Test a reconnect using the active visit identity. It should reuse the intended row instead of consuming another visit. Then test a genuinely new visitor with a different scope. Those cases reveal whether the idempotency identity is too broad or too narrow. A key that merges all visitors prevents legitimate use; a key that changes on every retry duplicates reservations. Define what counts as the same intent and what fields are bound to it.

Use explicit barriers or deferred adapter operations to create overlap. A loop that starts two promises may overlap in practice, but a deterministic schedule is easier to review and reproduce. Assert both outcomes and final records. If one attempt loses a transaction conflict and retries, the test should establish that the eventual decision respects the updated state. Do not make the expected result depend on which fictional visitor wins unless that ordering is part of the contract.

## Atomicity does not answer every security question

A perfectly atomic transaction can still authorize the wrong principal. Ownership and verified identity checks remain necessary. Likewise, a lock can serialize two invalid commands without making them valid. Keep the permission predicate visible in the service's decision path. The transaction protects coordinated state; authorization protects who may request its change.

Atomicity also does not mean that a later projection instantly refreshes in every browser. A committed row can exist while a client displays stale data. Realtime invalidation and re-query address observation, not the original reservation invariant. Distinguish those boundaries in both tests and explanations. Otherwise a UI refresh problem may tempt an investigator to repeat a mutation that already committed.

For an independent exercise, suppose the counter advanced but the patient reports no waiting page. List three possibilities before calling the transaction broken: the operation committed but the response was lost, the browser failed during rendering, or a later policy transition changed the row. Inspect the exact reservation and request outcome through safe labels. The correct retry behavior depends on durable identity, not on whether the patient remembers seeing a spinner.

The design objective is a simple interface with strong internal guarantees: validate this invitation and return the authorized next state for this visitor. Its caller should not perform a counter update, then an audit write, then a row creation as three conjoined obligations. Pulling that sequence downward reduces both race conditions and the amount of policy every API route must remember.

## Foundational systems reading - adapted companion material

These adapted concurrency readings compare transaction and isolation boundaries. SQL locking examples are not Firestore commands. Use them to ask sharper questions about the actual reservation service, its retry behavior and its external effects.

## Supplied systems reference - page 123

Keep transactions focused on the state requiring coordination. A network call inside a transaction can prolong locks while a remote endpoint waits or fails. Moving the call after commit avoids some timing problems, but introduces a delivery gap if the process crashes before sending it. on_commit organizes a callback after success; it does not persist the callback as a durable message.

Atomic means indivisible according to a particular interface and failure model. It is not a universal adjective for a business operation spanning several resources. Cross-resource guarantees require explicit coordination and recovery.

What does a successful atomic block prove about an S3 upload inside it? Nothing by itself. S3 is not automatically part of that database transaction, so its effects follow a separate lifecycle.

## Supplied systems reference - page 124

Atomicity and isolation answer different questions. Atomicity concerns grouping effects under failure. Isolation constrains observations and interference among concurrent transactions. A transaction can be atomic while allowing another operation to read an older state or while producing a lost update if the application uses an unsafe read- modify-write sequence.

Locks, conditional updates, and serializable execution can address different interference patterns. Serializable transactions can fail with serialization errors that require retrying the whole operation under a deliberate policy. Retry code must also account for external side effects, because repeating a transaction is not necessarily safe when it already sent a message.

Use two separate database sessions for a concurrency experiment. A single Python function issuing statements sequentially on one connection cannot demonstrate simultaneous decisions. Record which statements execute before each commit and what each session reads.

## Supplied systems reference - page 125

Locking can cover more than the exact visible row. Joins, indexed ranges, and engine-specific gap locking affect scope. Acquiring locks in inconsistent orders can cause deadlocks. A deadlock is a detected conflict requiring a deliberate retry policy, not proof that the database abandoned correctness. Minimize unnecessary locked work and define a consistent ordering where several records need coordination.

A lock protects access to resources under its mechanism, while authorization protects which actor may perform the operation. Neither replaces the other. A correct lock around an unauthorized edit remains an authorization defect.

## Source trail

Inspect lib/invitations/invitation-use-reservation.ts, validate-service.ts
and invitation-access-core.ts. The pure reservation fixture demonstrates a
counter invariant; emulator and service tests cover complementary persistence
and authorization behavior.


# 24. Rules and server commands are separate security boundaries

## The LiveKit boundary to trace

Firebase client rules and server authorization protect different access paths.
The client SDK can be constrained by deployed rules. Administrative server
access requires application policy in its own routes and services. A strong
rules file does not excuse a server endpoint that trusts caller-supplied
ownership, and a strong server service does not excuse permissive client
writes to records that service later treats as authoritative.

The consultation-integrity repair chose server-owned encounter writes. That
removes a second client write policy for identity and lifecycle fields while
preserving permitted participant reads. The design cost is that browser
clients cannot repair arbitrary records directly. That is an intentional
boundary, not a reason to reopen client writes for convenience.

## A worked investigation

Retrieve active rule source through authorized tooling and compare it to the
reviewed repository file using a documented normalization method. Then test
the matching policy in an emulator with synthetic patient, doctor and
unrelated identities. Include denied create/update/delete and allowed reads
for supported current and legacy shapes.

The earlier audit discovered active source drift after a merge. The subsequent
authorized release deployed Firestore rules only and verified the resulting
source. A later defense pass introduced another room/call creation restriction
that its own report still marked pending publication. These are distinct
releases. Never use a successful older source match to claim a newer rule
change is already active.

## Exercise with answer

A client is denied when attempting to create a consultation, while a server
command can still write it. Is that inconsistent? It can be exactly the
intended architecture. The server command authenticates the actor, checks
ownership and applies lifecycle rules before using administrative persistence.
The distinction must be visible in tests and documentation.

Why not perform the attack directly in production? It can create false
clinical records, alter identity or expose data. Exact-source emulator tests
provide a safer way to exercise malicious inputs. A production-source match
plus bounded safe acceptance checks is a defensible release argument; it is
not an independent exhaustive penetration certificate.

## Two access paths need two proofs

The application uses trusted server code and client-facing Firebase paths. These are not interchangeable authority mechanisms. Firestore Security Rules constrain applicable client requests, while privileged server SDK operations rely on the server's own credential and authorization logic. A rule that denies a client write does not automatically inspect a trusted server mutation. A secure server route does not automatically close a direct client write that the active rules still permit.

Draw both paths to the same consultation object. On the client path, identify the authenticated Firebase principal and the rule expression. On the server path, identify token verification, capability or ownership policy, service command and privileged persistence adapter. Then ask which invariant each path enforces. If either path can mutate protected state without the intended relationship, the system remains vulnerable even when the normal interface uses the other path correctly.

This explains the historical gap between a merged application fix and active production rules. Repository source can deny consultation client writes while the published policy remains older. The local test can be correct and the production acceptance still incomplete. The release record must identify the active rule source and compare it with the reviewed candidate. Do not turn a Git merge into a claim about a separately released Firebase artifact.

## Build a rule test with positive controls

Use emulators and synthetic records. Attempt a forbidden consultation write as a patient, then verify that the intended authorized read still succeeds. Try a same-role non-owner and an unauthenticated principal. For profile policy, preserve owner reads and allowed profile creation while denying cross-profile reads and role escalation. These positive controls show that denial comes from the intended policy rather than an emulator that rejects everything.

Test create and update separately. A rule can validate an existing owner field on update while allowing an attacker to choose that field during creation. A whitelist of changed fields also differs from a whitelist of all fields in a new document. Review missing fields, extra fields, malformed types and oversized values. Security policy is executable input validation as well as an ownership expression.

Retain the exact source loaded into the emulator. A test importing the wrong rule file can produce a convincing result against an irrelevant policy. Record a checksum and the emulator configuration with the evidence. When comparing deployed source, normalize only understood representation differences; do not discard meaningful text to force a match. An unexplained mismatch remains a finding requiring investigation.

## Review the trusted command boundary independently

For the server route, call the operation directly with a valid principal outside the normal UI. Attempt a cross-owner object identifier and a stale encounter binding. Confirm that the service rejects it before protected mutation. Then run the intended owner's case. A source-contract assertion that a helper name appears is useful for drift, but it does not replace behavior tests that exercise the helper's semantics.

Unexpected dependency failures should not expand access. If the database cannot establish ownership, the route must not assume that the caller owns the object. At the same time, availability failures should be classified truthfully rather than presented as ordinary empty state. A permission denial and a retryable quota outage have different meanings for both user feedback and operational response.

For an independent exercise, a direct client write is denied but the same mutation succeeds through an unprotected server endpoint. Has the rules remediation failed? The rule boundary may be working exactly as tested, while the server boundary is vulnerable. Report both facts. Security is not a score assigned to a file; it is an argument covering every relevant path to the protected effect.

End with a release checklist that separates candidate rules, emulator evidence, reviewed application code, deployed application identity and retrieved active rules. Check only the states actually observed. That discipline makes the remaining gap actionable: the next person knows whether to fix policy, test it, release it or verify the active source.

## Source trail

Read firestore.rules, functions/test/security-rules.test.cjs and the dated
rules-release and defense reports. Deployment scope, active source and test
scope must accompany every statement that a database boundary is secured.


# 25. Preserve legacy data without silently adopting another person's records

## The LiveKit boundary to trace

Legacy compatibility is not permission to guess ownership. An old record may
place a patient UID in metadata, omit it entirely or disagree with another
field. A browser may remember a session ID from a guest visit. An invitation
may contain an email associated with several historical encounters. None of
those conveniences automatically establishes that the currently signed-in
account owns every matching record.

The repaired legacy linking endpoint acknowledges authenticated old requests
without performing reassignment. New signed-in visits use a verified UID
binding at issuance and tracking time. Existing consistent ownership remains
readable, while unsupported guest history is not silently adopted. This
preserves confidentiality at the cost of automatic historical recovery.

## A worked investigation

Create three synthetic history shapes: a consistent current record, a
consistent supported legacy record and an email-only record with no reliable
UID. Query as the intended patient and as another patient with a similar
label. The first two should follow the recorded UID contract. The third
must not become owned merely because its email matches a caller's claim.

Add a conflicting record and test denial rather than arbitrary precedence.
Then inspect the response projection for accidental clinician draft or
room-wide queue details. Correct record selection and minimal response
content are separate privacy properties. An endpoint can select the right
encounter and still disclose too much of it.

## Exercise with answer

What would a safe migration require if the team later wants to recover guest
history? It needs explicit authority, a validated evidence model, a backup,
dry-run counts, idempotent reference updates, rollback and post-run checks.
The decision may require human review because missing identity cannot always
be reconstructed computationally. A deadline does not make uncertainty go away.

Explain why deleting duplicate-looking profiles first is dangerous. A row
that another record references is not yet disposable. You must understand
the reference graph and surviving identity before removal. The historical
integrity work illustrates why database tidiness is secondary to preserving
the meaning and ownership of clinical history.

## Source trail

Read docs/identity-and-record-integrity.md,
app/api/link-patient-consultations/route.ts and the patient-history
projection. No exercise in this book authorizes a live reconciliation,
demotion, deletion or reassignment of a real account.


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


# 31. Deep modules, information hiding and contract ownership

## The LiveKit boundary to trace

A deep module offers useful behavior through an interface simpler than the
knowledge it encapsulates. Invitation access should let a caller request a
decision without making the caller repeat signature checks, identity tiers,
visit reservation and waiting-row policy. History projection should supply
the audience's view without making each dashboard independently reconstruct
ownership from several collections.

Depth is not measured by file length. A short helper can be valuable when it
owns a subtle convention, such as safe chat keys or a reusable-invitation
sentinel. A large service can still be shallow if callers must know its entire
sequence of hidden preconditions. Review the knowledge required at each call
site, not the number of classes in the diagram.

## A worked design review

Take the waiting queue's shared coordinator. Its callers request a refresh
for a scope; the coordinator owns the in-flight registry and timer lifetime.
This removes the need for each panel to know how many other panels are
mounted. It also creates a responsibility: cleanup must release only the
group it joined, not a later replacement. The stale-cleanup regression
demonstrates how an encapsulated resource owner can still violate its contract.

Compare an alternative that exposes group IDs and registry mutations to every
component. It might make the coordinator implementation shorter while making
all users harder to understand. The strategic design pulls resource-lifetime
complexity downward and tests it once. The public interface stays focused on
the caller's task rather than the registry's internal bookkeeping.

## Exercise with answer

Find a rule repeated in a UI component and a server route. Should it always be
moved into a shared module? First determine whether both instances mean the
same thing. Client-side validation can improve feedback while server validation
remains authoritative. Sharing a pure bounds policy may be useful; sharing
a server credential verifier with a browser bundle would be a category error.

Now write an interface comment before proposing a refactor. Explain accepted
input, result, important failure semantics and ownership. If the comment
requires a long list of operations the caller must perform first, reconsider
the abstraction. The objective is not maximal reuse. It is fewer independent
facts that a developer must remember to preserve correct behavior.

## Foundational systems reading - adapted companion material

These adapted abstraction readings ask what an interface guarantees and what it costs. Relate each idea to a concrete LiveKit service boundary rather than treating the presence of an adapter or class as proof of depth.

## Supplied systems reference - page 163

An abstraction presents an interface while hiding selected details. The interface should make useful operations understandable without requiring the caller to reimplement them. Hidden details still affect performance, failure, and correctness when a caller crosses the abstraction's assumptions. Expertise includes knowing when to use the interface and when to inspect beneath it.

Costs belong to the contract discussion too. A convenience accessor can issue a query. A graphical dashboard can refresh a large report. A language-server request can require indexing. An interface is easier to use when it communicates expensive or stateful behavior, and a developer is more effective when they inspect the cost before nesting an operation in a large loop.

## Source trail

Read docs/consultation-modular-architecture.md and the service contracts.
Use the general software-design principles in AGENTS.md, while keeping its
unrelated product examples separate from LiveKit's actual domain contracts.


# 32. Pure decisions, IO adapters and explicit error semantics

## The LiveKit boundary to trace

A pure policy receives evidence and returns a decision without performing
network or database work. This makes its assumptions visible and its
counterexamples inexpensive to test. The admission policy, room-name policy
and reserved reviewer assignment decision are examples. Their callers obtain
trusted evidence, normalize it where necessary and perform IO after the
appropriate decision.

Do not move IO into a policy merely because one caller needs convenience.
That makes tests dependent on timing and infrastructure, and it hides the
source of authority. Conversely, do not pretend a pure decision eliminates
the need for transactional rechecks. A correct decision over stale evidence
can still produce an incorrect commit.

## A worked design review

Examine the reviewer assignment check. A valid record needs exact nonempty
identifiers, meaningful metadata and finite time values. Malformed persisted
data should return denial rather than throw during string trimming or date
comparison. The policy deliberately does not invent a timestamp from an
unknown shape. A future adapter must normalize Firestore data explicitly.

Now compare the shared database-availability classifier. It accepts known
SDK status representations and identifies retryable availability conditions.
It must not infer an outage from any message containing the word quota, or
classify permission denial as temporary service failure. The resulting HTTP
response is an adapter responsibility, while the classifier stays small and
dependency-free.

## Exercise with answer

Why not catch every exception and return false from every module? A denied
authorization decision and an unavailable database have different operational
meanings. The security boundary can fail closed in both cases while still
providing a retry explanation for the latter. Defining error semantics means
preserving useful distinctions, not exposing every internal stack trace.

The AGENTS vocabulary describes commands, facts, decisions and runners.
Apply the conceptual distinction without importing unrelated CMS modules into
this repository. A command expresses intent and may be rejected. A committed
fact must be reflected by read models. An IO adapter performs effects. Use
those ideas to clarify a lifecycle, not to rename every function mechanically.

## Foundational systems reading - adapted companion material

These adapted Python readings offer a comparative model of names, mutation and command meaning. The application uses TypeScript; preserve the reasoning about ownership and omission while checking language-specific details instead of copying syntax blindly.

## Supplied systems reference - page 90

Does saving a Python file change a function object already imported in a long-running process? Usually no. The process must perform an appropriate reload or restart, and references to older objects can remain even after some reload operations.

In Python, assignment binds a name to an object. It does not necessarily copy the object's contents. Multiple names can refer to one mutable object. Rebinding one name changes that binding; mutating the shared object changes what all references to that object can observe. This distinction is essential for caches, command objects, fixtures, and default arguments.

Equality asks whether objects compare as equivalent under their type's rules. Identity asks whether two references address the same object. Use identity for sentinel objects and None, and equality for ordinary value comparisons. Do not infer behavior from incidental integer or string interning in one interpreter. Those optimizations are not a general identity contract for your domain values.

## Supplied systems reference - page 91

Defensive copying, freezing a command, and isolating processes solve different sharing problems. A deep copy can duplicate Python objects, but it does not duplicate an external database or establish transaction isolation. Choose the boundary you intend to protect.

## Supplied systems reference - page 92

Decide what omission means for each field. None can mean missing, clear the value, preserve the value, or no result. Those are different operations. An HTTP serializer, a Python dataclass, and a service must agree about the chosen meaning. Explicit action variants or sentinels can avoid conflating states, but adding variants is useful only when they represent a real distinction.

A default input value is part of the API contract. It is not a harmless convenience if callers use it to request a different operation. A typed command still needs runtime validation and interpretation against current state.

## Supplied systems reference - page 93

The code object does not contain the full world the function operates on. Global names are resolved through runtime bindings. A function calling an ORM manager can execute database queries whose plan is chosen by another engine. A function calling requests or another HTTP library can cross network boundaries. Inspecting Python bytecode does not reveal whether an external service completed its business effect.

Parsing, representation and execution are distinct levels of evidence. Development tools expose them through source syntax in an editor, symbols in a language server, code objects in a debugger, and machine instructions or system calls in lower-level inspection. Choose the representation that can answer the current question.

A line of Python is not an atomic database action or a fixed number of CPU instructions. It can trigger multiple calls, allocate objects, release execution control, and wait on external work. Reason about the effect's actual boundary.

A traceback records stack frames involved in an exception's propagation. It connects the failing operation to the calls that reached it. The final line often names the exception type and message, but reading only that line loses the path that explains context. The line nearest the failure can be a library operation receiving invalid input from application code further up the stack.

## Source trail

Inspect lib/invitations/admission-policy.ts,
lib/auth/review-assignment-policy.ts and
lib/services/shared/database-availability.ts. Tests should exercise accepted
and rejected shapes, including nearby values that look plausible but are not
valid evidence.


# 33. Object-centered invitation workbench and modeless feedback

## The LiveKit boundary to trace

The doctor's goal is to get the intended patient into the intended consultation
safely, not to manage cryptographic internals. The invitation is therefore
the main object in the workbench. Its lifecycle, intended admission effect
and available actions should be visible where the doctor makes decisions.
Explanation can be progressively disclosed without hiding the current policy.

An allowlist setting should say both who joins directly and what happens to
everyone else. Without that second clause, people may interpret a convenience
allowlist as an exclusive access restriction. The actual policy is verified
allowlist admission or human waiting-room admission. Security copy should
describe that behavior accurately.

## A worked interaction review

Follow creation, copy, queue inspection and revocation in a synthetic local
workflow. Before creation, read the access preview. After creation, inspect
which lifecycle actions are available and whether expired links are presented
as active merely because a stored status string says active. Then test copy
feedback without moving the user into a blocking dialog.

For large archives, use bounded presentation and an explicit Show more rather
than nested scroll traps. A doctor should not have to discover which of
several scroll containers contains the desired invitation. In a responsive
call layout, preserve essential device and leave controls while moving
secondary panels into appropriate mobile surfaces.

## Exercise with answer

A panel says In room for several months next to a historical admitted row.
What is the smallest conceptual correction? Name the fact actually known:
admission and time since that decision, subject to the server's active-row
projection. Do not fabricate transport presence from queue state. Accurate
language can remove confusion without changing the underlying encounter.

A retry button is disabled forever after one service failure. Does the
authorization policy need weakening? No. Inspect client pending-state cleanup
and modeless error recovery. Reliability includes letting the user retry an
operation whose authority has not changed, while the server revalidates every
request. Interaction repair and security bypass are different actions.

## Source trail

Read docs/invitation-flow-design.md and the invitation manager components.
The selected Goal-Directed pattern is explained there with its product goal;
it is not a claim that every current screen has undergone a formal usability
study with representative clinicians and patients.


# 34. Realtime invalidates; authenticated projections supply the rows

## The LiveKit boundary to trace

Realtime updates can reduce perceived delay, but they create another route
into interface state. If that route publishes raw documents while periodic
HTTP refresh uses an ownership- and expiry-filtered projection, the UI has
two conflicting definitions of the queue. The last callback wins, making the
defect appear intermittent even though both paths behave deterministically.

The coordinator instead treats Firestore events as invalidation signals.
Subscribers request a fresh authenticated projection. The listener query
limits live statuses so historical rows do not fill its initial snapshot,
but the query is not the only security boundary. The API still supplies the
canonical view and periodic refresh reconciles expiry and legacy shapes.

## A worked investigation

Use a test snapshot whose docs property throws if accessed. Emit an event and
confirm that subscribers are notified without receiving rows. Then exercise
the real projection service with expired, revoked, stale, other-room and
other-doctor fixtures. The test separates event handling from policy filtering
instead of trusting a mock response that already contains the desired rows.

Simulate stream failure and verify the periodic fallback remains available.
An error in a listener must not turn an unavailable stream into an empty queue
presented as truth. The interface can show retryable feedback while keeping
the read model's authority and scope clear.

## Exercise with answer

Why continue periodic refresh when realtime appears healthy? Time-based
expiry can change effective availability without a new document event.
Legacy data and missed delivery can also require reconciliation. The interval
should be chosen with read budgets in mind, not removed on the assumption
that every meaningful change produces a perfect event.

What should realtime carry in a future content or clinical projection system?
Prefer an invalidation fact rather than a second authoritative state blob
unless the architecture explicitly defines and secures that replication
protocol. Fewer policy owners make consistency easier to reason about and
reduce the chance that one fast path bypasses a slower, correct boundary.

## Source trail

Inspect lib/waiting-room/waiting-queue-coordinator.ts, hooks/useWaitingQueue.ts
and invitation-access-core.ts. The contract is about ownership of rows, not
about declaring Firestore realtime inherently unsafe or HTTP inherently safe.


# 35. Resource ownership, shared polling and repeated lifecycles

## The LiveKit boundary to trace

Several panels can ask for the same queue. If each owns an independent timer
and request, the read workload scales with interface composition rather than
the doctor's task. Shared polling and in-flight request coalescing move that
complexity into one module. The public interface remains a subscription and
refresh operation instead of a collection of timers exposed to callers.

Resource sharing introduces lifetime invariants. The first subscriber starts
the group; peers join it; the last subscriber releases it. A stale cleanup
must not delete the registry entry of a newer same-scope group. Hidden tabs
pause periodic timers and refresh on return, but explicit actions and live
events have their own refresh paths.

## A worked investigation

Subscribe one hundred synthetic consumers to the same scope and assert one
timer. Trigger repeated hide/show cycles and count listeners. Unsubscribe all
consumers and require zero remaining resources. Then test stale cleanup:
close an old group, create a replacement, invoke the old cleanup again and
add another peer. The repaired implementation compares group identity before
releasing shared registry state.

For requests, hold one fetch unresolved while many same-scope callers ask for
it. They should receive the same in-flight promise. After rejection, a new
request must be possible. Different scopes must not share results merely
because a global cache is convenient. Scope keys encode the server question;
UI selection can be applied afterward where the contract permits it.

## Exercise with answer

Does passing the hundred-consumer test prove a hundred simultaneous
consultations? No. It proves a local coordination invariant under synthetic
callbacks. Media clients, network transport and database workload are absent.
Its practical value is still real: a predictable number of local timers and
overlapping requests is easier to budget and maintain.

Why prefer an ownership comparison to another global closed-handle registry?
The existing group identity already names the resource lifetime. Using it
keeps knowledge local and avoids another state structure that can drift.
Introduce additional lifecycle state only when a demonstrated requirement
cannot be expressed clearly with the present ownership model.

## Ownership is the missing half of cleanup

A timer is easy to create and easy to forget. A subscription can be shared by several consumers, while an in-flight request can outlive the component that started it. Merely returning an unsubscribe function does not make the lifecycle correct. The design needs to say who owns the resource, which consumer references keep it alive, and which exact cleanup instance is allowed to stop it.

Imagine consumer A subscribes, then consumer B subscribes to the same scope. If A's cleanup stops the shared timer unconditionally, B loses updates. If neither cleanup stops it, the timer leaks. A reference-counted or otherwise explicit shared owner can handle the relationship, but it must also protect against repeated cleanup and replacement. A stale cleanup callback should not tear down a new resource created later under the same key.

Use instance identity in the reasoning. Resource R1 is created for scope S. R1 is removed. Resource R2 is later created for S. A delayed cleanup from R1 should apply only to R1. Comparing the scope string alone is insufficient because both resources share it. This pattern appears in caches, listeners, media tracks and asynchronous request generations, not only polling.

## A lifecycle test should count effects

Start with no consumers and assert no scheduled work. Add one and count the initial fetch, timer registration and listener registration. Add many consumers for the same scope and verify the intended sharing. Use a different scope and verify isolation. Remove consumers in an unusual order, including repeated unsubscribe calls. End with zero active resources and no subsequent requests after advancing the fake clock.

Now inject a failed fetch. A shared service can become permanently stuck if an in-flight marker is never cleared after rejection. It can also create a storm if every consumer independently retries. Assert recovery after the failure and the intended maximum work. A passing happy-path count does not cover either defect. The error branch is part of the resource state machine.

Visibility changes add another schedule. Hide the page while a request is in flight, unmount the final consumer, then show the page. No obsolete callback should resurrect the resource. Mount a new consumer and verify that it receives a clean initial state. These tests are especially valuable because the UI can appear correct while leaked background work silently consumes database quota.

## Keep the interface smaller than the machinery

Consumers should ask for an authorized projection and release their interest when done. They should not need to coordinate timer IDs, visibility event listeners and deduplication flags individually. Hiding those details in one deep module makes both testing and future policy changes easier. But the module must not become a universal event bus carrying arbitrary state; its scope and authority should remain narrow.

Realtime is an invalidation signal in this architecture. The shared owner can consolidate invalidations and re-query through the authenticated API. It should not treat incoming collection data as a replacement for the server projection. This preserves the security boundary while avoiding one bespoke subscription implementation in every component. Periodic expiry reconciliation remains a semantic choice that should be documented and budgeted.

For an independent exercise, a test reports zero active timers after cleanup, yet network requests continue. What resources might remain? Consider a recursive timeout scheduled by a finishing promise, a retry loop, a realtime callback that initiates fetches or another consumer scope. Counting only interval handles is too narrow. Define the observable no-work condition and trace every path capable of producing the effect.

The design lesson is that lifetime is part of an interface contract. A function that starts ongoing work should explain when that work stops and what happens to late results. Those guarantees are as important as the returned data shape. Making them explicit prevents small local conveniences from accumulating into system-wide complexity and operational cost.

## Source trail

Read the queue coordinator and its maintained regressions. Operation counts,
latency distributions and cloud billing observations are three different
measurements; preserve that distinction when presenting this optimization.


# 36. Reproduce profile read and role-escalation failures in an emulator

## The LiveKit boundary to trace

The original profile assessment found that deployed policy differed from the
intended privacy model. A signed-in caller could read another profile and a
patient could update their own role. These are direct authorization failures,
not merely confusing interface labels. The repaired rule contract restricts
private reads and prevents client identity, privilege and consent rewrites.

Testing must preserve legitimate sign-in behavior. A profile owner should
still perform the narrow allowed login-timestamp refresh. Patient creation
should follow its validated contract, and provisioned clinician creation
requires trusted authority. Client deletion must not open a delete-and-recreate
path to a privileged role.

## A worked emulator lab

Use synthetic owner, other-user and privileged-claim contexts. Seed records
through the emulator's administrative fixture path, not by weakening rules
for the test. Attempt another-user read, own-role update, permission injection,
consent fabrication and privileged recreation. Pair these denials with the
allowed owner read and supported creation/login cases.

Run the same assertions against retrieved active source when validating a
release. A strict repository file is not proof of deployed enforcement.
Preserve failed baseline results and the successful source comparison
separately. Do not change a real patient's role to demonstrate that the
new policy refuses it.

## Exercise with answer

Why must update checks examine both actor identity and changed fields? A
field allowlist can restrict what changes while still letting any signed-in
caller change those fields on another profile. Conversely, an owner check
alone can allow the owner to promote their own privileges. The policy needs
the appropriate combination of ownership and immutable/safe field contracts.

A new account has a role string supplied by the request body. Can that
string authorize privileged creation? No. Authority must come from trusted
claims or an authorized server provisioning flow. User-supplied role data
can be the thing being validated; it cannot be its own proof.

## Source trail

Read firestore.rules and functions/test/security-rules.test.cjs alongside
the original and remediation reports. These cases support bounded
authorization conclusions, not a blanket claim of regulatory compliance or
absence of historical abuse while older rules were active.


# 37. Prove consultation write denial while preserving allowed reads

## The LiveKit boundary to trace

An encounter record carries identity and lifecycle meaning. Allowing a client
owner to rewrite those fields can turn ordinary ownership into authority to
reattribute clinical history. The current consultation policy chooses a
server-owned command boundary instead of maintaining a parallel client
write schema for the same lifecycle.

This rule applies even to a doctor using the Firebase client. The doctor's
authorized server command can still perform intended operations after
checking role, ownership and encounter state. The client rules are not the
business logic implementation for those commands.

## A worked emulator lab

Create synthetic consultation shapes for current and supported legacy
participants. Assert allowed participant reads and unrelated-user denial.
Then attempt client create, update and delete using patient, owner and
privileged client contexts. A negative-only fixture that denies everything
cannot show that the clinical read journey remains compatible.

Exercise the server projection separately with consistent and conflicting
UID fields. The Firebase read rule and the patient-facing projection are
different boundaries. The projection should also omit clinician drafts and
room-wide queue details even when the encounter belongs to the patient.

## Exercise with answer

An owner can no longer delete a consultation directly from the console.
Should the team restore the old rule? Not merely to recover a development
shortcut. Identify the intended user action and its authorized server path.
If a legitimate deletion workflow is missing, design that command with
retention, audit and reversibility requirements rather than reopening every
client write.

Why retain legacy participant read cases? Real records do not all acquire
new fields on the day a deployment ships. Compatibility readers can preserve
existing access without guessing new ownership. Record the supported shapes
explicitly so a future schema cleanup does not silently hide valid history
or expose another patient's record.

## Source trail

Read the consultation rules, the history projection service and
docs/testing/consultation-integrity-remediation-2026-11-19.md. The latter
distinguishes local candidate verification from the later authorized rules
release; keep their dates and source states separate.


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


# 39. Review account enumeration, input bounds and error disclosure

## The LiveKit boundary to trace

An error response can reveal more than the product intends. A login fallback
that searches profiles to distinguish unknown account from wrong password
can expose account existence. An invitation form that reports whether a
patient email already has an account can do the same. Generic public failure
responses preserve privacy while trusted internal diagnostics remain bounded.

Input bounds address a different risk. Authenticated callers can still send
oversized names, allowlists, chat text or summary edits. The current baseline
uses explicit type and size contracts rather than assuming that the normal
form is the only client. The allowlist, display name, summary fields and edit
history each need a bounded representation.

## A worked lab

Use synthetic credential failures and compare the public response for
different account-existence fixtures. Do not enumerate real accounts.
Inspect source for fallback database searches that bypass the generic
response. Then test summary-edit fields at their boundaries: wrong types,
oversized lists, oversized entries and allowed short content.

For unexpected exceptions, assert a generic failure or the shared retryable
database envelope as appropriate. A raw Firestore path error should not
become browser text. Do not paste real stack traces containing document IDs
into a classroom exercise merely to show what was masked.

## Exercise with answer

Why keep a positive bounded-input case? Otherwise a validator that rejects
every edit appears secure while preventing the clinician's legitimate work.
Security acceptance requires preserving the operation under its intended
contract, not eliminating it indiscriminately.

A summary's edit history is capped at recent entries. Does that automatically
satisfy audit-retention requirements? No. A bounded document history prevents
unlimited growth; an approved audit policy may require a different durable
event store and retention period. Resource bounds and governance are related
but separate decisions. Document the current scope rather than converting
one implementation constant into a compliance claim.

## Source trail

Inspect the login and invite-create routes, summary-edit-policy.ts and the
shared HTTP error helper. The relevant defense fixes are recorded in the
22 November report with their individual verification and deployment limits.


# 40. Secrets, logs, webhooks and disabled capability boundaries

## The LiveKit boundary to trace

A missing signing secret must fail closed rather than fall back to a guessable
value. A missing maintenance secret must not accidentally authenticate the
literal string undefined. A webhook must be verified before its event is
trusted. These are configuration-sensitive boundaries: the code and deployed
configuration together determine what happens.

The application uses a shared secret-comparison helper for maintenance
authorization. It hashes inputs to equal-length digests before constant-time
comparison. This narrows a timing concern but does not replace secret
rotation, protected configuration or careful logging. No comparison function
can recover confidentiality after a credential is pasted into a public
artifact.

## A worked lab

Test absent configuration, wrong credentials and the intended synthetic
credential. Use a disposable environment, never a production secret in a
test source file. For webhooks, verify that unsigned requests are refused
and that missing verification configuration does not silently enable an
unverified path. Treat delivery as a hint requiring appropriate idempotent
processing, not perfect guaranteed notification.

Attachments and scheduling remain disabled capabilities. Their reserved
names and metadata structures are preparation, not shipped user workflows.
Enabling attachments requires session-scoped storage authorization,
scanning, download policy, retention and tests. A feature flag is not the
entire security design.

## Exercise with answer

A user shares a refresh token in a screenshot. Should the investigator use it
to continue testing? No. Treat it as compromised access material and follow
the authorized account-management process. Do not repeat, persist or place it
in the thesis. Ask for a browser sign-in or established authorized connection
instead of turning a leaked token into a convenience credential.

A log records a before-and-after clinical document to make debugging easy.
What is the problem? The audit expands sensitive-data exposure and retention
without necessarily improving the narrow investigation. Prefer metadata-only
events, stable bounded error categories and purpose-limited aggregate
observations. Logging is another data system that needs its own boundary.

## Source trail

Read token-utils.ts, admin-secret-auth.ts, app/api/webhook/route.ts and
docs/production-readiness.md. Prepared features must remain server-disabled
until their explicit security gates and user workflow are implemented.


# 41. Define a metric before collecting numbers

## The LiveKit boundary to trace

A measurement starts with an operational definition. Page response, first
render, successful authentication, admission, first remote frame and clinician
completion are different events. Give each a start, an end, a unit and an
interpretation. The question determines the instrument; a convenient
instrument must not silently redefine the question.

The performance protocol separates browser quality, authenticated API work,
WebRTC media, capacity and documentation efficiency. Its proposed thresholds
are project engineering budgets, not universal medical requirements. Freeze
the intended threshold and sampling plan before collecting the main dataset.
If the plan changes, record an amendment rather than selecting the method
that makes the current numbers look best.

## A worked measurement design

For admission-to-media time, specify the admission event and require both
endpoints to receive the expected media. Record synthetic run identity,
device, browser, network condition and any shaping. Do not start one run at
button click and another at server response while calling both the same
metric. The unexplained change can dominate the result.

For a percentile, retain the sample set and derivation rule. The earlier
HTTP pilot used ten sequential observations per page, making nearest-rank
p95 equal to the maximum. That is an exploratory result, not a robust
population estimate. Connection reuse and caching were part of its conditions;
the samples were not independently controlled cold starts.

## Exercise with answer

Someone reports an average of several p95 values as the system's p95. Why is
that generally misleading? Percentiles describe ordered observations within
a workload. Averaging summaries loses the distribution and can hide different
conditions. Report per-condition distributions or compute an explicitly
justified aggregate from the underlying observations.

Now distinguish absence of failures from proof of reliability. A short run
with no disconnects establishes that none were observed during that run.
It does not establish a year-long availability guarantee. Choose duration,
repetitions and failure definitions appropriate to the claim. A narrow honest
result is useful; a broad unsupported guarantee is not improved by more
decimal places.

## Turn an adjective into an operational definition

“Fast” is not yet a metric. The patient may mean that the invitation opens quickly, that admission appears promptly, that remote speech is not delayed or that a summary becomes available soon after the call. Each outcome crosses different boundaries. Write the start event, finish event, unit and population before choosing a tool. Otherwise the easiest available timing will quietly become the answer to a different question.

For invitation opening, a browser navigation timing may be relevant. For admission freshness, compare the committed admission with the patient's observed transition under a controlled clock or correlated run. For API latency, define whether the interval includes DNS, connection establishment, authentication refresh, retries and response parsing. For media, transport RTT and end-to-end audiovisual delay remain distinct. For documentation, include clinician review and correction rather than only provider generation.

Choose an experimental unit. It might be a request, a participant join, a call pair, a run at a specified load or a clinician completing one case. Samples collected every second within one call are not automatically independent calls. If you pool every sample from every run, a long run receives more weight than a short one. That may be appropriate for a time-weighted operational metric, but it differs from comparing per-call summaries. State which question the aggregation answers.

## Define inclusion and failure before looking at results

Decide what happens to unsuccessful attempts. A latency table containing only responses that returned successfully can conceal timeouts and denied operations. Keep success rate, failure categories and latency together. Do not assign a timeout an arbitrary fast value or drop it silently. If a run is excluded because the test device failed, document that rule and preserve the excluded run's label and reason.

Warm and cold conditions also matter. A first request may initialize server dependencies, obtain credentials or populate caches. Later requests may reuse connections and compiled code. Neither is inherently the “real” result; users encounter both kinds of state. Measure and label them separately when the distinction affects the claim. A tiny cached public-page pilot cannot establish authenticated API latency, much less media performance.

Record environmental conditions that could change interpretation: source and deployment identity, browser version, device class, network arrangement, region, media settings, load and observation duration. Do not collect identifying information merely to make the table look thorough. Pseudonymous run labels and relevant technical configuration are usually enough. The smallest sufficient dataset is easier to protect and easier to audit.

## Work through a fictional distribution

Suppose ten synthetic request durations, in milliseconds, are one hundred, one hundred ten, one hundred twenty, one hundred thirty, one hundred forty, one hundred fifty, one hundred sixty, one hundred seventy, one hundred eighty and one thousand. The mean is higher than the central cluster because the final observation is much slower. The median describes a different property. Neither number alone tells you whether that slow observation was a cold start, retry or unrelated test disturbance.

A percentile also depends on the estimator, especially with a small sample. State the method instead of presenting a software-generated value as uniquely correct. More importantly, do not report a precise-looking ninety-ninth percentile from a handful of requests as though it characterizes a large operational population. Keep sample size and uncertainty visible. The goal is a defensible description, not the most impressive decimal places.

Now imagine one additional request times out. The ten successful durations do not become false, but they are incomplete as a reliability account. Report the attempted and successful counts and the timeout threshold. A performance acceptance rule might require both a bounded failure rate and a latency distribution under the declared workload. Those thresholds should come from the study's requirements, not be chosen afterward to fit the observed data.

## Distinguish diagnosis from acceptance

An exploratory measurement can help find a bottleneck without satisfying a thesis acceptance criterion. For example, a local profile may show repeated serialization work and justify a focused optimization. A staging comparison can then test whether the change improves the relevant outcome. Do not describe the exploratory profile as a capacity pass. Conversely, an acceptance run may reveal failure without identifying the cause; follow-up diagnosis needs a narrower experiment.

Use a before-and-after comparison that holds important conditions constant. Record the source revisions and confirm that both runs exercise the same functional path. If the “after” version disables a security check or skips necessary data, a faster duration is not a valid improvement. Performance must preserve the product's correctness and privacy invariants. The efficient system is one that does the required work with less unnecessary cost, not one that silently stops doing required work.

For an independent exercise, rewrite “the application is efficient” into three testable claims. One could concern hidden-page request suppression, another visible queue freshness, and another clinician documentation time. Give each a unit, population, protocol and limit. Then state which available tools can measure it and what additional participant or environment is required. This exercise turns a vague thesis adjective into a practical evidence plan.

## Source trail

Read docs/testing/performance-assessment.md and remaining-experiments.md.
The book's worked calculations are training examples. They must not be
entered into Chapter IV as measured production outcomes.


# 42. Separate main-thread work, network time and database reads

## The LiveKit boundary to trace

A slow-feeling interface can wait on JavaScript execution, rendering,
authentication, network requests or database work. A fast server response
can still be followed by expensive client rendering. Conversely, an idle
main thread may simply be waiting for a remote dependency. The Performance
and Network panels answer complementary questions.

The room route's substantial JavaScript payload includes media libraries.
That is a reason to inspect loading and execution, not an automatic proof
that a particular user experienced unacceptable delay. A bundle-size number,
a main-thread trace and an end-to-end task time are separate measurements.
Optimization should target the demonstrated bottleneck while preserving
device preflight and the working consultation journey.

## A worked investigation

Record a short local or approved synthetic task with the browser profiler.
Mark the user action and identify long tasks, rendering work and pending
requests. Repeat under the same conditions after a focused change. Keep
the before and after traces appropriately redacted and do not equate one
machine's result with representative mobile performance.

For read cost, count requests and inspect query contracts. The queue's
shared request promise reduces overlapping API calls from multiple panels,
but a server call may read several documents and a realtime listener has
its own cost. A request count is not a billed-read count unless the mapping
has been measured and its conditions recorded.

## Exercise with answer

A hidden tab stops its periodic timer, yet database reads continue. Is the
pause implementation broken? Not necessarily. Live listeners, explicit
actions, other tabs and unrelated routes can still read. Test the timer's
local invariant and investigate the remaining workload separately. Do not
promise that one visibility check eliminates every background read.

A performance trace contains sensitive URLs. Should you upload it unchanged
for help? No. Reduce it to the necessary timing and task evidence or use a
synthetic reproduction. Diagnostic artifacts can expose credentials and
account activity even when they contain no obvious clinical paragraph.
Performance observation has privacy obligations too.

## Foundational systems reading - adapted companion material

These adapted measurement readings connect elapsed time, profiling and observability cost. Their process and Python examples explain measurement boundaries, not current LiveKit benchmark results. Use the distinctions to select a discriminating local experiment.

## Supplied systems reference - page 53

For a pathname question, add openat to the traced syscall set and inspect the requested paths and returned descriptors. -f follows children; without it, a parent trace can miss the worker performing the operation. Conversely, tracing a busy process tree can create enormous output and substantial overhead. Choose the syscall set, process scope, duration, and output destination according to one hypothesis.

Tracing can also expose payloads, filenames, and credentials, so practice on fixtures and avoid copying an indiscriminate production trace into a ticket. Credentials, ptrace policy, or the surrounding container can restrict tracing even when launching your own child.

A slow command presents at least two questions: how much elapsed time passed, and what occupied that interval? CPU execution, disk access, socket waits, synchronization, deliberate sleep, and scheduling all contribute differently. Optimizing Python arithmetic will not reduce a delay spent waiting for an unavailable service. Start with a hypothesis that predicts a measurement, rather than treating "slow" as a diagnosis.

## Supplied systems reference - page 54

A bounded arithmetic workload consumes user CPU with machine-dependent duration. A sleeping process can show little cumulative CPU time while substantial elapsed time passes. A socket listing is a separate inventory of listeners, not evidence that a sleeping process owns any of them. Process attribution requires an appropriate observation and sufficient permissions.

Beware measurement scope. ps CPU percentages are not necessarily instantaneous utilization. RSS measures resident memory but shared pages make summing process RSS an imperfect system total. CPU time can accumulate across threads and, depending on tool scope, children. A short sample can miss spikes. A warm filesystem cache can make a second run faster without any code change, while a first run can include interpreter startup and imports.

Choose a narrow next experiment: replace the suspected remote call with a fixture, compare warm and cold starts, or measure one stage with a monotonic clock. Preserve the same input and environment where possible. Every measurement should eliminate at least one plausible explanation; otherwise you are collecting numbers without reducing uncertainty.

## Supplied systems reference - page 55

If tmux is available, run the producer from the isolated lab session and detach while it runs. Reattach and inspect the result. Your notebook should explicitly say which connection ended and which processes stayed alive. Do not test survival by shutting down WSL: the model already predicts that ordinary process memory will be lost.

Include process exit status when judging whether a producer completed. An artifact left on disk can predate the current attempt, so its existence alone cannot establish that the requested work succeeded.

## Supplied systems reference - page 99

Performance claims need a workload and a measured boundary. A page can be slow because of Python loops, database round trips, serialization, network latency, or browser rendering. A profiler that observes one process cannot explain every component automatically. First choose the symptom and measurement that would distinguish the likely causes.

## Supplied systems reference - page 100

Optimizing one function can leave the page unchanged if its cost is small relative to another bottleneck. Measurement overhead, cold caches, dataset size, and concurrency can affect the result. Report the conditions alongside the improvement.

## Supplied systems reference - page 157

A useful log records an event with enough context to test a claim. More text does not automatically create better evidence. Raw request bodies can contain personal data, session credentials, and noisy details while still omitting the operation identity needed to relate events. Design fields around the question: which operation, which service and version, which stage, which outcome, and how long did the stage take?

Prefer structured events with deliberate field selection. A whitelist is often easier to reason about than serializing everything and hoping a later redaction pass catches every secret. Correlation identifiers should be bounded and treated as untrusted input.

Sorting timestamps does not conclusively establish causality across hosts; parent identifiers and recorded sequence relationships can provide stronger evidence. Clock synchronization reduces uncertainty but does not make every timestamp perfectly comparable.

## Supplied systems reference - page 158

Retention needs a purpose and a known location. Keep the relevant window, configuration and version context, and checksums where integrity matters. A checksum detects changed bytes relative to a trusted reference; it does not authenticate who created the log. Excessive retention increases search cost and data exposure, while insufficient retention can erase the only evidence of an intermittent failure.

Logs, metrics, traces, and profiles expose different views. Logs describe events. Metrics aggregate quantities over time. Traces relate spans across a request or operation. Profiles attribute sampled or instrumented execution to code. Choose the view that matches the hypothesis. A CPU profile does not explain a task spending nearly all its lifetime queued, and a total request counter does not show one slow call's internal path.

Instrumentation also consumes resources. Logging adds formatting, allocation, locking, and output work. Tracing adds context propagation and storage. Profiling can change execution timing, particularly with deterministic call instrumentation. Measurement is therefore part of the experiment, with its own scope and overhead, rather than an invisible observer.

## Supplied systems reference - page 159

Start with a small useful set: operation rate, error rate, duration distribution, and saturation signals for the resource in question. Add a targeted profile or trace to explain a particular abnormal pattern. Verify overhead and access scope before leaving detailed instrumentation enabled broadly.

Observing a function at the top of a profile does not prove it is the best optimization target. Consider workload frequency, waiting time, caller structure, and whether the improvement affects the user-visible boundary.

Can request IDs be convenient metric labels? They are usually poor aggregation labels because unbounded unique values create high cardinality; keep them in appropriate event or trace data.

## Source trail

Read hooks/useWaitingQueue.ts, its coordinator and the performance protocol.
Use browser profiler data to explain client work, service logs for server
behavior and provider metrics for actual quota accounting.


# 43. Measure authenticated API performance without contaminating production

## The LiveKit boundary to trace

A public cached page is a poor substitute for an authenticated, database-backed
operation. History, invitations and queue projections require different
workloads and authority. A valid performance trial must use the intended
identity and resource scope, while keeping secrets out of the recorded sample.
Expected security denials belong to security tests, not the success count of
a valid-user workload.

Use isolated staging with synthetic accounts and a fixed workload budget.
Define the allowed host so a mistaken base URL cannot stress production.
Agree on stop conditions for unexpected failures and account for rate limits,
database reads, writes and participant-minutes. Tool availability is not
permission to generate an unbounded workload.

## A worked experiment

Choose one read-only history endpoint and a synthetic account with a known
bounded fixture. Define concurrency, repetitions, warm-up and collection
window. Measure status, total duration and the agreed error categories.
Retain all observations, including failures. If a token expires during the
run, classify the event and decide whether the run still represents the
specified authenticated workload.

Compare response time with server query behavior. A history endpoint that
returns fewer records after an authorization repair may do different work
than the earlier version. Explain that change rather than attributing every
improvement to generic speed. Correctness and privacy can alter the workload;
the comparison must preserve its meaning.

## Exercise with answer

A load generator receives many 401 responses quickly and reports excellent
latency. Did the valid-user endpoint meet its budget? No. The workload failed
to exercise its intended operation. Report the authentication setup failure
and repair the experiment before interpreting performance. Fast denial is a
useful security observation under a different claim.

Why keep secrets in an established environment rather than a committed test
file? Reproduction requires a method for obtaining authorized synthetic
credentials, not a permanent leaked token. Record the authentication setup
and token lifecycle without recording credential values. The resulting
experiment can be repeated safely after credentials rotate.

## Source trail

Read the protocol's authenticated API cases and e2e/api-access-control.spec.ts.
The latter tests rejection behavior; its passing result is not a latency or
throughput benchmark for successful consultations.


# 44. Read WebRTC statistics and compute interval metrics correctly

## The LiveKit boundary to trace

WebRTC statistics describe transport and media observations, not a single
universal latency value. Selected candidate-pair round-trip time is a network
round trip. Inbound jitter is a stream statistic. Delivered frame rate and
resolution concern received media. One-way mouth-to-ear or glass-to-glass
delay needs a separate synchronized capture method if the manuscript claims
that outcome.

Select the LiveKit peer connection for the intended synthetic call. The
earlier pasted diagnostic view selected a ChatGPT peer in a new state, which
could not support a LiveKit call-quality claim. Browser diagnostics may
include unrelated tabs; do not inspect or record them merely because they
appear in the same tool.

## A worked numeric example

Suppose two consecutive inbound samples show packets received rising from
one thousand to one thousand nine hundred ninety and packets lost rising
from ten to twenty. The interval contains nine hundred ninety received and
ten lost packets. Divide lost packets by received plus lost packets and
multiply by one hundred: the interval loss is one percent. Using the entire
lifetime counter instead would answer a different question.

For bitrate, multiply the change in received bytes by eight and divide by
the elapsed seconds. Keep streams and directions separate. Reject counter
resets or negative deltas with a recorded reason rather than forcing them
into a plausible percentage. Convert seconds to milliseconds explicitly for
RTT and jitter fields whose units require it.

## Exercise with answer

Why not download every WebRTC dump and attach it to the thesis? Raw dumps
can contain URLs, credentials, network addresses and unrelated connection
information. Retain pseudonymous run labels and required numeric metrics
instead. Audio and DataChannel recordings are different, more invasive data
collection modes and are unnecessary for ordinary transport-statistics work.

A call shows low RTT but poor video. What alternatives remain? Bandwidth,
packet loss, jitter, encoding/decoding work, resolution adaptation, rendering
and device limitations can affect experience. The next check should
discriminate these possibilities rather than declaring low RTT proof of
excellent audiovisual quality.

## Prepare a minimal transport worksheet

Create a worksheet with run label, relative sample time, connection label, stream identifier, direction and metric name. Preserve units in the column headings. Do not mix lifetime counters with interval rates in one unlabeled column. A received-byte count is cumulative state; bitrate is calculated from a change over time. A jitter value is not a lost-packet count. The worksheet should make these distinctions obvious before any chart is drawn.

Use two consecutive samples from the same stream and connection generation. Suppose bytes received rise from five hundred thousand to seven hundred thousand over two seconds. The difference is two hundred thousand bytes. Multiplying by eight and dividing by two gives eight hundred thousand bits per second. This is an interval receive rate, not the codec's configured maximum and not the server's total outbound bandwidth. Keep the scope in the result label.

Suppose the next sample comes from a new connection after a restart and its byte counter is lower. Do not subtract it from the old connection's total. Mark a generation boundary and begin a new interval. The same principle applies when a stream is replaced or its statistics identifier changes. A negative rate is evidence that the continuity assumption failed, not a value to clamp quietly to zero.

## Interpret loss without erasing its assumptions

For an interval loss calculation, use changes in packets lost and packets received under the chosen stream's semantics. State the formula and retain the contributing deltas. If the total interval packet count is zero, the loss percentage is undefined for that interval rather than automatically perfect. Counter corrections or resets can make naive subtraction inappropriate. Record invalid intervals and their reasons instead of forcing every row into a numeric percentage.

Loss alone does not describe perceived quality. A short burst may be more disruptive than the same number of losses spread over time. Concealment, retransmission and buffering can change what a listener experiences. The browser's statistics expose useful mechanisms, but they do not directly certify intelligibility or clinical adequacy. If the thesis claims user-perceived quality, add an appropriate observation or rating protocol and distinguish it from transport statistics.

Frame rate and resolution also need context. Adaptive video can lower resolution to preserve continuity under constrained bandwidth. A lower received resolution is not necessarily a software defect, though it may fail a study's declared requirement. Record both adaptation and user-facing outcomes. A comparison that ignores adaptation can mistake the system's response to a poor network for an unexplained inconsistency.

## Read candidate-pair RTT narrowly

The selected candidate pair describes the active network path at the observed time. Its RTT is a round-trip transport observation. The selected pair can change during a session, so retain the path-generation context without publishing raw addresses. A run that moves from a direct path to a relay should not be summarized as though every sample used one unchanged condition. The change may be relevant to both latency and reliability.

Do not disable certificate checks, open arbitrary ports or expose credentials to make a diagnostic capture easier. The purpose of the lab is to observe the intended secure path. If staging cannot establish that path, record the configuration blocker. A technically successful insecure workaround would measure a different system and undermine the security argument accompanying the performance result.

Browser diagnostic pages can include other tabs and incognito activity. Select only the intended synthetic call. Avoid enabling audio or DataChannel message recording for a transport-statistics study. Those modes collect substantially different information and need their own consent, retention and handling plan. A dump export should be reviewed for secrets and network identifiers before it leaves the local machine; a masked metric extract is usually a better thesis artifact.

## Work from observations toward hypotheses

Consider three fictional runs. The first has stable RTT but low video frame rate and a busy receiving device. The second has increasing RTT and loss under constrained bandwidth. The third has a brief disconnect followed by a new candidate pair and recovery. They may all be described by a user as “lag,” but their next diagnostic experiments differ. The first suggests examining decode or rendering workload; the second suggests the network path and bandwidth; the third suggests recovery behavior and path changes.

Those are hypotheses, not automatic diagnoses. Test one discriminating change at a time. Reduce competing device workload for the first case, use a controlled network condition for the second, and repeat a bounded reconnection schedule for the third. Preserve the original observation and explain what the new result rules out. Avoid changing codec, browser, network and source revision simultaneously, because any improvement would then have several plausible causes.

An independent answer should include the metric definitions, sampling continuity rules, invalid-interval policy and privacy handling. It should also state what the worksheet cannot prove: synchronized one-way media delay, maximum platform capacity or clinician efficiency. Correct calculations are necessary, but the larger skill is preventing a valid number from being assigned an invalid meaning.

## Source trail

Use docs/testing/performance-assessment.md and the W3C WebRTC Statistics API
reference named there. These numeric examples are fictional worked
calculations, not samples collected from the production application.


# 45. Design simultaneous-call capacity and reconnection experiments

## The LiveKit boundary to trace

Capacity is a workload claim. Five paired calls require ten media clients,
not five requests to a public page. The experiment must exercise the
application's authentication, admission, transport and relevant persistence
under the stated conditions. HTTP virtual users alone do not generate a
representative WebRTC media workload.

The repository protocol proposes increasing load levels on isolated staging
with synthetic participants and explicit spending limits. Baseline,
intermediate and target levels should be repeated. Retain warm-up samples
even when the predeclared analysis excludes them, and stop when the agreed
failure threshold or participant-access condition is reached.

## A worked experiment design

Describe each media client: device or process context, browser, codec,
resolution target, network and account. Monitor per-direction metrics and
application errors while participants perform the same script. A single PC
can become the bottleneck before the service does; document that limitation
instead of interpreting local CPU saturation as server capacity.

For reconnection, define the interruption and restoration instants in a
controlled test network. Measure recovery from restoration, not from whichever
button an observer happens to press afterward. Verify encounter continuity,
absence of unintended duplicate identity and appropriate user feedback as
well as media return.

## Exercise with answer

The highest completed level is three paired calls and all budgets pass. Can
the report claim capacity for five? No. Report the tested level and planned
next experiment. A system can plausibly support more, but plausibility is
not the evidence the thesis asks you to present.

Why include a long-consultation trial? Short calls may miss memory growth,
stale token handling, timer accumulation and lifecycle problems. A long run
does not establish unlimited reliability, but it exercises a different
failure surface from a quick join demonstration. Keep duration and repeated
run counts visible in the result.

## Write the run card before opening clients

A capacity run card identifies the exact application artifact, rule state, environment, device arrangement, browser versions, network condition, load level, duration, metrics, budget and stop conditions. It also names the person authorized to stop the run. This is not bureaucracy added after measurement; it is what makes the measurement interpretable and safe. Without it, a demonstration can quietly change conditions while retaining the same label.

Define a pair as one synthetic clinician and one synthetic patient unless the study explicitly includes observers. Five pairs therefore require ten clients, not five browser tabs. Separate account and media identities deliberately so duplicate-identity replacement does not masquerade as a capacity failure. A single laptop hosting many tabs may become the bottleneck before the cloud service does. If that is the chosen arrangement, state the limitation rather than attributing every failure to the platform.

Choose a workload that resembles the intended feature. Video enabled on every participant produces different demand from silent audio-only clients. Screen sharing, chat and transcription can add different work. Keep optional AI off when the study does not have entitlement or when it would confound the core-media question. Do not claim that a run without those features establishes their capacity. A bounded study can be valuable while covering only the declared core journey.

## Progress through load levels conservatively

Begin with a single pair to confirm the protocol and collection method. Increase to three pairs, then five if the budget and preceding outcomes permit. Hold each level for the declared observation interval, and record attempted joins as well as successful connections. Stop when a predefined safety or resource limit is reached. The highest successfully tested load is a tested point, not automatically the system's maximum capacity.

Repeat a level when practical to reveal variability. If only one run is feasible, report that honestly. A small thesis protocol can describe observed behavior under limited resources without pretending to estimate an operational service-level objective. Keep unsuccessful runs in the evidence set with reasons. Excluding every failure as a setup issue after seeing the outcome would bias the result toward success.

Observe both local device saturation and service responses. Browser CPU, memory pressure and media adaptation can affect the client experience. API availability and database quota can affect admission before media starts. Provider media infrastructure has its own path. A capacity failure should be classified by the boundary supported by evidence rather than assigned to “the server” generically. Often the first useful result is learning which resource saturates under this particular arrangement.

## Reconnection is a separate stress dimension

Steady-state connected load does not establish recovery behavior. Plan a bounded interruption for one synthetic participant, then observe whether the intended visit resumes without duplicate reservation, incorrect finalization or leaked background work. Record interruption duration, recovery start and recovery outcome. Avoid disrupting the entire production network to create a dramatic failure. A controlled staging condition is safer and more reproducible.

Test duplicate identity separately from network recovery. In replacement, the old connection may be intentionally displaced by a new one. In network recovery, the same visit attempts to re-establish transport. Both can generate disconnect callbacks, but their durable lifecycle implications differ. The capacity protocol should not blend them into one disconnect count without explanation. Classify expected replacement, transient recovery and unrecovered failure according to the study's definitions.

After the run, verify cleanup. All synthetic clients should leave, test polling should stop, and no capture mode should remain enabled. Check the resources you created rather than assuming that closing the visible tab stopped every worker or diagnostic recorder. Record any residual test data under the staging retention plan. Do not perform production deletion as part of routine cleanup unless that action was separately approved and precisely scoped.

## Analyze the tested range without extrapolation

Compare outcomes by load level using the declared experimental unit. Show attempted and completed joins, failures, recovery outcomes and relevant per-call metric summaries. If device classes differ across pairs, retain that distinction. A pooled average can hide one consistently poor endpoint. Explain whether a change is associated with load or merely observed during a different condition; association alone does not establish the bottleneck's cause.

For an independent exercise, suppose five pairs work for five minutes but the database read budget is nearly exhausted during setup. Can the result be called scalable? It supports a narrow media observation at five pairs under the recorded conditions. It also reveals an operational budget concern that may limit practical use. “Scalable” is too broad unless the study defines resources, workload and acceptable outcomes. Preserve both findings instead of letting the successful call overwrite the quota warning.

## Source trail

Read the capacity, reconnection and long-consultation cases in the remaining
experiments protocol. No load operation in this chapter is authorized against
the production service or real patient accounts.


# 46. Transcript consent, provenance and speaker attribution

## The LiveKit boundary to trace

Transcription is optional work around the call, not a prerequisite for
consultation access. Each participant explicitly opts in before the capture
path starts. Temporary audio is sent for transcription and discarded;
persisted text needs provenance and session binding. The browser speech-notes
fallback is labelled separately and starts only after clinician confirmation
of verbal patient consent.

Speaker attribution matters because identical words can mean different things
depending on who said them. A doctor's hypothetical question must not become
a patient's reported symptom. A transcript segment therefore needs its
session context and evidence source, not just a paragraph of text gathered
from whichever microphone happened to be available.

## A worked investigation

With synthetic dialogue and no real clinical material, test consent off and
on as separate cases. When off, the call should still complete and the
optional capture path should not upload audio. When enabled in an approved
fixture, inspect the session and speaker binding without preserving raw
audio in the study package. A friendly checkbox label is not proof that the
capture adapter obeys it.

Now interrupt the provider. The UI should explain that transcription paused
without breaking the working call. A retry or unavailable branch should not
silently substitute browser notes as though they were a complete transcript.
The evidence source must remain visible to later summary generation and
clinician review.

## Exercise with answer

A short recognition result contains repeated fragments. Should the summary
generator fill in likely clinical content? No. Repetition and sparse evidence
should reduce the evidence available, not invite inference. The application
can preserve a truthful insufficient-evidence outcome while the underlying
consultation remains a valid operational event.

Why distinguish audio disposal from text retention? Deleting temporary audio
does not delete persisted transcript text, logs, summaries or provider-side
records governed by separate policy. Consent and retention explanations must
describe the actual data classes. Avoid the vague promise that nothing is
stored if any derived clinical text survives.

## Source trail

Read the session-transcription route, SessionTranscriptionBridge and the
doctor speech-capture hook. The book does not enable recording or authorize
provider calls; demonstrations must use explicit participant choices and
synthetic dialogue.


# 47. Conservative summaries and insufficient-evidence outcomes

## The LiveKit boundary to trace

A structured model response can still be wrong. Schema validation controls
shape, not truth. The summary pipeline therefore needs evidence-quality
gates, conservative instructions, explicit provenance and clinician review.
Operational connection events cannot supply diagnoses, recommendations or a
low-risk conclusion in the absence of clinical evidence.

The system prefers normalized session transcripts and trusted ready
attachment evidence when that future capability is permitted. Empty arrays
and Unknown risk are valid results. Deterministic no-show, never-admitted
and insufficient-evidence outcomes avoid spending a model call merely to
invent a narrative where the application already knows evidence is absent.

## A worked investigation

Prepare synthetic cases with no transcript, a very short transcript,
repetitive fragments and a sufficiently detailed conversation. State the
expected evidence classification before generation. Check that the first
cases follow deterministic conservative branches and that a richer case
still produces a draft requiring review.

Inspect how clinical evidence is bounded and deduplicated. Removing duplicate
recognition fragments can improve the input without pretending that missing
speech was recovered. Preserve speaker labels and source distinctions. A
merged paragraph that loses who said what can defeat a careful prompt even
when every original segment was accurate.

## Exercise with answer

A model returns valid JSON with a confident recommendation not supported by
the transcript. Has structured output succeeded? Shape validation succeeded;
grounding failed. The clinician must correct the draft, and evaluation should
record the unsupported content. Do not report schema compliance as clinical
accuracy.

Why keep deterministic outcomes separate from generated drafts? Their
provenance and uncertainty differ. A no-show record is derived from lifecycle
facts, while a generated draft interprets evidence. Both can be useful in
history, but neither should impersonate a clinician-reviewed clinical note.
Lifecycle vocabulary makes that distinction visible.

## Source trail

Read the consultation-finalization summary generator and
docs/ai-summary-status.md. Model availability, generation speed, factual
grounding and clinician usefulness require separate evidence.


# 48. Retryable failures, exhausted entitlement and durable work queues

## The LiveKit boundary to trace

Not every provider failure should be retried in the same way. A transient
capacity refusal, a transport interruption and exhausted account credit have
different next actions. Repeatedly retrying an unavailable entitlement spends
time and quota without creating evidence. The application records exhausted
credit as unavailable rather than pretending that another immediate attempt
is likely to complete.

Durable summary jobs preserve work across interrupted functions. A lease and
bounded retry policy prevent abandoned processing state from being mistaken
for progress forever. The worker remains authenticated and processes a
bounded page; adding a queue does not remove the need for ownership checks,
idempotency and clear failure outcomes.

## A worked investigation

Use local provider adapters that simulate a retryable error, exhausted credit
and a successful structured result. Count attempts and inspect the resulting
job and summary states. Do not purchase credits or invoke a paid provider
merely to demonstrate classification. The behavior of the decision can be
tested with synthetic responses.

For transcription, inspect route budget and per-attempt timeout together.
An additional retry can exceed the function's practical duration even if each
individual attempt has a reasonable timeout. The bounded attempts must fit
the route's overall operation and leave room for response handling. The call
must continue when optional documentation work pauses.

## Exercise with answer

A dashboard says processing after the provider refused an unavailable
entitlement. What should you inspect? Follow the classification into durable
job and summary state, then the read projection and UI. A stale label can be
a projection or client-refresh problem even when the worker recorded the
correct terminal branch.

Why use a durable queue instead of only an in-memory retry loop? A function
can terminate, deploy or lose its process before work finishes. Durable state
allows later authorized recovery. However, persistence does not imply that
retries are free, immediate or clinically safe. Bounds, provenance and
reviewed-content protection remain part of the design.

## Foundational systems reading - adapted companion material

These adapted queue readings distinguish acceptance, execution and acknowledgement. They provide a general failure model for retry reasoning without claiming a particular external broker is deployed in the teleconsultation application.

## Supplied systems reference - page 155

A queue separates acceptance from execution. The broker can hold a message, a worker can reserve it, the task can perform an effect, and acknowledgement can remove the message from further delivery. Failures between these steps create uncertainty.

## Supplied systems reference - page 156

Idempotency is a property of the complete effect and its identity scope, not of the presence of a retry decorator. A task result entry and the business operation's authoritative state can also differ.

## Source trail

Read lib/services/consultation-finalization/ai-provider-errors.ts,
app/api/summary/process-queue/route.ts and the summary job services. The
current study task makes no new provider requests and supplies no evidence
of live AI documentation efficiency.


# 49. Preserve clinician edits and reject stale summary revisions

## The LiveKit boundary to trace

A ready summary is a draft. A clinician-reviewed edit changes its meaning
and status. Later generation must not overwrite reviewed content, and a
generation based on an older transcript revision must not replace a result
based on newer evidence. These are concurrency rules as well as clinical
documentation safeguards.

The summary-edit boundary validates known editable fields, rejects wrong
types and oversized values, and bounds stored edit history. Ownership is
checked separately. An input validator cannot authorize an editor, and an
ownership check cannot make an unbounded payload safe.

## A worked investigation

Create a synthetic draft and two evidence revisions. Delay generation for
the older revision, complete the newer result, then release the old operation.
Assert that stale work cannot replace the newer state. Repeat with a
clinician-reviewed record and verify regeneration leaves the reviewed content
intact.

For edits, test a valid short change, oversized text, wrong-typed lists and
history growth across repeated updates. Keep the test's content fictional.
The bounded history is a resource control, not proof that an approved audit
retention policy has been implemented across every store and backup.

## Exercise with answer

Why not resolve all concurrent edits by last write wins? In a clinical
documentation flow, the last network response may represent the oldest
evidence or an automated draft that arrived after a human correction. The
commit condition should express revision and review authority, not incidental
delivery order.

An editor saves the same text again. Should that operation necessarily create
another clinically meaningful revision? Decide the contract explicitly.
Idempotent or no-change handling can reduce noise, but it must preserve
required audit semantics. Do not add history entries mechanically without
knowing what event the entry is meant to represent.

## A generated draft and a reviewed note have different authority

An AI-produced summary can be ready for review without being accepted clinical documentation. The lifecycle label matters because it tells the clinician what remains to be done. A reviewed note represents a human decision and must not be silently replaced by a later generation. Treating both as interchangeable text loses the distinction between machine suggestion and committed review. The data model and write guards should preserve it, not merely the interface color.

Use a synthetic encounter with a transcript revision and an initial generated draft. Let the clinician edit a harmless marker and mark the note reviewed through the intended command. Now attempt regeneration from an older transcript revision. The reviewed content should remain protected. Assert durable fields and status, not only the displayed text. A stale response can overwrite data even if the current browser temporarily continues rendering the edited version.

## The two-editor race

Imagine two clinician views opened from the same summary revision. View A corrects the assessment and saves. View B, still showing the older draft, submits its own edit later. A simple last-write-wins policy can erase A's correction without warning. Optimistic concurrency instead binds the command to the version the clinician reviewed. The server compares that expectation atomically with the current state and can refuse or surface the conflict.

The exact conflict policy must be explicit. A field-level merge can be appropriate only when the system can preserve meaning safely; clinical prose is not always a set of independent fields. A conservative conflict panel can show that the note changed and require deliberate reconciliation. Do not automatically concatenate two assessments or choose the latest browser clock. The command's acceptance should depend on trusted persisted revision state, not a client's claim that it is newer.

Build the race with deferred persistence or controlled adapters. Have both views read revision R. Commit A to R plus one. Then submit B with expected R. Verify the intended conflict and preserve A's edit. Refresh B and submit a deliberate new command from the current revision to show that legitimate continuation still works. A test that only rejects B without proving a usable recovery path is incomplete from the clinician's perspective.

## Transcript revision protects evidence alignment

Generation can take time. While a provider works from transcript revision T, new segments may produce T plus one. If the old result returns later, it may omit important evidence. A revision guard prevents that old result from being treated as current without an explicit policy. The guard is separate from clinician-review protection: one concerns evidence freshness, the other human authority. Both can apply to the same late result.

Keep the generation request's evidence identity in the workflow. Do not rely only on a request timestamp, because clocks and asynchronous completion can mislead. The server should know which transcript revision the result was based on. When a stale result is rejected, the outcome should be understandable and bounded; it must not trigger an unlimited regeneration loop that consumes provider budget. A new attempt should have a defined reason and current evidence.

## Preserve provenance through the projection

The clinician's history view may expose draft status, review status and evidence quality differently from the patient's projection. Do not broaden the patient view to include internal queue details or every AI artifact merely because the server stores them together. Projection is a deliberate information boundary. A reviewed result can be visible under the product policy while unfinished machine output remains appropriately scoped.

Audit events should record the operation and safe revision relationships without copying clinical text into logs. A record that revision R was replaced by an authorized review can be useful; duplicating the full note in every event increases retention and disclosure complexity. The minimum sufficient provenance depends on the approved policy. A broad debug serialization is not a substitute for that design.

For an independent exercise, the clinician edits a ready draft while a background retry is pending. List the required safeguards. The retry must remain session-scoped, bind to its evidence revision, observe the current reviewed state and avoid overwriting accepted content. The client should handle the eventual outcome without reverting its current projection. This scenario ties together durable retry identity, optimistic versions, human review and stale asynchronous work.

The final design should make a simple promise: the clinician can understand which evidence produced the draft, edit it deliberately and trust that accepted work will not disappear behind a later automated response. That promise requires coordination inside the service. It should not depend on the clinician keeping only one tab open or remembering to wait until every background request has finished.

## Foundational systems reading - adapted companion material

These adapted database readings explain stale human intent and concurrency. Relational examples are comparison models, not instructions to migrate Firestore. Preserve the atomic version-check principle while tracing the actual summary review implementation.

## Supplied systems reference - page 126

A lock coordinates transactions executing now. It does not tell you whether a user made a decision from a form opened twenty minutes ago. Optimistic concurrency attaches a reviewed version to the request, compares it with current state, and rejects or reconciles a mismatch. The user's intent is applied to the state they actually reviewed, rather than silently overwriting another decision.

## Supplied systems reference - page 127

An optimistic comparison without an atomic conditional write or a lock can have its own race between checking and updating. Design the comparison and mutation as one protected transition.

Why can locking alone accept stale form intent? The lock reads current state at execution time, but without the reviewed token the service does not know that the user's request was based on an older state.

The database protects the business key regardless of the application's earlier observation. Foreign-key and uniqueness constraints also cover writers outside a particular view, including imports and management commands, provided they do not disable or bypass the constraints.

Adding a constraint to an existing database requires inspecting historical duplicates and deciding which records or evidence to preserve. Deleting whichever row has the highest ID is not a domain resolution rule. Compare effective decisions, source provenance, timestamps, and downstream references under an explicit migration plan.

## Supplied systems reference - page 128

A successful precheck is an observation at one time. A constraint is enforcement at the database mutation boundary. Treat them as different mechanisms rather than alternative spellings of the same protection.

## Supplied systems reference - page 129

Why can changing AutoField to BigAutoField matter beyond one table? Related foreign keys, indexes, migrations, database capacity, and compatibility with existing IDs can be affected. The change should be reviewed as schema evolution.

## Supplied systems reference - page 130

Use barriers or explicit synchronization rather than hoping two threads overlap after a sleep. Verify the final database state and relevant audit outcomes. A reliable failure case should expose the original race and explain what each writer observed.

Why include both refusal and allowed-path tests for schedule protection? They establish that the invariant is preserved while ordinary unprotected work remains possible. Either half alone leaves an important omission.

In an isolated MySQL or PostgreSQL test database, repeat with two actual sessions and an explicit transaction boundary. Observe whether a locking read waits, what the second writer sees after the first commits, and how the version comparison reports a conflict.

## Source trail

Read lib/services/summary-management/summary-edit-policy.ts, its core service
and consultation-finalization revision guards. The lifecycle processing,
ready, reviewed, failed and unavailable should remain consistent across
storage, projection and UI vocabulary.


# 50. Measure documentation efficiency with an actual reviewer

## The LiveKit boundary to trace

Model response time is not clinician time saved. A generated draft can be
fast and still require extensive review, correction or reconstruction.
Documentation efficiency compares the entire relevant workflow against a
defined baseline using the same case material and an appropriate reviewer.
Clinical usefulness and factual quality must accompany the time comparison.

The protocol proposes paired manual and AI-assisted documentation on
deidentified or synthetic cases with counterbalanced order. Record manual
documentation time, generation delay and clinician review/correction time.
Account for familiarity: doing the manual note first can make the later
assisted task easier even when the tool adds no genuine benefit.

## A worked study design

Choose a fixed case set and define what counts as a completed acceptable note.
Prepare a rubric for factual omissions, unsupported additions and necessary
corrections. Have the reviewer complete both workflows under the agreed order
design. Preserve timing and rubric outcomes using pseudonymous case labels,
not raw patient material in a public appendix.

Report paired differences and uncertainty appropriate to the sample. Do not
combine a provider latency pilot from one environment with a clinician task
from another and call the subtraction measured savings. If AI entitlement is
unavailable, record that limitation and conduct only the portions that remain
authorized and meaningful.

## Exercise with answer

A draft takes ten seconds to generate and two minutes to correct; a manual
note takes ninety seconds. Did the assistant improve efficiency for that
trial? Not under a workflow measure that includes generation and correction.
The result may still teach something about quality or a different task, but
it does not support the desired time-saving claim.

What if only students, not clinicians, participated? Describe the convenience
sample honestly and limit generalization. Their usability observations can
be useful without being representative evidence of clinician efficiency or
clinical safety. Methodological honesty makes the thesis more defensible,
not less valuable.

## Define the task a clinician actually completes

The assisted task is not “wait for a model response.” It is producing an acceptable consultation note from the available evidence. Define the start event, final acceptance event and quality rubric before timing. Include reading, correction and review in the assisted condition. Include equivalent evidence access in the manual condition. If the assisted workflow receives a prepared structured transcript while the manual workflow receives only an audio recording, the comparison changes more than the documentation tool.

Use synthetic cases to avoid exposing patient information and to control evidence. Each case should have a known set of supported facts and deliberate unknowns. Include an insufficient-evidence case so the system is not rewarded for inventing a complete-looking note. A qualified reviewer should judge factual support, completeness relative to the supplied evidence, unsupported statements and required corrections. The rubric should reward conservative uncertainty where evidence is absent.

## Counterbalance learning and order effects

If every participant writes manually first and uses assistance second, familiarity with the cases can look like a tool benefit. Counterbalance order where feasible and use comparable cases rather than simply repeating one memorized case. Record the assignment procedure. A small convenience sample can still provide exploratory evidence, but it does not establish broad clinical effectiveness across specialties or institutions. State recruitment and sample limitations plainly.

Training also matters. Give participants enough orientation to operate both workflows, then keep the measured task separate from learning the interface. Document what assistance or clarification the facilitator may provide. If the facilitator repairs every generated draft during the assisted condition, the measured time no longer represents the clinician's independent workflow. Preserve deviations and explain them rather than hiding them in an aggregate.

Record the actual elapsed task times with a consistent clock method. Pauses, interruptions and technical failures need predefined handling. A provider outage should not silently disappear from the dataset, but it may require a separate availability category rather than an artificial note-completion time. Keep attempted tasks, completed tasks and excluded tasks visible. The unit of comparison should remain the participant-case task or another explicitly defined unit.

## Quality and speed must be interpreted together

Suppose the assisted condition is faster but produces more unsupported recommendations. That is not an uncomplicated efficiency improvement. The task's acceptance criteria must include evidence-grounded quality. Conversely, a careful reviewer may spend longer correcting one difficult draft while benefiting on other cases. Preserve per-case patterns rather than compressing every outcome into a single percentage. A useful report explains where assistance helps, where it creates work and where it is unavailable.

Distinguish generated content from clinician-added content in the analysis where the protocol permits it. A clinician may appropriately add reasoning that was not in the transcript, but that does not mean the AI generated it accurately. The product's summary grounding requirement concerns the machine output's evidence. The final clinical note may include human judgment under a different provenance. Conflating them exaggerates model performance and erases the clinician's contribution.

Use fictional examples in the rubric. If the evidence says that a symptom was not discussed, an empty field or explicit unknown can be correct. If a draft fills the gap with a plausible diagnosis, mark that as unsupported even if it sounds professional. A short consultation or poor recognition must not be interpreted as low risk. The quality study should therefore include both factual omissions and hallucinated additions, not only grammar and readability.

## Handle unavailable AI honestly

The earlier provider-credit limitation means the assisted workflow may be unavailable under the current entitlement. Do not spend paid credits or substitute another provider without authorization. The proper status is blocked or not tested for the affected condition. You can still prepare cases, timing sheets and the review rubric, and verify that the core call works with transcription off. Preparation is progress, but it is not a completed efficiency result.

A manually authored example summary can teach the rubric if labeled as a teaching artifact. It cannot be counted as an output of the deployed AI workflow. Likewise, a local mock can test status transitions and review protection without measuring generation quality or provider latency. The report should separate software correctness evidence from human-study evidence so readers can see what remains unknown.

## A transparent analysis plan

For paired tasks, report the relevant paired differences and the number of completed pairs rather than comparing unrelated totals. Describe the summary statistics and uncertainty method selected for the sample. Avoid implying statistical certainty from a tiny convenience sample. Qualitative comments can explain friction and trust, but they should not be converted into invented numeric benefit. Keep survey responses, interview observations and task timings as distinct evidence types.

An independent exercise asks you to evaluate this claim: “The model returned in five seconds, so doctors save five minutes.” The missing elements include the manual baseline, assisted review time, note quality, participant sample, case comparability and actual measured difference. The provider response time is one component of the assisted workflow. It cannot supply the absent human outcome by arithmetic or enthusiasm.

The completed study should leave a reproducible protocol, de-identified task data, rubric decisions, deviations and a bounded conclusion. A result that finds no clear time saving can still be valuable if it identifies review burden or evidence-quality problems. The thesis passes through honest method and defensible interpretation, not through guaranteeing that every optional feature improves every outcome.

## Source trail

Read docs/testing/survey-and-interview-protocol.md and the performance
assessment. No reviewer results are invented in this book; proposed task
examples must remain labelled as exercises until actual data is collected.


# 51. Test design: positive controls, negative controls and mutation checks

## The LiveKit boundary to trace

A test suite is an argument about selected behaviors under selected conditions.
Its value depends on the counterexamples it can distinguish. One hundred
assertions around the same easy fixture may cover less than a small set of
carefully chosen identity, lifecycle and concurrency cases. Count tests for
traceability, not as a universal security score.

The maintained suite combines pure policies, real TypeScript modules under
synthetic IO adapters, source wiring contracts, emulator rules and browser
regressions. Each technique has a different scope. Source checks can pin one
validation path but cannot prove live network behavior. Browser fixtures can
exercise interaction while mocking the waiting API, so their pass is not
proof that Firebase and LiveKit communicated successfully.

## A worked review

Pick a repaired invariant and remove it locally as a controlled mutation.
For example, remove the signed UID binding from the direct issuance path or
the ownership comparison from stale timer cleanup. The focused regression
should fail for the intended reason. Restore the source, run the full gate,
and record the candidate's exact hashes. Do not leave the mutation in a
shared branch or present it as a production test.

Test fixtures need enough structure to reach the risky branch. An incomplete
finalization fixture may trigger an early insufficient-evidence return and
never exercise a projection overwrite. Read coverage causally: did the
assertion observe the operation that contained the defect?

## Exercise with answer

A new test passes before the repair. Is it useless? It may protect another
behavior, but it has not reproduced the claimed defect. Adjust the fixture
or expectation until it distinguishes the unsafe implementation, or revise
the finding if the alleged bug cannot be established. Do not force failure
with unrelated syntax errors merely to produce a red phase.

Why retain positive controls after hardening? They expose overbroad denials.
The doctor's valid admission, the owner's permitted read and the current
session's legitimate completion must still work. A secure thesis prototype
must remain usable for its defined purpose; eliminating every action is not
a successful design.

## Foundational systems reading - adapted companion material

These adapted verification readings connect source history, counterexamples and test-environment validity. Treat their generic exercises as proposed work. A historical test's intention is evidence to inspect, not a new passing run.

## Supplied systems reference - page 84

git blame associates lines with commits under a chosen history traversal. It does not identify guilt or establish the full origin of an idea. A formatting commit can become the displayed line's latest change. git log, pickaxe searches, and historical file reads help reconstruct the contract behind the line.

Keep a short evidence chain in your notes: command, commit, relevant function, regression scenario, and observed or intended result. It allows you to revisit the reasoning when the application changes again.

## Supplied systems reference - page 85

Why inspect tests near a historical fix? They give concrete counterexamples and expected behavior that a patch alone may leave ambiguous. They are still claims to execute in the appropriate environment, not proof that every case is covered.

History topology also matters. A merge can introduce a combination that fails even if each side works alone. The reported boundary needs interpretation in the graph and examination of the diff. The search does not establish that one author or one line caused every symptom.

## Supplied systems reference - page 86

Why should a test-environment failure often be skipped? It does not answer whether the target behavior is good or bad. Classifying it as bad injects unrelated evidence into the search.

When useful detached commits appear in a reflog, create a branch pointing to the selected commit after inspecting it. This preserves a durable reference without immediately discarding the current working state. A command such as git branch recovered-study COMMIT creates the name; it does not apply every file in that commit to your working tree.

For unfinished edits, a patch can preserve tracked differences: git diff > saved.patch and git diff --cached > staged.patch. Those patches omit ordinary untracked file contents and may need binary options for binary changes. A separate copy of important untracked files or a deliberate stash can complement them. A recovery plan should state what it captures and what it omits.

## Supplied systems reference - page 87

Why can a tracked patch plus an empty status still be insufficient as a backup? Ignored media, secrets, untracked fixtures, databases, and external state may never be included in either observation.

A useful change description states the concrete trigger, resulting behavior and relevant verification. It should let a reviewer understand the contract without replaying the author's conversation. Code style alone cannot communicate why an operation must preserve an existing decision or why a query requires a particular scope.

## Supplied systems reference - page 88

A strong review also asks whether other writers can bypass the contract. Search views, tasks, imports, management commands, and model updates. The final change may need a smaller or larger scope than the first hypothesis. Rewrite the description around the resulting implementation, leaving conversational chronology out unless an abandoned approach explains a remaining tradeoff.

Test counts and confident prose cannot substitute for a counterexample that would fail under the old implementation. Conversely, a passing regression establishes its scenario, not an unlimited theorem about the application.

Keep the explanation and the exact commit identifiers in your notes. Later, if another change alters the service, you can compare contracts rather than relying on memory of a PR title.

## Supplied systems reference - page 96

Passing tests are finite observations. Their value depends on coverage of the important contracts and realistic execution conditions. Database concurrency requires separate connections and the intended engine; a TestCase wrapper or SQLite substitute can conceal a locking mistake.

## Supplied systems reference - page 97

"The checker passes" and "the input is valid" are different claims. Treat type errors as evidence to investigate, not universal proof of a runtime defect or an obstacle to suppress automatically.

## Source trail

Read the maintained tests and dated red-phase records. Reproducing a known
failure locally is different from exhaustive fuzzing, external penetration
testing or authenticated production acceptance.


# 52. Read CI, package inventories and runtime compatibility separately

## The LiveKit boundary to trace

The quality workflow has distinct application, dependency-audit and Functions
jobs. A dependency advisory should remain visible without concealing whether
policy tests, lint and build passed. A failed deployment for an unrelated
project should not be mistaken for the intended frontend's outcome. Read the
job or status context and the failed step before interpreting the red mark.

Package inventories are time-bound observations. The earlier full application
audit reported development-tooling findings associated with picomatch; later
scans returned zero without a corresponding application-code repair. The
correct report preserves both dates and avoids inventing a causal explanation
that the evidence does not establish.

## A worked investigation

Inspect the lockfile, declared engine and actual executable. Run the relevant
audit and retain its structured result, including whether development
dependencies were included. A production-only zero result is not the same
claim as a full-tree zero result. Then run a runtime startup regression when
the incident concerns module loading rather than only compilation.

The Firebase/jose incident illustrates why these checks complement each other.
An inventory can have no known advisories while an import still fails under
the hosted runtime. A successful build can coexist with that failure. The
narrow compatibility override and startup test address a loading contract,
not an assertion that every dependency is forever safe.

## Exercise with answer

CI proposes a major-version downgrade to remove an advisory. Should the team
apply it automatically before a defense? No. Review compatibility, actual
affected dependency paths and the availability of a narrow supported repair.
Record unresolved risk rather than breaking the application to obtain a
green badge. Never hide a failing audit by weakening its threshold silently.

A hosted deployment refuses the commit author because of team access. Is
changing repository visibility or buying a plan an ordinary code fix? No.
Those are account, privacy or billing decisions requiring separate authority.
The investigator can identify the cause and use an authorized publication
workflow without silently expanding access.

## Source trail

Read .github/workflows/quality.yml, package.json and the dated audit JSONs.
Dependency security, source correctness, runtime compatibility and deployment
authorization remain four distinct evidence categories.


# 53. Coordinate application, rule and index releases

## The LiveKit boundary to trace

A release can span several independently deployed artifacts. Next.js source,
Firestore rules, indexes, TTL configuration and Functions do not become
current merely because one commit is merged. The release plan must identify
which artifacts changed, their compatibility order and the observations
needed to confirm each resulting state.

The consultation-integrity repair required both application behavior and
client-rule restrictions. Publishing only the rules would leave unsafe
server reassignment paths in old application code; publishing only the
application would leave direct client writes open. Coordination means
understanding these windows, not issuing a broad deploy command and hoping
every service happens to update.

## A worked release review

List the exact changed artifacts and preserve rollback references. Confirm
the project and team before any production write. Deploy only the approved
scope, then retrieve active rule source or deployment metadata as appropriate.
Run safe denial probes and a synthetic authenticated journey. The sources
and observations should name immutable commits or hashes.

If direct metadata access is blocked, record that limitation. A GitHub
deployment status can provide indirect evidence but does not prove the
exact live rules or successful consultation. Do not access an unrelated
account or change team permissions merely to erase the blocked label.

## Exercise with answer

A deploy command says complete but retrieved source differs. Which result
should drive acceptance? Investigate the actual target, release binding and
retrieval method. The command outcome and active state disagree; neither
should be edited out of the record. Acceptance remains pending until the
discrepancy is explained and the intended state is verified.

Why not roll back everything automatically when one artifact fails? An
uncoordinated rollback can create a worse compatibility combination or
reopen an authorization defect. Use a prepared decision with known backward
compatibility and explicit authority. Rollback is a release operation, not
an emotional reaction to a red dashboard.

## Foundational systems reading - adapted companion material

These adapted delivery readings distinguish source, artifacts, running processes and compatibility windows. Container and relational examples are comparative tools; the LiveKit release must still identify its own application, rules and index artifacts separately.

## Supplied systems reference - page 82

Runtime state also affects the experiment. A database migration may be required. A cached module may still be loaded. An old worker can keep executing the pre-merge code. A local secret or network service can alter execution. Record which checks run against which source and resource identities.

When finished, intentionally keep the merge as a commit or abandon it with the appropriate operation. If the purpose was temporary testing, an isolated worktree reduces interruption to your main directory. It does not remove the need to account for generated files or database changes produced by the tests.

"No commit" refers to Git history creation. It does not mean no files were changed, no database operations occurred, or no test fixtures were written. A test can have effects outside the repository even when no new source commit exists.

## Supplied systems reference - page 83

Choose the relationship before the Git command. To ask what changed between two snapshots, compare their trees directly. To ask what an unmerged branch contributes relative to its integration branch, a merge-base comparison can be suitable. To ask which commits a local branch has not received, use an appropriate reachability query. These are different questions even when their output sometimes looks similar.

Renames and line matching are additional presentation decisions. Git stores trees; rename detection in diffs is an inference based on similarity and options. A moved function may appear as deleted and added or as a rename, without changing the underlying object model. Use context and file history when you need intent beyond the displayed patch.

A small diff is not necessarily a small behavioral change. Changing a default, an ordering key, a transaction boundary, or a predicate can affect many records through unchanged call sites.

## Supplied systems reference - page 151

Two Compose projects have different names but both publish 127.0.0.1:8000. Can both claim it? Normally no. Choose distinct host ports or an intentional routing arrangement.

Reproducibility has several meanings. Repeating a dependency resolution can choose equivalent versions without producing identical bytes. Repeating a build can produce identical bytes but still embed the wrong configuration. Deploying the same artifact can produce different behavior against different schemas or data. Say which property you need, then capture the inputs and evidence that establish it.

A lockfile records a dependency selection according to a particular tool's format. It does not freeze the interpreter, operating system packages, build tools, environment, or every remote input automatically. Python dependency constraints, fully pinned requirements, hash checking, and wheel selection offer different guarantees. A pip freeze snapshot describes installed distributions; it is not by itself a complete cross-platform build recipe.

## Supplied systems reference - page 152

Deploy the built artifact you tested rather than rebuilding an allegedly equivalent artifact during every stage. This reduces uncontrolled differences, although runtime configuration and external systems still require verification. A checksum proves bytes match; it does not prove provenance, absence of defects, or compatibility.

A migration changes the database's structure or data expectations. A code deployment changes the processes interpreting that structure. These changes need not happen at one instant, particularly when old web workers and task workers continue running during replacement. A migration can succeed while an old process immediately fails on the new schema. Therefore "migration applied" and "release compatible" are different claims.

An expand-and-contract approach creates an overlap period. First add a compatible structure, then deploy code that can use it, backfill or dual-write according to a defined policy, verify completeness, and later remove obsolete structure when no active reader needs it. The exact sequence depends on the database, application behavior, and rollout strategy; the phrase is not a universal recipe that makes every schema change safe.

## Supplied systems reference - page 153

A backup is only useful if its consistency, restoration procedure, and restored application's behavior have been verified. A volume containing the database is its storage, not an independent backup.

An additive column migration passes locally. Does that prove a large production table can migrate without disruptive locks? No. Test and analyze the actual backend and workload separately.

## Supplied systems reference - page 154

Source files, built artifacts and process-loaded code can disagree without Git being broken. Pulling new files does not necessarily reload imported Python modules, and rebuilding an image does not replace an existing container. A release check must reach the processes actually serving requests and consuming tasks.

Embed trustworthy build identity in the artifact and expose it through controlled logs or a diagnostic endpoint. Compare that identity across web replicas and task workers. An environment variable containing a claimed commit is weaker evidence if deployment can set it independently of the artifact. A single successful request can hit one replica while another remains old, so verification needs coverage of the relevant population or rollout control plane.

## Source trail

Read the rules-release scripts, firebase.json and the dated defense report.
The latter's pending room-rule publication is a concrete example of why
repository fixes and deployed acceptance must be narrated separately.


# 54. Quota incidents, read budgets and operational recovery

## The LiveKit boundary to trace

An exhausted database quota can make several unrelated screens fail together.
That does not mean each screen independently contains a new bug. Shared
dependency failure should become a clear, bounded service response without
weakening authorization or pretending an empty result was successfully read.
The common availability classifier recognizes known quota, deadline and
service-unavailable representations.

Read budgets are architectural. Polling every mounted panel independently,
reading historical rows into live listeners and refreshing hidden tabs can
spend work unrelated to the user's immediate task. Shared requests, live-status
queries and visibility-aware timers reduce that amplification, but actual
provider usage still needs measurement.

## A worked incident review

Start with the observed failures and match their times to approved provider
or server evidence. Distinguish known resource-exhausted status from a generic
500, a permission denial or a parser error. Then inspect the workload that
continued during the incident. Do not recover by removing role checks or
serving another user's cached data.

After recovery, run a valid synthetic operation and verify feedback clears.
An outage can leave a client in a stale error or pending state even after the
database becomes available. Operational recovery includes both restored
dependency access and a comprehensible route back through the interface.

## Exercise with answer

The quota resets and the application works. Was the read-cost bug repaired?
No. Resetting availability removes the immediate symptom. The workload may
exhaust the next window again. Measure request sources and query behavior,
then test a focused architectural improvement. Avoid claiming a percentage
saving from a local timer-count test alone.

Should the project upgrade billing immediately? That is a cost and capacity
decision for the owner, informed by measured workload and expected use. The
engineer can explain options and limits without silently changing a plan.
A thesis prototype should keep its free-tier constraints visible in both
test design and deployment guidance.

## Source trail

Read lib/services/shared/database-availability.ts,
docs/cost-control-and-migration.md and the quota incident reports. Provider
limits can change; verify current account terms before operational planning
rather than treating an old study snapshot as a permanent entitlement.


# 55. Rollback, retention, backups and prototype readiness

## The LiveKit boundary to trace

A secure endpoint is not a complete operational security program. Retention,
backup restoration, incident response, access provisioning and deletion
verification require policies and configurations beyond route code. The
production-readiness guide explicitly distinguishes implemented controls
from governance and certification decisions.

Retention must account for data classes separately: temporary audio,
transcript evidence, summaries, chat, waiting rows, invitation signals, audit
events and provider-managed logs or backups. A scheduled summary cleanup does
not automatically delete every derivative or backup. A UI promise should be
checked against the approved and enabled enforcement path.

## A worked operations review

Choose a synthetic retention record in isolated staging. Verify the policy
window, worker authorization, eligible-record selection, deletion outcome and
the subsequent read. Do not enable production cleanup to discover how it
works. Preserve rollback and recovery considerations before any operation
that makes data difficult to restore.

For backups, distinguish an export existing from a restoration procedure
being tested. A copy can be incomplete, encrypted under unavailable keys or
incompatible with the expected recovery path. Record the tested restore
scope, timing and integrity checks. Avoid claiming disaster recovery from
the mere presence of a download link.

## Exercise with answer

A panel asks whether the prototype is HIPAA compliant. What can the engineering
team responsibly say? Describe the implemented safeguards and their evidence,
then state that compliance requires contracts, risk assessment, operations,
training, retention governance and independent review. A repository or test
count does not certify a medical service.

Why preserve a failed baseline in the study package? It demonstrates what
changed and prevents the current pass from erasing known risk history.
Preservation should not include real clinical content or leaked credentials.
The useful durable artifact is the bounded observation, source state and
reproduction method, not every sensitive byte captured during the incident.

## Foundational systems reading - adapted companion material

These adapted recovery readings emphasize observable checkpoints and tested restoration. Apply them only in an authorized isolated environment. They do not establish that the prototype already has a complete disaster-recovery program.

## Supplied systems reference - page 160

Recovery needs equally concrete evidence. A backup file's existence proves little until you restore it to an isolated destination and check meaningful data through the intended access path. A restore drill should measure elapsed time, document required credentials and tooling without exposing secrets, and identify which changes after the backup would be lost. Code rollback and data restoration solve different failures.

## Supplied systems reference - page 162

The finished runbook should be executable by another developer without guessing which process to replace or which storage to restore. It succeeds when every checkpoint has concrete evidence, every recovery action identifies its scope, and one unresolved assumption is paired with a narrow experiment that could settle it before a real release.

## Source trail

Read docs/production-readiness.md, docs/cost-control-and-migration.md and
docs/testing/verification-status.md. The remaining capstones require you to
apply these distinctions independently rather than memorize a claim that
the whole application is simply ready.


# 56. Capstone: an allowlisted patient is still waiting

## The case and the safety boundary

A fictional clinician creates an invitation for a synthetic patient account. The invitation preview says that one verified account can enter directly. The patient opens the link in a private browser window, sees the waiting page, signs in, and still appears to wait. A teammate concludes that the allowlist is broken. Your task is to investigate that conclusion without weakening admission. Do not solve this exercise by admitting every visitor who types the allowlisted address. That would replace an inconvenient symptom with an identity vulnerability.

The case has several plausible explanations. The browser might hold an anonymous Firebase identity. The account might be signed in but lack a provider-verified email. The signed-in email might differ from the invitation entry after normalization. The invitation might have expired or been revoked. The browser might be rendering a response from the earlier anonymous attempt. A request might be failing before the admission decision is reached. Finally, the system may have correctly admitted the patient while the visible component still shows its earlier state. These explanations predict different observations. Treat them as alternatives, not as an unordered checklist of things to change.

Use local emulators and synthetic fixtures for the worked experiment. A production invitation supplied by a user is not a general license to mint repeated tokens, consume uses, or collect its bearer secret in a report. If a live observation is separately authorized, prefer a bounded status observation and masked metadata. The study book itself neither performs nor authorizes that live experiment.

## Build an evidence ladder

Begin with the smallest statement the screen supports: this browser is displaying a waiting state. It does not yet establish that the server denied a verified account, that the invitation is valid, or that the owning clinician has no queue row. Record the browser profile, source revision, environment, synthetic run label and time. Do not record the complete invitation URL or an authentication header. Keep the time zone explicit so the invitation expiry and browser clock can be compared coherently.

Next inspect the relevant application request in Network. Identify the actual endpoint, method, status, response type and request initiator. A JSON response saying that the visitor is waiting is substantially different from a framework HTML error page. If the response is HTML with a server error, stop reasoning as though a normal admission policy decision occurred. Follow the matching server failure and its runtime boundary instead. A client parsing exception is a secondary symptom when the upstream contract was not delivered.

For a valid JSON decision, inspect claim shape through a safe diagnostic projection. You need to know whether the principal is anonymous, whether the provider says the email is verified, and whether the verified normalized address matches the persisted invitation policy. You do not need to publish the address itself. A report can state that verification was false or that the normalized values differed. Never infer verification merely because a display name, profile document or login button is present.

Then establish that the persisted invitation is the one referenced by the signed capability. Validate the signature through the normal server path; decoding a token locally is not verification. Check the invitation identifier, room binding, status, expiry and use policy in the fixture. A convenient display of the room name does not prove those constraints. If the identifier and room disagree, the expected result is rejection, not a fallback to whichever room happens to exist.

## The controlled fixture sequence

Create one reusable synthetic invitation with a future expiry, an owning clinician and one verified allowlist address. Give the waiting queue enough capacity for the planned cases. In the first case, redeem without a signed-in non-anonymous account. Expect a waiting-scoped result, not direct consultation access. Verify the token grants through a local decoded test assertion, without placing the raw token in saved evidence. The waiting token must not provide the consultation room's publish, subscribe or data rights.

In the second case, present a valid Firebase test identity whose email equals the allowlist but whose verification claim is false. Expect waiting rather than direct admission. This is an important negative control because it distinguishes an email comparison from an identity-qualified admission decision. In the third case, use a non-anonymous verified identity with a different address. Again expect waiting. In the fourth, use the intended verified allowlisted identity and expect the direct path, provided every other invitation condition remains satisfied.

Repeat the fourth case with an expired fixture, then a revoked fixture, then a room-binding mismatch. Those changes must remove access even though the account is still the intended person. The contract is a conjunction of constraints. A verified allowlist match is not an override for revocation or expiry. Keep the fixtures independent so a failed case cannot contaminate the next by consuming a one-use invitation or filling the queue.

Now test the browser transition. Hold the anonymous response artificially, complete a signed-in request, and release the old response last. The authenticated state must not be replaced by obsolete anonymous state. This experiment tests client response lifetime, not server admission. Label it separately. A request-generation guard or cleanup can make stale results inert, but the implementation must also stop obsolete polling and subscriptions; suppressing one render does not prove resource cleanup.

## What the observations mean

Suppose all server cases pass but the delayed anonymous response recreates the waiting screen. The finding is a client race with a concrete schedule: request A starts anonymously, request B starts after authentication, B succeeds, then A overwrites B. The narrow repair preserves the server boundary and binds asynchronous work to the identity or generation that created it. A regression should force that ordering rather than hope that a fast laptop reproduces it by chance.

Suppose the verified test identity enters directly, but the real browser's safe claim projection says anonymous. The next question concerns the login transition and request credential attachment. Rewriting invitation storage would not address that evidence. Check whether the request starts before authentication settles, whether the current account's ID token is obtained, and whether the request uses the authenticated server helper. Do not copy a token manually from another tab as a permanent repair; that obscures the actual ownership and renewal path.

Suppose the request receives a retryable service error because the database quota is exhausted. The correct interface should distinguish temporary unavailability from waiting for admission. Returning an empty queue or a success-shaped waiting response would make a service outage look like a normal clinical workflow. Preserve a bounded retry policy, useful modeless feedback and the patient's ability to understand what remains incomplete. Retrying every render is not recovery; it can increase the load on the failing dependency.

## A worked answer for the clinician

A useful explanation might read: “The synthetic verified-account admission cases passed against the pinned local server implementation. The browser reproduction showed an obsolete anonymous response updating the waiting component after sign-in. The proposed client correction ignores results from the replaced identity and cancels its polling lifetime. Production release and an authorized end-to-end confirmation remain separate steps.” Each sentence states a different kind of evidence. None claims that a local fixture proves the deployed app is repaired.

An unhelpful explanation would be: “Google login is unreliable, so we removed waiting checks.” It names a provider without discriminating evidence and abandons the security requirement. Another unhelpful explanation is that an account has “the right email” without saying who asserted it. The clinician's legitimate goal is timely access for the intended patient, not a bypass of proof. Strong design makes that distinction understandable while keeping the decision on the server.

## Independent exercise and answer

You see a verified allowlist match and a waiting response. What is the next decisive observation? Establish that the response belongs to the same authenticated request and persisted invitation, then inspect the remaining conditions. A screenshot of account settings is not enough. The response could be stale, the invitation could be revoked, or the request could carry credentials from another account. Correlation must be exact without exposing secrets.

What must the final test record contain? Include fixture identities as labels, source baseline, executed cases, positive and negative outcomes, response-generation ordering, and limitations. Include the expected denial for an unverified match. Exclude raw bearer capabilities, real emails, access tokens and unrelated network requests. A concise reproducible record is more defensible than an enormous unredacted capture.

The capstone is complete when another student can reproduce the distinction between server policy and client presentation, explain why direct admission requires verified identity, and propose a repair whose scope matches the evidence. It is not complete merely because the waiting screen disappears. That visual outcome could also be produced by a dangerously permissive token issuer.

## Source trail

Trace docs/invitation-access-model.md, docs/invitation-flow-design.md,
docs/access-control.md, lib/services/invitation-access/invitation-access-core.ts
and the invitation/waiting-room
API routes at the pinned baseline. Endpoint details should be followed in the
repository rather than inferred from this fictional scenario. The experiments
in this chapter are instructions and worked interpretations, not newly executed
production results.


# 57. Capstone: history appears under the wrong person

## The case and its competing explanations

Two fictional students share a test computer. One finishes a synthetic consultation and signs out. The other signs in and sees a history card that looks familiar. The report says that the application “gave one patient's records to another.” That is a serious possibility, but the first investigation must distinguish several mechanisms. The browser may retain a stale projection. The server may query by a mutable email rather than stable account identity. A guest record may have been adopted through a legacy linking path. Two cards may simply share a room title while representing different encounters. A supplied screenshot proves appearance, not the ownership mechanism.

Begin by protecting information, not by collecting more of it. Do not paste the card's names, messages or summaries into an issue. Use synthetic fixtures to recreate the relationship. Record whether the unexpected card contains only a title or actual content from another account. If real disclosure is suspected, follow the project's incident process and restrict further inspection to authorized responders. A student investigation should not browse additional records to estimate the scale casually.

The central invariant is that account-owned history is selected by the authenticated stable identity under the server's policy. A room name is a label and a media routing key, not a patient identifier. A display name is mutable. An email can change and may not be provider verified. A guest room identity proves possession of a scoped session capability, not ownership of every later account that resembles its name. Keep these identities separate throughout the experiment.

## Construct an ownership matrix

Create synthetic accounts Cedar and Maple, one owning clinician, two invitations and three encounter records. One encounter belongs to Cedar, one to Maple, and one is an anonymous guest visit with no account ownership. Give two encounters the same room label deliberately. This makes a weak implementation reveal whether it confuses the room with the visit. Use fictional content that is easy to distinguish, such as a test marker, rather than clinical prose.

Request Cedar's history through the authenticated route and expect only Cedar's owned record, subject to the intended projection. Request Maple's and expect only Maple's. Request without credentials and expect denial. Try a request parameter claiming Cedar's account while authenticated as Maple. The server must not trust that parameter as the principal. If the endpoint accepts a selection parameter at all, authorization must constrain its meaning to the verified caller or an explicitly authorized clinician scope.

Attempt to link the guest encounter merely by presenting a matching email, room label or pending browser session identifier. At the baseline described in this book, the legacy linking endpoint is an authenticated acknowledgement rather than a mechanism for reassignment. Verify that durable ownership does not change. A success-shaped acknowledgement should not be misread as a transfer having happened. Inspect the persistence effect, not only the response's wording.

Now vary account profile fields without changing the stable UID. The selected history should not migrate to another person when a display name changes. Then use two different UIDs whose synthetic profile text is identical. Their histories must remain separate. This pair of tests separates identity from presentation: one identity with changed text, and two identities with matching text. A single happy-path account cannot reveal the distinction.

## Test the browser handover separately

The server can be correct while the browser briefly exposes stale state. Simulate a slow Cedar history request. Sign out, sign in as Maple, and let Maple's request finish before Cedar's delayed response. The old result must not populate Maple's view. Clear or replace the old projection at the identity boundary, and bind each asynchronous response to the request generation and authenticated principal that authorized it.

Inspect caches and subscriptions using labels, not tokens. A cache key containing only “consultations” is suspicious when its value depends on identity. A cache keyed by UID is better, but the component must still stop observing the old key after sign-out. An unsubscribe function existing in source does not prove that it runs. Force the transition and verify that obsolete updates become inert. Also verify that the new account's allowed history remains usable; clearing everything forever would pass a privacy check while breaking the product.

Refresh the page with network available and compare the server response to the rendered cards. If the response contains only Maple's record but the UI shows Cedar's marker, investigate client projection lifetime. If the response itself includes Cedar's record, follow the server query and authorization predicate. If both return the correct distinct records but the titles match, improve interpretation or labeling rather than inventing a security incident. Similar presentation and shared ownership are different claims.

## Encounter isolation and late events

Ownership is not the only boundary. Reusing a room label across visits can connect the wrong lifecycle event to the right person. Create an older encounter and a newer encounter under the same room name. Deliver the older connection's leave event after the newer encounter starts. The event must not finalize or rewrite the newer encounter merely because its room matches. The handler needs the exact encounter binding and the relevant participant relationship.

Likewise, a duplicate-identity media join can replace an old browser connection without ending the shared visit. The older page should detach its local resources and avoid sending a misleading shared finalization command. Test a replacement schedule explicitly: connection A is active, connection B replaces it under the same permitted identity, A receives a disconnect event, and B continues. The durable encounter should reflect the intended continuing visit, not the lifetime of A's page.

These tests belong together because history is the visible result of earlier identity and lifecycle decisions. A correct history query cannot repair an encounter that was assigned incorrectly when created. Conversely, perfectly assigned records can still leak through a broad query. Follow the whole write-and-read path, but keep each finding narrow enough to reproduce independently. One “history bug” label should not hide three distinct defects.

## Design alternatives and their tradeoffs

One tempting design stores every presentation field and trusts it later as ownership evidence. That is convenient for rendering but makes mutable text an authority. Another design stores stable account and encounter references, then derives the display projection. This introduces explicit joins or lookups, but it hides identity rules in a narrow server boundary. The repository favors stable identity and session binding; preserve that direction rather than adding another email-based rescue path.

Legacy records complicate the choice. Do not silently claim them for a newly signed-in account because their email looks familiar. Preserve an honest unowned or unresolved state until an approved reconciliation policy establishes authority. A migration would need a read-only aggregate audit, backup, dry-run counts, idempotency, rollback and explicit approval. The writing task authorizes none of those production mutations. A conservative projection may be less convenient, but convenience is not proof of ownership.

## Independent exercise and worked answer

A teammate proposes adding the current UID to every old row whose email matches the logged-in profile. Why is that unsafe? The matching text may be unverified, reused, stale or self-declared. The operation also turns a read workflow into a broad mutation and may destroy the evidence needed to investigate the original assignment. A proper reconciliation must have stronger authority and a documented scope, not a browser-side heuristic.

Another teammate says that hiding the unexpected card fixes the issue. What remains to prove? The server must deny the same cross-account access directly, and the durable record must retain correct ownership. Test the API without relying on UI navigation. Then test the browser handover to ensure that old results do not appear under a new principal. Hiding a card can be a presentation correction, but it is not the server security boundary.

The final report should state whether the failure was server selection, original assignment, client stale state, lifecycle binding or simply ambiguous labeling. Preserve a minimal synthetic reproduction and positive controls for the intended owner and clinician. Report the source revision and environment. Do not describe a local denial matrix as a deployed incident resolution until the correct artifact has been released and separately verified.

## Source trail

Read docs/identity-and-record-integrity.md, docs/access-control.md and
docs/data-model-readiness.md. Trace app/api/link-patient-consultations/route.ts,
the consultation history route, session creation and late-leave handlers at the
pinned baseline. Synthetic account labels and incident sequences in this chapter
are teaching fixtures, not descriptions of actual patients.


# 58. Capstone: a long-lived doctor tab spends reads overnight

## The report is a clue, not a diagnosis

A fictional test team leaves several clinician tabs open after a demonstration. The next morning the database quota is exhausted. Someone blames Firestore listeners; someone else proposes a larger plan. Neither conclusion follows from the symptom alone. Reads may come from periodic HTTP polling, realtime listeners, initial query snapshots, multiple consumers, retries after failure, or unrelated activity. The application may be using an inefficient query even if each tab issues only one request per interval. The next step is to construct an accounting model and then discriminate its terms with isolated measurements.

Do not recreate the incident by leaving production tabs running overnight. That spends real quota and interferes with legitimate use. Work with synthetic staging or an in-process test harness whose dependencies count calls. Set an explicit request budget and stop condition. Distinguish a source-level scheduling test from a billed database experiment. A fake repository can prove that a hidden tab does not initiate refresh work, but it cannot prove the exact number of billable reads that Firestore will charge for a production query.

Start with a timeline: the demonstration begins, tabs mount, invitations are created, patients enter, tabs become hidden, a network failure occurs, and retries begin. Record only operational labels. A count of open windows is not a count of mounted consumers. A page can contain several components that want the same queue projection. Development Strict Mode can also exercise setup and cleanup differently from a production build. Identify the actual run mode before interpreting duplicate work.

## Build the budget before the experiment

For a simple periodic model, requests equal active consumers multiplied by the number of refresh intervals, plus initial loads and event-triggered refreshes. If each request reads a growing archive, database reads can grow much faster than request count. Thus there are at least two separate levers: how often the application asks, and how expensive each answer is. A lower polling rate does not rescue a query that repeatedly scans every expired invitation.

Use a fictional example to expose the arithmetic. Six independent consumers refreshing every fifteen seconds produce twenty-four periodic requests per minute before initial requests, retries or realtime invalidations. Over an hour that is one thousand four hundred forty requests. If a shared service consolidates those consumers into one active refresh lifetime, the periodic request count can fall to two hundred forty for the same hour. These numbers are a model, not measurements of this repository or a prediction of billing.

Then consider visibility. A consumer whose page is hidden need not keep the clinician's visible queue fresh every fifteen seconds. Pausing background polling can save work, while a refresh on return restores currency. But simply pausing a timer is incomplete if an old in-flight response or listener can still trigger follow-up work. Resource lifetime includes timers, event handlers, subscriptions, pending requests and the state that accepts their results. The test must cover those interactions.

## A deterministic lifecycle laboratory

Use a fake clock and counted fetch function. Mount one queue consumer and assert the expected initial request. Advance one interval and assert one refresh. Mount a second consumer for the same scope; verify whether the intended shared service reuses the existing lifetime rather than starting another independent interval. Unmount the first consumer and verify that the second still receives updates. Unmount the last consumer and assert that scheduled work stops.

Now hide the page and advance several intervals. Count requests, not just rendered rows. Show the page and expect the documented refresh behavior. Repeat hide and show rapidly to expose duplicate event registration. A useful stress case performs many mount, hide, show and cleanup cycles, then checks that one active consumer still causes only the intended request rate. Do not claim success merely because the last screen looks correct; leaked timers often preserve a normal appearance while multiplying background work.

Force an in-flight request to finish after its consumer has unsubscribed. Its result must not update a replacement identity or restart a stopped polling lifetime. Then mount a new consumer before the old request resolves. This schedule tests whether a stale cleanup callback accidentally tears down the new subscription. Identity guards matter because cleanup belongs to the resource instance that created it, not to every future resource stored under the same variable name.

Test failure behavior separately. Return a retryable service error, then keep the dependency unavailable. Verify that retries remain bounded and respect the intended delay rather than causing an immediate loop. Return an authorization denial and verify that it is not disguised as transient capacity failure. A client that retries a denied request indefinitely is both confusing and wasteful. A client that turns every unavailable response into an empty queue is quieter but dishonest.

## Query scope and realtime semantics

Inspect the server query after scheduling is understood. The doctor should receive the authorized active projection relevant to the requested room or invitation scope. Realtime events are invalidation hints, not permission to bypass that projection and render an unfiltered collection. If an event says something changed, re-query through the authenticated server boundary. This design can produce an extra refresh, so consolidate simultaneous invalidations and document why a periodic expiry refresh still exists.

Expiry introduces a subtle case: time can change a row's eligibility without a database write. A listener alone may not notify the application when an invitation becomes expired. A modest periodic reconciliation or a scheduled next-expiry refresh can address that semantic gap. Removing every timer to minimize reads may make expired rows remain visibly active. Optimize against the product contract, not a single counter. The desired outcome is correct fresh-enough state within a bounded resource budget.

Check query limits and indexes using synthetic shapes. A limit on returned rows does not automatically mean every possible backend cost is bounded in the same way. Read the current Firestore documentation and the query's actual plan or supported diagnostics before making a billing claim. In a thesis report, state the observed query pattern and measured request/read scope. Avoid a universal guarantee that a certain endpoint always costs exactly one read.

## Interpreting before-and-after results

A useful result separates unit evidence from deployment evidence. For example: “The deterministic lifecycle suite showed no periodic requests while hidden, one shared active schedule for two consumers, and no restart after final cleanup. A staging run then observed the expected bounded HTTP request rate over the declared interval.” That statement does not claim that production quota incidents are impossible. It also does not convert a request count into media capacity.

If the revised application still exhausts quota, preserve the successful scheduling result and investigate the remaining terms. Perhaps there are many users, expensive reads, another worker, or a retry storm on a different route. A partial optimization can be real without being sufficient. Reverting every measured improvement because the global symptom persists would discard evidence. Conversely, declaring the whole incident solved after one unit test ignores system-level consumption.

## Exercise and worked answer

The request count falls by eighty percent, but response latency rises. Did performance improve? The answer depends on the declared goals and tradeoff. Fewer background requests may improve cost and availability while an overly long visible refresh interval makes the queue less responsive. Measure admission freshness separately from read budget. A clinician should not need to guess whether a waiting patient exists because the optimization hid the state too aggressively.

The console shows one listener, yet reads remain high. What should you inspect next? Count initial snapshots, query result size, reconnect behavior, HTTP refreshes and other consumers. The word “listener” is not a cost model. Likewise, one source-level interval can be instantiated multiple times by repeated mounts. Observe instances and effects rather than counting declarations in a file.

The capstone's final artifact is an accounting sheet, a deterministic reproduction and a bounded staging protocol. It should explain the visible freshness guarantee, hidden-page behavior, shared ownership and failure policy. Keep the actual production incident's unresolved terms visible. A design that is cheaper, clearer and correct under repeated lifecycles is defensible even when a separate capacity study remains unmeasured.

## Source trail

Read docs/testing/performance-assessment.md, docs/testing/verification-status.md
and the shared polling/realtime lifecycle tests at the pinned baseline. Inspect
the queue projection and useVisibilityPolling implementation. The arithmetic
and hypothetical counts above are teaching examples, not newly collected
Firestore billing data.


# 59. Capstone: the call connects but the thesis claim is unsupported

## Separate achievement from inference

A fictional defense rehearsal shows a clinician and patient connected in the browser. They exchange a greeting and a chat message. The slide says, “The system supports reliable low-latency consultations at scale and reduces clinician documentation time.” The demonstration is useful evidence of one successful interaction, but it does not establish all three claims. Your task is not to dismiss the demonstration. It is to preserve what it proves, identify the missing measurements, and design a feasible study without inventing a dataset.

Write the claims separately. Connection success asks whether the intended participants could join under the access policy. Media quality asks what happened to audio and video during a declared observation interval. Capacity asks how outcomes change as simultaneous load increases under specified conditions. Efficiency asks how long a real reviewer takes to produce acceptable documentation compared with a baseline. Each claim needs its own unit of observation, protocol and acceptance rule.

The existing thesis prototype has security and regression evidence, historical deployment observations and proposed performance protocols. This book does not promote those protocols into completed experiments. In particular, an HTTP request returning quickly is not a WebRTC media-latency measurement, and one connected pair is not a concurrent-call capacity study. A failed optional AI entitlement is not evidence that the core call is insecure, but it can prevent an efficiency experiment requiring generated drafts.

## Design the smallest meaningful media run

Use isolated staging, synthetic participants and a fixed software revision. Identify device models or relevant hardware classes, browser versions, network arrangement, media settings, region and time interval. Record the room and participant labels without publishing invitation secrets. Decide whether the run is a functional smoke check or a measurement session. A smoke check can establish that both intended endpoints exchanged media; a measurement session needs a stable collection method and predefined metrics.

For transport observations, select the actual LiveKit peer connection, not an unrelated ChatGPT or browser tab connection. Record selected candidate-pair RTT with its unit, inbound packet counters, jitter, received frame rate and relevant resolution information. Keep audio and video streams distinct. If a counter resets after reconnection, begin a new interval or mark the affected delta invalid. Do not smooth a negative delta into an apparently excellent result.

Suppose a fictional sample has a selected-pair RTT of zero point zero eight seconds. Convert it to eighty milliseconds and label it a round trip. Do not call it forty milliseconds of one-way audiovisual latency by dividing it in half. The forward and reverse paths may differ, and capture, encoding, buffering, decoding and rendering add their own delays. A glass-to-glass claim requires an appropriate synchronized observation method and its uncertainty, not an algebraic relabeling of RTT.

Choose a sampling interval and retain the raw numeric samples needed to reproduce calculations, with sensitive fields removed. A spreadsheet containing only one average is difficult to audit. Preserve run identifiers, valid sample counts, dropped intervals and reasons. State whether a summary statistic describes per-stream samples, per-call summaries or all pooled observations. Pooling can give a long run disproportionate influence if the experimental unit is supposed to be the call.

## Capacity is a controlled change in load

Capacity cannot be inferred from the number of historical encounter documents because those records may represent different times, reconnects or incomplete visits. Define simultaneous load operationally. Five doctor-patient pairs mean ten connected clients if each pair has exactly two clients. If observers or screen shares are present, document them. Fixed media settings make comparisons interpretable, though adaptive behavior should still be reported rather than hidden.

A modest proposed progression is one pair, then three pairs, then five pairs, with an explicit duration and resource budget at each level. This is a feasible thesis protocol, not a promised platform limit. Set stop conditions for participant disruption, quota pressure, provider refusal, excessive failures or a predetermined budget. Do not keep increasing load until production breaks. A safe study can report a tested range without claiming the maximum possible capacity.

Repeat runs when feasible and include unsuccessful starts. A chart containing only successfully connected calls underestimates failure. Record attempted pairs, completed joins, disconnects, recoveries and excluded runs with reasons. If one level is tested on a different network or browser version, treat that as a condition change rather than attributing every difference to load. Repetition cannot remove a confound that is perfectly aligned with the experimental condition.

## Documentation efficiency needs a human outcome

An AI route's response time is not clinician documentation time. The meaningful workflow includes producing a draft, reading it, correcting unsupported statements, adding necessary information and accepting the final note. A fast draft that requires extensive repair may save no time. A delayed draft may still help if review is much faster, but that is an empirical question. The study must include quality criteria so speed does not reward incomplete or unsafe notes.

Use synthetic cases and a participating clinician or appropriately qualified reviewer. Compare manual documentation with assisted documentation under a counterbalanced order when practical. Measure the same start and finish definitions for both conditions. Include review and editing time in the assisted condition. Keep the case evidence equivalent and avoid letting the reviewer memorize one case before repeating it in the other condition. Report the sample and recruitment limitations honestly.

If AI credits or provider entitlement are unavailable, do not fabricate generated outputs or quietly substitute a different tool and call it the same system. Mark the assisted condition blocked or not tested, and preserve the functional observation that calls can continue with optional transcription off. A manually prepared teaching example can illustrate the rubric, but it is not a measured product output. Labeling that difference protects the thesis from an avoidable validity problem.

## Write a defensible results paragraph

A careful rehearsal statement might say: “The demonstration established that one synthetic clinician-patient pair joined and exchanged media and chat under the tested configuration. Automated local tests covered the listed access and lifecycle invariants. Controlled media latency, simultaneous-call capacity and clinician documentation efficiency were not measured in this session. The following staging protocols define how those outcomes would be evaluated.” This preserves the achievement without overstating it.

If a later authorized study produces results, replace only the affected not-tested fields and link the dataset, revision and method. Do not erase earlier failed baselines. A source update, dependency audit or rule deployment changes a different evidence category. A living verification checklist should say which environment passed, when, against what revision and under what limits. The word “passed” without its object and scope is too vague for a technical defense.

## Exercise and worked answer

You have twelve successful calls from different days, each with a screenshot. Can you claim twelve-call concurrency? No. Concurrency requires overlapping active intervals under a common load condition. The screenshots may support historical use, not simultaneous capacity. Recovering timestamps may improve the observation, but it does not turn an uncontrolled history into the planned capacity experiment.

You have a mean API response time of two hundred milliseconds and a participant says the call felt delayed. Which evidence is wrong? Neither must be wrong. The API request and media path measure different systems. Investigate the actual media stream, device workload and network condition. Disagreement between measurements often reveals a boundary mismatch rather than a dishonest observer.

The capstone ends with a revised claim table and a safe execution plan, not with a manufactured pass. A strong defense explains both what the prototype has demonstrated and what remains unknown. Scientific restraint is an engineering capability: it prevents a convenient number from becoming a decision it cannot support.

## Source trail

Read docs/testing/performance-assessment.md, docs/testing/verification-status.md,
docs/thesis-defense-guide.md and docs/ai-summary-status.md. The W3C WebRTC
statistics definitions govern the meaning of transport fields. All sample
numbers in this chapter are fictional calculations, not production results.


# 60. Explain, defend and safely improve a new commit without AI

## A final practical examination

The purpose of this book is not to memorize file names or depend on an assistant to translate every error. It is to build a repeatable way of forming and testing explanations. In this final exercise, another student gives you a new commit that changes consultation behavior. You have the repository, its documentation, your local tools and permission to work in an isolated environment. You do not have permission to modify production data, deploy rules or spend a provider budget. Explain what the change does, identify its risks and propose a verified improvement within that boundary.

Begin by reading the task and the applicable AGENTS instructions. Distinguish general software-design principles from unrelated product examples. This repository's teleconsultation rules take priority over marketing or HR patterns copied into the same instruction file. Do not invent a faculty dashboard because a role name exists. Do not enable attachments or scheduling merely because backend capability names are present. Prepared interfaces are not automatically requested features, and an audit is not authorization to expand the product.

Establish repository state before changing it. Identify the current branch, commit, remote and dirty paths. Read the diff rather than treating every local modification as yours. A changed AGENTS file may contain the user's instructions; an untracked archive may be their evidence. Preserve them. Fetching remote information is different from merging it, and merging is different from deploying it. If the branch cannot fast-forward safely, explain the conflict rather than discarding work to obtain a clean-looking status.

## Read the change through its contracts

Describe the externally visible behavior in one paragraph before discussing implementation. Who is the actor? What object is affected? What command expresses intent? Which server boundary decides whether that actor may perform it? What durable fact changes? What projection informs the browser afterward? If those questions require reading fifteen callbacks, the design may be leaking complexity. Your explanation should reveal that leakage rather than hide it behind a list of functions.

For a hypothetical invitation change, trace the signed capability to the persisted invitation, then the authenticated principal, admission decision, waiting row, room grant and encounter binding. For a history change, trace stable account ownership through the server query and browser projection. For a summary change, trace consented evidence, transcript revision, output validation and clinician review. The correct route depends on the object, but every route needs a coherent authority story.

Name the invariants that must survive the change. A non-allowlisted visitor cannot gain consultation media rights merely by knowing a room label. A stale leave event cannot end a newer encounter. A replaced browser page cannot overwrite the continuing participant's lifecycle. A reviewed note cannot be silently regenerated. An unavailable optional provider cannot prevent an otherwise valid call. These invariants are stronger and more useful than saying that the code “uses best practices.”

## Design twice before editing

Consider at least two plausible repairs. Suppose several components duplicate queue refresh logic. One option is a larger component that owns all consumers directly. Another is a shared projection service that owns the polling and subscription lifetime behind a small interface. Compare information hiding, cleanup responsibility, testability and the number of callers that must understand timing. The correct choice is not whichever option has the fewest lines. It is the one that makes future correct use simpler without inventing abstractions for hypothetical requirements.

Write the interface comment first. State what the operation guarantees, who owns its lifetime, what errors mean and which facts it does not establish. If you cannot describe the interface without exposing every timer or repository query, the module may be too shallow. Pull complexity downward where it can be tested once. Keep pure policy free from IO, but do not split a cohesive transaction into disconnected steps merely to create more files.

Patterns should earn their place. A transaction is valuable when several durable effects must commit together. An adapter is valuable when provider mechanics should not leak into policy. An idempotency key is valuable when retries can repeat an intent. A state machine is valuable when legal transitions and stale commands must be explicit. Naming a pattern does not prove that the implementation satisfies it; locate the actual invariant and failure schedule the pattern controls.

## Build the discriminating test first

Construct a synthetic counterexample that fails for the suspected reason. If the bug concerns stale asynchronous work, force the response order. If it concerns authorization, make the forbidden request directly and keep the allowed owner's case as a positive control. If it concerns a namespace collision, use two principals and names that exercise the collision. If it concerns payload bounds, test just below, at and above the intended boundary without sending oversized data to production.

Check that the test is capable of failing. A security assertion that receives denial because no test principal authenticated has not reached the authorization decision. A lifecycle test that never delivers the late event does not exercise stale-event handling. A performance test with real timers and uncontrolled network delays may be flaky rather than discriminating. Use deterministic dependencies where the claim permits them, then reserve realistic staging measurements for the effects those dependencies cannot model.

Preserve the failed baseline separately from the repaired result. State the exact command, runtime, fixture scope and exit status. A test that did not start because of a missing emulator is blocked, not a failed application assertion and not a pass. A successful local test remains local evidence. Do not let the pressure to finish a thesis turn an environment problem into a fabricated success.

## Implement the narrow correction

Change the owner of the violated contract rather than patching every visible symptom. If several clients mishandle the same service error, a shared API response parser may be the appropriate depth. If the server trusts a caller-supplied UID, hiding the input in the browser is not a correction. If a transaction lacks the exact encounter guard, a UI debounce is not a substitute. Align the repair with the lowest authoritative boundary that can enforce the invariant reliably.

Avoid unrelated cleanup in the same patch. Renaming half the repository while changing ownership logic makes review and rollback harder. Preserve existing conventions unless they are the problem under investigation. Where a new convention is justified, document its purpose and migration boundary. Remove dead affordances when a renderer ignores them, but do not silently delete a supported fallback merely because a newer path exists. Compatibility is a contract too.

Review error behavior as part of the design. Expected conflicts and missing optional evidence should have explicit outcomes. Unexpected failures need safe generic client messages and bounded operational correlation, not raw exception text. Do not return success simply to make a red banner disappear. A clinician needs to distinguish no waiting patients from an unavailable queue, and no transcript evidence from a completed reviewed note.

## Verify and release only within permission

Run the focused regression, then the relevant broader checks required by AGENTS. For changes to invitation, consultation, history, transcription, summary or access behavior, that includes the project's type, lint, security/regression and production-build gates. Record the declared and actual runtime. Dependency inventory, compilation, policy emulation and browser flow verification answer different questions; retain all relevant outcomes without treating one as a universal certificate.

Before a push, inspect the intended diff for secrets, patient data, generated noise and unrelated user work. Documentation should travel with changes to test status. If a local rule test passes but the active production rules are older, retain the production-not-passed status. If remote CI is still running, say so. A commit on main, a successful build and an active production deployment are different states. Release instructions must name the application, rule and index artifacts separately.

Do not perform a production write to demonstrate that you can. A read-only audit can produce a complete report without a deployment. An implementation request may authorize code changes but still require explicit release scope. Rollback should be planned before an irreversible migration, and restoration should be tested rather than assumed from an export file's existence. The safest workflow is not the one with the most cautious language; it is the one whose actual actions match its authority and evidence.

## Defend the result orally

Prepare a five-minute explanation organized around the user's goal. Start with the observed failure and its consequence. Show the boundary that should have prevented it. Describe the smallest reproduction, the alternative explanations it ruled out, the chosen repair and its tradeoff. Finish with the passing evidence and remaining limits. An examiner should be able to ask “How do you know?” after any sentence and receive a concrete artifact rather than a slogan.

Practice answering a deliberately skeptical question: “Your tests pass, so why is production acceptance still incomplete?” The answer is that tests establish the exercised implementation under their declared environment, while production acceptance also depends on deployed artifact identity, configuration and the complete journey. That is not a weakness in the tests. It is a correct separation of evidence. The appropriate next action is a scoped release verification, not an inflated local claim.

Another question asks why the team did not add more sophisticated patterns. Explain that information hiding and contract ownership matter more than pattern count. The prototype should let the intended clinician and patient complete the existing journey reliably. Optional analytics, reviewer roles, attachments and scheduling introduce new authority, privacy and lifecycle questions. Leaving them disabled is a deliberate scope boundary until a request and acceptance criteria justify them.

## A personal working standard

After finishing the exercise, write a short handoff that another student can use tomorrow. Include the last completed step, current revision, changed paths, verification results, unresolved risks and next safe action. Do not make them rediscover completed work. Include enough context to continue, but not raw credentials or sensitive records. A handoff is a compact interface between investigators: it should hide incidental tool history while preserving decisions and evidence.

Keep a learning log of mistaken hypotheses as well as successful ones. Perhaps a presumed database error was a browser parsing failure, a supposed media problem was an unrelated selected peer, or a suspected authorization leak was stale client state. The value is not embarrassment or blame. It is learning which observation would have discriminated the alternatives sooner. Better engineering often means asking a sharper question before running another command.

Finally, return to the human goal. The intended patient should reach the intended consultation safely. The clinician should understand admission, connection and documentation state without decoding token internals. The thesis should explain what was implemented and measured without claiming certification or unsupported performance. Tools, patterns and tests serve those outcomes. When you can preserve that alignment while investigating an unfamiliar commit, you have learned a transferable engineering method rather than a collection of recipes.

## Foundational systems reading - adapted companion material

These adapted engineering readings close the book with transferable methods for tool choice, evidence and knowledge preservation. They support independent reasoning rather than an instruction to trust an assistant, a dashboard or a successful command uncritically.

## Supplied systems reference - page 167

A more convenient representation can be less informative. Do not ask a rounded duration to recover seconds, a normalized identifier to recover original spelling, or a screenshot to prove which backend process handled a request.

When should you preserve an original representation alongside a canonical one? When normalization is useful for operations but the original spelling or precision has audit, reconciliation, or interpretation value.

An AI assistant can search, explain, draft code, and suggest experiments. Its fluent explanation is a claim, not an execution trace. Treat it as a tool whose proposals need to be tied to files, commands, observations, and contracts. Your strongest use of it is to accelerate a question you can state precisely and a result you can assess.

## Supplied systems reference - page 168

Tools can have consequential effects. Distinguish a source-reading command, a fixture mutation, a database restore, a remote push, and a deployment. A successful tool call establishes that action's reported result, not every downstream effect. The same discipline you apply to HTTP and queues applies to automation interfaces.

A tool's value depends on the task, its interfaces, and your ability to maintain it. Vim can make repeated text transformations concise. A browser's DevTools can expose actual events and requests. A graphical diff can improve review. A database client can make query plans readable. The appropriate choice follows the information you need and the recurring work you perform.

Record one friction point for a week before changing the environment. Count how often it occurs, what information is missing, and how much attention it costs. If project navigation repeatedly takes several searches, tags or an LSP may help. If remote diagnostics disappear on disconnection, tmux may help. If a page behaves incorrectly, a faster editor does not substitute for observing its requests.

## Supplied systems reference - page 169

Evaluate replaceability. Stable text, JSON, Git patches, and documented commands are easier to carry across environments than an unexplained plugin state. A proprietary interface can still be worthwhile, but preserve the meaningful artifact or procedure where possible. Your note should survive a tool replacement even when exact shortcuts change.

There is no general need to reject graphical interfaces to learn computing deeply. A GUI can reveal structured state that a terminal command obscures. A CLI can expose a composable interface that a GUI hides. Learning improves when you can identify the underlying representation and choose the interface that answers your question.

What justifies replacing a tool that already works? A concrete benefit in recurring work or a needed capability, weighed against migration, learning, maintenance, and recovery cost, with a way to verify the improvement.

## Supplied systems reference - page 170

Return to the question you asked: which omissions would block advanced learning? The most consequential omissions are usually boundaries you collapsed. A name became an identity, a displayed value became authoritative state, one process became the whole system, an accepted request became completed work, or one example became proof of every case. The remedy is a precise distinction and an experiment that makes it visible.

A lifelong note is not a permanently correct command. Preserve the principle, scope, evidence, and version so the command can be re-evaluated. Durability comes from explainability and renewal.

## Source trail

Use AGENTS.md and docs/thesis-defense-guide.md as the local delivery contract.
Cross-check docs/production-readiness.md, docs/access-control.md,
docs/consultation-modular-architecture.md and the dated verification checklist.
This final examination is a proposed independent exercise. It is not a claim
that every release, restoration or performance study described here has run.


# Source index and evidence boundaries

## Edition identity

This single-volume study edition was prepared on 24 November 2026. Its
application baseline is commit c43b76f08886e8fc329d815c3ae3254d185656dd in
Garrette27/Livekit. The remote was fetched again during final preparation; it
still contained the earlier documentation checkpoint, not a newer application
implementation. This book is not a claim that a production service was tested
on the edition date.

The sixty chapters contain exactly 60,000 words under the stated body-prose
count. The source index, front matter, headings, contents, code fences, tables
and chapter source trails are outside that count. The manuscript source,
progress record, provenance record and document verification script are retained
in docs/study-book and scripts/thesis. The single PDF is the reading deliverable.

## Supplied reference material and attribution

Developer Tools and Computer Systems, user-supplied PDF, 200 pages, is the source
for the groups labeled Supplied systems reference in the chapters. The selected
readings are adapted, not represented as newly authored LiveKit text. Page
numbers refer to the supplied PDF's physical pages. The original reference's
internal bibliography labels were removed rather than left as dangling citations.
Command listings, unrelated product cases and unsupported cross-references were
excluded. Some paragraphs were edited to stand alone or make their comparative
scope explicit. The original supplied PDF was not copied into the repository.

Its SHA-256 is
546084919b80bbb8c2bb8659d2d0070c6e2021e0fe2063660479aae8e98e9a0f.
The provenance record identifies the selected source-paragraph IDs, page groups
and adapted word totals by chapter. The counted split is 43,902 words of original
LiveKit instruction and transfer commentary, and 16,098 words of adapted systems
readings. The comparative examples do not claim a Python, SQL, Django or Docker
production backend for this application.

Getting the Basics Right: RideMax, 40 Chapters; RideMax Editorial Implementation
Study, Edition 5; and RideMax DevTools Field Manual were also supplied by the user.
Their progression, worked-case approach and practical-study format informed this
book's structure. Their product requirements, implementation details and test
outcomes were not adopted as LiveKit facts. This book does not reproduce those
three books as appendices or claim their work as its own application evidence.

## Product and design contracts

AGENTS.md supplies the local software-design and teleconsultation delivery
instructions. Its unrelated product examples are not a request to add marketing,
HR or faculty functionality. The working copy's unrelated edits were preserved.

docs/thesis-defense-guide.md explains the thesis scope and defensible claims.
docs/invitation-flow-design.md and docs/invitation-access-model.md define the
object-centered workbench, invitation capability and admission policy.
docs/access-control.md defines identity, authorization and prepared backend roles.
docs/production-readiness.md distinguishes implementation from governance,
operations, compliance and remaining acceptance work.

docs/identity-and-record-integrity.md and docs/data-model-readiness.md explain
account, guest and encounter relationships. docs/consultation-modular-architecture.md
maps the service and adapter boundaries. Historical architecture prose can lag
later integrity hardening; implementation and dated regression evidence take
precedence where an older snapshot describes a weaker identity rule.

docs/ai-summary-status.md explains optional AI availability and evidence limits.
docs/cost-control-and-migration.md explains operational tradeoffs and recovery
planning. These notes are source navigation, not authorization to mutate data.

## Implementation entry points

The invitation policy is traced through lib/invitations/admission-policy.ts,
lib/invitations/email-allowlist.ts, lib/invitations/invitation-use-reservation.ts,
lib/invitations/validate-service.ts and
lib/services/invitation-access/invitation-access-core.ts. The app/api/invite and
app/api/waiting-room routes adapt requests to that service boundary.

Identity and request policy are traced through
lib/services/shared/request-auth.ts,
lib/services/shared/session-participant-auth.ts and
lib/services/shared/waiting-room-auth.ts. Room ownership and reserved namespaces
are traced through lib/services/room-access/doctor-room-access.ts and
lib/rooms/room-name-policy.ts. lib/firebase-admin.ts owns the trusted Firebase
runtime boundary rather than the browser's public configuration.

Consultation state and provider adaptation are traced through
lib/services/video-chat/consultation-session-core.ts,
lib/services/video-chat/rtc-transport-adapter.ts,
lib/services/consultation-tracking/consultation-tracking-core.ts and
lib/services/consultation-finalization/consultation-finalization-core.ts.
Chat persistence is in lib/services/video-chat/chat-message-store.ts.
History projections are in
lib/services/history-summary/summary-projection-service.ts.

Summary review policy and commands are traced through
lib/services/summary-management/summary-edit-policy.ts and
lib/services/summary-management/summary-management-core.ts. The provider-facing
transcription adapter is lib/services/transcription/openai-audio-transcriber.ts;
its existence is not a statement that provider entitlement was available or that
paid calls were made for this book.

Client hooks such as hooks/useWaitingQueue.ts, hooks/useSessionChat.ts and
hooks/useTranscription.ts connect projections and optional capture to browser
lifetimes. Read their actual dependencies rather than inferring authority from
the hook name. firestore.rules and storage.rules are separate policy artifacts
from the application release.

## Historical verification, not newly executed acceptance

docs/testing/verification-status.md is the status index. The dated reports retain
failed baselines, repaired results, environment limits and unresolved work.
docs/testing/defense-readiness-2026-11-22.md records the fifty-two application
cases, thirteen emulator cases and the local runtime caveat. Those counts are
historical, not a new suite run during book production.

docs/testing/rules-release-2026-11-19.md records the earlier reviewed Firestore
release and retrieved-source verification. It must not be confused with the later
clinician-only room/call creation change, which the cited November 22 report
still marks as awaiting release. No new rule release occurred for this book.

docs/testing/performance-assessment.md defines the performance protocols and
limits. A public HTTP pilot, deterministic polling budget, actual media trial
and clinician study answer different questions. Media latency, concurrent-call
capacity and clinician efficiency remain unmeasured in the cited baseline.

tests/security-policies.test.mjs and tests/queue-and-auth-regressions.test.mjs
contain synthetic policy and lifecycle regressions. A proposed exercise in this
book is not automatically one of those executed cases. Test intent, observed
execution, active deployment and complete production acceptance remain separate.

## Primary documentation for checking tool semantics

Chrome DevTools, Inspect network activity:
https://developer.chrome.com/docs/devtools/network/

Microsoft, Working across Windows and Linux file systems:
https://learn.microsoft.com/en-us/windows/wsl/filesystems

Firebase, Transactions and batched writes:
https://firebase.google.com/docs/firestore/manage-data/transactions

Firebase, Build unit tests for Security Rules:
https://firebase.google.com/docs/rules/unit-tests

LiveKit, Authentication:
https://docs.livekit.io/frontends/build/authentication/

W3C, Identifiers for WebRTC's Statistics API:
https://www.w3.org/TR/webrtc-stats/

Git, git-diff reference:
https://git-scm.com/docs/git-diff

These primary pages were opened during final source checking. Browser and SDK
interfaces can change; consult the documentation for the version being tested.
The linked W3C statistics publication is a Candidate Recommendation Draft, not a
claim that every browser implements every field identically. The adapted systems
readings remain attributable to the supplied study text rather than to these
web pages; the primary links are verification aids, not an invented bibliography
for material copied from elsewhere.

## A final boundary

The book teaches how to investigate, test and explain a thesis prototype. It
does not certify a medical service, prove clinical accuracy, grant access to
patient records or authorize production experiments. A useful next study begins
with a precise question, an approved environment and an evidence plan. Keeping
that boundary explicit is part of the engineering method, not an omission.
