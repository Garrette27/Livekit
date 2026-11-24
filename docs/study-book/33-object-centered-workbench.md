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
