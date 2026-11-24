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
