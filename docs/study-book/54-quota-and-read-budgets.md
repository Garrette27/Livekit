# 54. Quota incidents, read budgets and operational recovery

## The LiveKit boundary to trace

An exhausted database quota can make several unrelated screens fail together.
That does not mean each screen independently contains a new bug. Shared
dependency failure should become a clear, bounded service response without
weakening authorization or pretending an empty result was successfully read.
The common availability classifier recognizes known quota, deadline and
service-unavailable representations.

Read budgets are architectural. Polling every mounted panel independently,
reading historical rows into live listeners and refreshing hidden tabs can
spend work unrelated to the user's immediate task. Shared requests, live-status
queries and visibility-aware timers reduce that amplification, but actual
provider usage still needs measurement.

## A worked incident review

Start with the observed failures and match their times to approved provider
or server evidence. Distinguish known resource-exhausted status from a generic
500, a permission denial or a parser error. Then inspect the workload that
continued during the incident. Do not recover by removing role checks or
serving another user's cached data.

After recovery, run a valid synthetic operation and verify feedback clears.
An outage can leave a client in a stale error or pending state even after the
database becomes available. Operational recovery includes both restored
dependency access and a comprehensible route back through the interface.

## Exercise with answer

The quota resets and the application works. Was the read-cost bug repaired?
No. Resetting availability removes the immediate symptom. The workload may
exhaust the next window again. Measure request sources and query behavior,
then test a focused architectural improvement. Avoid claiming a percentage
saving from a local timer-count test alone.

Should the project upgrade billing immediately? That is a cost and capacity
decision for the owner, informed by measured workload and expected use. The
engineer can explain options and limits without silently changing a plan.
A thesis prototype should keep its free-tier constraints visible in both
test design and deployment guidance.

## Source trail

Read lib/services/shared/database-availability.ts,
docs/cost-control-and-migration.md and the quota incident reports. Provider
limits can change; verify current account terms before operational planning
rather than treating an old study snapshot as a permanent entitlement.
