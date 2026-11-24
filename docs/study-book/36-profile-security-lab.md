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
