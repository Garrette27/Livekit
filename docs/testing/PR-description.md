## Problem and resulting behavior

The active Firestore user policy allowed any signed-in user to read another
profile and allowed patients to change their own role. The reviewed profile
policy is now deployed to `livekit-5eef6`; private reads are owner-scoped,
elevated-role provisioning requires trusted claims, and client updates cannot
change roles, identity, permissions, or consent evidence. Owner reads, patient
creation, provisioned doctor creation and login timestamp refresh still pass.

The deployed source was retrieved and matched to the reviewed file. Both
original attacks now pass denial assertions using that source in emulators.
No production patient role was modified during testing.

## Changes

- Update Next.js/React/LiveKit/Firebase dependencies and both lockfiles; use
  narrow compatible transitive overrides and declare Node 22.
- Both complete dependency inventories now report zero vulnerabilities,
  replacing the baseline application's 4 critical/9 high package findings.
- Remove the invalid-login profile-enumeration fallback.
- Correct the obsolete Storage uploader test to expect disabled uploads.
- Add profile authorization regressions and CI dependency audit gates.
- Preserve the failed baseline and add separate remediation evidence, a
  printable thesis report, Chapter III/IV wording and remaining trial protocols.

## Validation

- 11 application policy tests and source-contract scripts pass.
- 7 Firestore/Storage cases pass, including positive owner/provisioning cases.
- 2 original attacks against retrieved active rules pass after remediation.
- 23 local API regression cases pass, including anonymous access and webhook denial.
- Type checking, lint and production build pass on Node 22.
- Full application and Cloud Functions npm audits report zero findings.

## Release scope and remaining measurements

Firestore rules have already been compiled, released and verified through the
authorized remediation. This PR proposes the application/function package
updates for their normal release; it does not claim those updated packages are
already running on the production frontend or Cloud Functions.

Real video latency, concurrent-call capacity and clinician documentation
efficiency remain NOT TESTED. They require an isolated staging deployment,
synthetic doctor/patient accounts and a participating clinician for the paired
documentation-time study. The report retains these limitations explicitly.
Attachments, scheduling and faculty UI remain disabled.
