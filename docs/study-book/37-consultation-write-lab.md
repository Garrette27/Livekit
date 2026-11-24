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
