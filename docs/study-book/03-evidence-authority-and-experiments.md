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
