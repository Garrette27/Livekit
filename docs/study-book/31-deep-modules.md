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
