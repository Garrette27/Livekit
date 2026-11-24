# 1. A green build and a broken consultation

## Begin with a contradiction

A patient opens the login page. The page itself appears. The Google button is
visible, the browser has downloaded JavaScript, and a deployment dashboard says
the application is ready. Yet the patient cannot load consultation history.
The screen displays a parser error beginning with an unexpected less-than
character. In another window the doctor's queue fails, and the doctor-access
request returns an HTML error document. These observations seem inconsistent
only if you treat the application as a single operation with one status.

The useful question is not whether the website works. It is which operation
failed, which interpreter produced the failure, and what the successful build
actually established. A build can establish that source transforms and selected
checks completed in its build environment. It does not establish that every
runtime dependency can load in a hosted function, that credentials can reach a
database, or that two participants have exchanged media. Each is a different
claim with a different witness.

This book starts with that distinction because the LiveKit thesis application
has already supplied a concrete example. In the November investigation,
production functions reported an error while a CommonJS dependency attempted
to require an ESM dependency. The path involved Firebase Admin authentication,
jwks-rsa and jose. The failure happened before the intended route handler could
return its normal JSON envelope. A client that immediately parsed the HTML
failure as JSON then showed a secondary parsing error. The visible message was
real, but it named the wrong layer for repairing the cause.

## Separate the four observations

Write four sentences before editing anything. First, the login document was
available. Second, one or more API requests returned a server error. Third,
their response body was HTML rather than the JSON the caller expected. Fourth,
runtime logs identified a module-loading failure. These sentences are not
interchangeable. The first concerns rendering an entry page. The second
concerns an endpoint invocation. The third concerns a response contract. The
fourth supplies a candidate mechanism connecting the failed invocation to
the unexpected body.

Now state an alternative. Perhaps the browser called an incorrect endpoint
and received a framework fallback. Perhaps deployment protection intercepted
the request. Perhaps a server import failed. The browser response alone cannot
choose between every alternative. The next discriminating check is therefore
to match the request path and time to the responsible deployment's runtime
output. Looking at an unrelated deployment's build log might be interesting,
but it would not discriminate these explanations.

When investigating, preserve enough context to perform that match without
preserving secrets. A sanitized record can include the path, method, status,
response content type, deployment identifier, approximate time and generic
error category. It does not need the bearer token, full invitation URL, patient
email or clinical response. The investigation becomes safer and easier to
share when the evidence is narrower than the browser's default export.

## Follow the causal chain

The chain in this incident is a sequence of conditional guarantees. A browser
action caused an API request. The platform attempted to load the function.
Loading the function required its dependencies. A dependency used an import
mechanism incompatible with the effective runtime behavior. The function
therefore failed before its normal application response. The platform supplied
an error page. The client parser expected JSON and raised another error.

Notice how different repairs would affect different links. Wrapping response
parsing in a friendly error message improves the patient's explanation but
does not repair dependency loading. Changing the dependency boundary can
restore the endpoint but does not prove the client behaves well during the
next outage. Disabling authentication to avoid loading its dependency would
destroy the security boundary rather than repair availability. A strong repair
must preserve the intended operation and its authority, not merely remove
the visible red message.

The repository records a narrow jose override beneath jwks-rsa and a startup
regression that loads Firebase authentication with experimental require-module
support disabled. The point is not to memorize that override for every future
project. It is to learn why the test targets the missing guarantee. Compilation
had not exercised the same loading constraint. The added regression did.

## A controlled local investigation

Use a clean checkout or worktree and inspect the declared Node version before
running a build. The source baseline for this book declares Node 22.x. Record
the executable and its version rather than relying on the terminal's color or
the fact that another terminal worked yesterday. Inspect the dependency chain
with npm's package listing command, and read the relevant installed package
metadata. Do not copy production environment files merely to reproduce a
module import. The startup question does not require patient credentials.

Predict the result of loading the authentication package under the selected
runtime constraint. Run that single check before launching the entire app.
If it fails, retain the exit code and the generic module error. If it passes,
do not declare the incident solved yet: the local package tree or runtime may
differ from production. Compare the lockfile and deployment source. The same
module path in two error messages is useful evidence, but identical filenames
are not a substitute for matching versions and environment.

After a candidate repair, run the narrow startup test, then the broader gate.
For this repository the gate includes maintained security regressions, lint,
typecheck and a production build. Next.js development and build tasks share
generated state, so run them sequentially when the same worktree is involved.
An overlapping process can make generated type files disappear and create a
runner failure that looks like a source defect.

## What counts as success

There are several legitimate stopping points, and each needs its own label.
The startup regression passing means the tested local dependency boundary
loads under that constraint. A successful deployment means the platform
published a particular build. A missing-credential request returning JSON 401
means the tested public endpoint rejected an unauthenticated request without
the previous HTML startup failure. None of these proves successful authenticated
history loading, and none proves a working consultation between two people.

This precision is not pessimism. It lets the team make progress without
inventing evidence. You can close the startup incident while leaving a
positive authenticated journey pending. You can acknowledge a clean production
dependency inventory while retaining a separate development-tool advisory.
You can explain why optional AI is unavailable without claiming that the video
transport is broken. Good engineering keeps these conclusions separate.

## Exercise and worked answer

Suppose the landing document returns 200, the queue endpoint returns HTML 500,
and a media-region request returns 200. What has been proved? The landing
document and region-list requests succeeded at their respective boundaries.
The queue operation failed, and its body did not satisfy the client's expected
JSON contract. No observation yet proves that a doctor and patient exchanged
audio or video. The next useful evidence is the queue request's matching
runtime failure, not another screenshot of the landing page.

Suppose a teammate proposes catching every API error and returning success
with an empty array. Reject that proposal. It erases the distinction between
an empty queue and an unavailable queue, misleading the doctor at precisely
the moment reliable feedback matters. A better response is a generic,
retryable service explanation where appropriate, while preserving denial for
authorization failures. The repair should make the state understandable
without pretending that an uncompleted operation succeeded.

## Source trail

Read `package.json`, `lib/firebase-admin.ts`,
`tests/queue-and-auth-regressions.test.mjs`, and
`docs/testing/rules-release-2026-11-19.md`. Use the dated readiness reports as
historical evidence, not as proof of the current deployment. This chapter is
an explanation of a recorded incident; its exercises are not new production
test results.
