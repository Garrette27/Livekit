# 43. Measure authenticated API performance without contaminating production

## The LiveKit boundary to trace

A public cached page is a poor substitute for an authenticated, database-backed
operation. History, invitations and queue projections require different
workloads and authority. A valid performance trial must use the intended
identity and resource scope, while keeping secrets out of the recorded sample.
Expected security denials belong to security tests, not the success count of
a valid-user workload.

Use isolated staging with synthetic accounts and a fixed workload budget.
Define the allowed host so a mistaken base URL cannot stress production.
Agree on stop conditions for unexpected failures and account for rate limits,
database reads, writes and participant-minutes. Tool availability is not
permission to generate an unbounded workload.

## A worked experiment

Choose one read-only history endpoint and a synthetic account with a known
bounded fixture. Define concurrency, repetitions, warm-up and collection
window. Measure status, total duration and the agreed error categories.
Retain all observations, including failures. If a token expires during the
run, classify the event and decide whether the run still represents the
specified authenticated workload.

Compare response time with server query behavior. A history endpoint that
returns fewer records after an authorization repair may do different work
than the earlier version. Explain that change rather than attributing every
improvement to generic speed. Correctness and privacy can alter the workload;
the comparison must preserve its meaning.

## Exercise with answer

A load generator receives many 401 responses quickly and reports excellent
latency. Did the valid-user endpoint meet its budget? No. The workload failed
to exercise its intended operation. Report the authentication setup failure
and repair the experiment before interpreting performance. Fast denial is a
useful security observation under a different claim.

Why keep secrets in an established environment rather than a committed test
file? Reproduction requires a method for obtaining authorized synthetic
credentials, not a permanent leaked token. Record the authentication setup
and token lifecycle without recording credential values. The resulting
experiment can be repeated safely after credentials rotate.

## Source trail

Read the protocol's authenticated API cases and e2e/api-access-control.spec.ts.
The latter tests rejection behavior; its passing result is not a latency or
throughput benchmark for successful consultations.
