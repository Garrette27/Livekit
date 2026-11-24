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

## Source trail

Read `lib/rooms/room-name-policy.ts`,
`lib/services/room-access/doctor-room-access.ts`,
`lib/chat/chat-message-key.ts`,
`lib/services/summary-management/summary-edit-policy.ts`, and
`docs/testing/defense-readiness-2026-11-22.md`. Keep the source baseline visible
when discussing these examples: this chapter teaches how to examine that
implementation, not how to infer that every fix is already active in production.
