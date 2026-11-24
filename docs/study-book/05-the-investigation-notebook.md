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

## Source trail

Read `docs/testing/verification-status.md`,
`docs/testing/follow-up-2026-11-22.md`,
`scripts/thesis/verify-remediation.mjs`, and
`scripts/thesis/verify-rules-release.mjs`. The scripts demonstrate evidence
collection patterns; check their output paths and deployment scope before
running them. A historical reproduction command is not permission to write
to production during a new investigation.
