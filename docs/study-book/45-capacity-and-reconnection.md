# 45. Design simultaneous-call capacity and reconnection experiments

## The LiveKit boundary to trace

Capacity is a workload claim. Five paired calls require ten media clients,
not five requests to a public page. The experiment must exercise the
application's authentication, admission, transport and relevant persistence
under the stated conditions. HTTP virtual users alone do not generate a
representative WebRTC media workload.

The repository protocol proposes increasing load levels on isolated staging
with synthetic participants and explicit spending limits. Baseline,
intermediate and target levels should be repeated. Retain warm-up samples
even when the predeclared analysis excludes them, and stop when the agreed
failure threshold or participant-access condition is reached.

## A worked experiment design

Describe each media client: device or process context, browser, codec,
resolution target, network and account. Monitor per-direction metrics and
application errors while participants perform the same script. A single PC
can become the bottleneck before the service does; document that limitation
instead of interpreting local CPU saturation as server capacity.

For reconnection, define the interruption and restoration instants in a
controlled test network. Measure recovery from restoration, not from whichever
button an observer happens to press afterward. Verify encounter continuity,
absence of unintended duplicate identity and appropriate user feedback as
well as media return.

## Exercise with answer

The highest completed level is three paired calls and all budgets pass. Can
the report claim capacity for five? No. Report the tested level and planned
next experiment. A system can plausibly support more, but plausibility is
not the evidence the thesis asks you to present.

Why include a long-consultation trial? Short calls may miss memory growth,
stale token handling, timer accumulation and lifecycle problems. A long run
does not establish unlimited reliability, but it exercises a different
failure surface from a quick join demonstration. Keep duration and repeated
run counts visible in the result.

## Write the run card before opening clients

A capacity run card identifies the exact application artifact, rule state, environment, device arrangement, browser versions, network condition, load level, duration, metrics, budget and stop conditions. It also names the person authorized to stop the run. This is not bureaucracy added after measurement; it is what makes the measurement interpretable and safe. Without it, a demonstration can quietly change conditions while retaining the same label.

Define a pair as one synthetic clinician and one synthetic patient unless the study explicitly includes observers. Five pairs therefore require ten clients, not five browser tabs. Separate account and media identities deliberately so duplicate-identity replacement does not masquerade as a capacity failure. A single laptop hosting many tabs may become the bottleneck before the cloud service does. If that is the chosen arrangement, state the limitation rather than attributing every failure to the platform.

Choose a workload that resembles the intended feature. Video enabled on every participant produces different demand from silent audio-only clients. Screen sharing, chat and transcription can add different work. Keep optional AI off when the study does not have entitlement or when it would confound the core-media question. Do not claim that a run without those features establishes their capacity. A bounded study can be valuable while covering only the declared core journey.

## Progress through load levels conservatively

Begin with a single pair to confirm the protocol and collection method. Increase to three pairs, then five if the budget and preceding outcomes permit. Hold each level for the declared observation interval, and record attempted joins as well as successful connections. Stop when a predefined safety or resource limit is reached. The highest successfully tested load is a tested point, not automatically the system's maximum capacity.

Repeat a level when practical to reveal variability. If only one run is feasible, report that honestly. A small thesis protocol can describe observed behavior under limited resources without pretending to estimate an operational service-level objective. Keep unsuccessful runs in the evidence set with reasons. Excluding every failure as a setup issue after seeing the outcome would bias the result toward success.

Observe both local device saturation and service responses. Browser CPU, memory pressure and media adaptation can affect the client experience. API availability and database quota can affect admission before media starts. Provider media infrastructure has its own path. A capacity failure should be classified by the boundary supported by evidence rather than assigned to “the server” generically. Often the first useful result is learning which resource saturates under this particular arrangement.

## Reconnection is a separate stress dimension

Steady-state connected load does not establish recovery behavior. Plan a bounded interruption for one synthetic participant, then observe whether the intended visit resumes without duplicate reservation, incorrect finalization or leaked background work. Record interruption duration, recovery start and recovery outcome. Avoid disrupting the entire production network to create a dramatic failure. A controlled staging condition is safer and more reproducible.

Test duplicate identity separately from network recovery. In replacement, the old connection may be intentionally displaced by a new one. In network recovery, the same visit attempts to re-establish transport. Both can generate disconnect callbacks, but their durable lifecycle implications differ. The capacity protocol should not blend them into one disconnect count without explanation. Classify expected replacement, transient recovery and unrecovered failure according to the study's definitions.

After the run, verify cleanup. All synthetic clients should leave, test polling should stop, and no capture mode should remain enabled. Check the resources you created rather than assuming that closing the visible tab stopped every worker or diagnostic recorder. Record any residual test data under the staging retention plan. Do not perform production deletion as part of routine cleanup unless that action was separately approved and precisely scoped.

## Analyze the tested range without extrapolation

Compare outcomes by load level using the declared experimental unit. Show attempted and completed joins, failures, recovery outcomes and relevant per-call metric summaries. If device classes differ across pairs, retain that distinction. A pooled average can hide one consistently poor endpoint. Explain whether a change is associated with load or merely observed during a different condition; association alone does not establish the bottleneck's cause.

For an independent exercise, suppose five pairs work for five minutes but the database read budget is nearly exhausted during setup. Can the result be called scalable? It supports a narrow media observation at five pairs under the recorded conditions. It also reveals an operational budget concern that may limit practical use. “Scalable” is too broad unless the study defines resources, workload and acceptable outcomes. Preserve both findings instead of letting the successful call overwrite the quota warning.

## Source trail

Read the capacity, reconnection and long-consultation cases in the remaining
experiments protocol. No load operation in this chapter is authorized against
the production service or real patient accounts.
