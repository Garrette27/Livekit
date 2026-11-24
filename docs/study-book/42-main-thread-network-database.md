# 42. Separate main-thread work, network time and database reads

## The LiveKit boundary to trace

A slow-feeling interface can wait on JavaScript execution, rendering,
authentication, network requests or database work. A fast server response
can still be followed by expensive client rendering. Conversely, an idle
main thread may simply be waiting for a remote dependency. The Performance
and Network panels answer complementary questions.

The room route's substantial JavaScript payload includes media libraries.
That is a reason to inspect loading and execution, not an automatic proof
that a particular user experienced unacceptable delay. A bundle-size number,
a main-thread trace and an end-to-end task time are separate measurements.
Optimization should target the demonstrated bottleneck while preserving
device preflight and the working consultation journey.

## A worked investigation

Record a short local or approved synthetic task with the browser profiler.
Mark the user action and identify long tasks, rendering work and pending
requests. Repeat under the same conditions after a focused change. Keep
the before and after traces appropriately redacted and do not equate one
machine's result with representative mobile performance.

For read cost, count requests and inspect query contracts. The queue's
shared request promise reduces overlapping API calls from multiple panels,
but a server call may read several documents and a realtime listener has
its own cost. A request count is not a billed-read count unless the mapping
has been measured and its conditions recorded.

## Exercise with answer

A hidden tab stops its periodic timer, yet database reads continue. Is the
pause implementation broken? Not necessarily. Live listeners, explicit
actions, other tabs and unrelated routes can still read. Test the timer's
local invariant and investigate the remaining workload separately. Do not
promise that one visibility check eliminates every background read.

A performance trace contains sensitive URLs. Should you upload it unchanged
for help? No. Reduce it to the necessary timing and task evidence or use a
synthetic reproduction. Diagnostic artifacts can expose credentials and
account activity even when they contain no obvious clinical paragraph.
Performance observation has privacy obligations too.

## Foundational systems reading - adapted companion material

These adapted measurement readings connect elapsed time, profiling and observability cost. Their process and Python examples explain measurement boundaries, not current LiveKit benchmark results. Use the distinctions to select a discriminating local experiment.

## Supplied systems reference - page 53

For a pathname question, add openat to the traced syscall set and inspect the requested paths and returned descriptors. -f follows children; without it, a parent trace can miss the worker performing the operation. Conversely, tracing a busy process tree can create enormous output and substantial overhead. Choose the syscall set, process scope, duration, and output destination according to one hypothesis.

Tracing can also expose payloads, filenames, and credentials, so practice on fixtures and avoid copying an indiscriminate production trace into a ticket. Credentials, ptrace policy, or the surrounding container can restrict tracing even when launching your own child.

A slow command presents at least two questions: how much elapsed time passed, and what occupied that interval? CPU execution, disk access, socket waits, synchronization, deliberate sleep, and scheduling all contribute differently. Optimizing Python arithmetic will not reduce a delay spent waiting for an unavailable service. Start with a hypothesis that predicts a measurement, rather than treating "slow" as a diagnosis.

## Supplied systems reference - page 54

A bounded arithmetic workload consumes user CPU with machine-dependent duration. A sleeping process can show little cumulative CPU time while substantial elapsed time passes. A socket listing is a separate inventory of listeners, not evidence that a sleeping process owns any of them. Process attribution requires an appropriate observation and sufficient permissions.

Beware measurement scope. ps CPU percentages are not necessarily instantaneous utilization. RSS measures resident memory but shared pages make summing process RSS an imperfect system total. CPU time can accumulate across threads and, depending on tool scope, children. A short sample can miss spikes. A warm filesystem cache can make a second run faster without any code change, while a first run can include interpreter startup and imports.

Choose a narrow next experiment: replace the suspected remote call with a fixture, compare warm and cold starts, or measure one stage with a monotonic clock. Preserve the same input and environment where possible. Every measurement should eliminate at least one plausible explanation; otherwise you are collecting numbers without reducing uncertainty.

## Supplied systems reference - page 55

If tmux is available, run the producer from the isolated lab session and detach while it runs. Reattach and inspect the result. Your notebook should explicitly say which connection ended and which processes stayed alive. Do not test survival by shutting down WSL: the model already predicts that ordinary process memory will be lost.

Include process exit status when judging whether a producer completed. An artifact left on disk can predate the current attempt, so its existence alone cannot establish that the requested work succeeded.

## Supplied systems reference - page 99

Performance claims need a workload and a measured boundary. A page can be slow because of Python loops, database round trips, serialization, network latency, or browser rendering. A profiler that observes one process cannot explain every component automatically. First choose the symptom and measurement that would distinguish the likely causes.

## Supplied systems reference - page 100

Optimizing one function can leave the page unchanged if its cost is small relative to another bottleneck. Measurement overhead, cold caches, dataset size, and concurrency can affect the result. Report the conditions alongside the improvement.

## Supplied systems reference - page 157

A useful log records an event with enough context to test a claim. More text does not automatically create better evidence. Raw request bodies can contain personal data, session credentials, and noisy details while still omitting the operation identity needed to relate events. Design fields around the question: which operation, which service and version, which stage, which outcome, and how long did the stage take?

Prefer structured events with deliberate field selection. A whitelist is often easier to reason about than serializing everything and hoping a later redaction pass catches every secret. Correlation identifiers should be bounded and treated as untrusted input.

Sorting timestamps does not conclusively establish causality across hosts; parent identifiers and recorded sequence relationships can provide stronger evidence. Clock synchronization reduces uncertainty but does not make every timestamp perfectly comparable.

## Supplied systems reference - page 158

Retention needs a purpose and a known location. Keep the relevant window, configuration and version context, and checksums where integrity matters. A checksum detects changed bytes relative to a trusted reference; it does not authenticate who created the log. Excessive retention increases search cost and data exposure, while insufficient retention can erase the only evidence of an intermittent failure.

Logs, metrics, traces, and profiles expose different views. Logs describe events. Metrics aggregate quantities over time. Traces relate spans across a request or operation. Profiles attribute sampled or instrumented execution to code. Choose the view that matches the hypothesis. A CPU profile does not explain a task spending nearly all its lifetime queued, and a total request counter does not show one slow call's internal path.

Instrumentation also consumes resources. Logging adds formatting, allocation, locking, and output work. Tracing adds context propagation and storage. Profiling can change execution timing, particularly with deterministic call instrumentation. Measurement is therefore part of the experiment, with its own scope and overhead, rather than an invisible observer.

## Supplied systems reference - page 159

Start with a small useful set: operation rate, error rate, duration distribution, and saturation signals for the resource in question. Add a targeted profile or trace to explain a particular abnormal pattern. Verify overhead and access scope before leaving detailed instrumentation enabled broadly.

Observing a function at the top of a profile does not prove it is the best optimization target. Consider workload frequency, waiting time, caller structure, and whether the improvement affects the user-visible boundary.

Can request IDs be convenient metric labels? They are usually poor aggregation labels because unbounded unique values create high cardinality; keep them in appropriate event or trace data.

## Source trail

Read hooks/useWaitingQueue.ts, its coordinator and the performance protocol.
Use browser profiler data to explain client work, service logs for server
behavior and provider metrics for actual quota accounting.
