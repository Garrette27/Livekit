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
