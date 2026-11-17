# TeleConsole performance assessment

## Assessment conclusion

The public HTTP response pilot met its exploratory target of p95 body-response
time at or below 3000 ms with ten successful responses per page. The landing
page had a median of 52 ms and p95 of 82 ms. The access-denied page had a median
of 89.5 ms and p95 of 1462 ms. These are client-observed HTTP measurements from
one machine. LiveKit media latency, simultaneous consultation capacity and AI
documentation time have not yet been measured and cannot be reported as passed.

## Purpose and environment

Performance testing supports the efficiency and reliability objectives in the
revised TeleConsole thesis. ISO/IEC 25010:2023 provides the product-quality
framework [1]. We define application thresholds separately, measure them,
and retain failures. The pilot uses the production frontend at
`https://livekit-frontend-tau.vercel.app`, commit
`fa5a33cca4b341513dae6d78538f4eeede26a92b`, on 17 November 2026.

The client was WSL2 Linux with an AMD Ryzen 5 5500GT and Node 20.20.2. Test
network bandwidth, client access technology and network shaping were not
controlled. This prevents comparisons with a defined mobile-network population.
The retrieved Firebase database is in asia-southeast1. Function runtime regions
were not independently measured; build-region labels are not function-region
evidence.

## Executed HTTP pilot

The Node fetch runner requested two public pages sequentially, ten times each,
with 250 ms between requests and one request in flight. It used normal
certificate verification, followed no redirects, consumed each complete body,
and retained status, time to headers, total duration, bytes and selected headers.
Connections/caches were not reset; every observation is retained, including the
first request. No sample is claimed to be a controlled cold start.

The p95 is the nearest-rank value at `ceil(0.95 * n)` in ascending order. At
n=10 it equals the maximum; this small sample is exploratory. The median is
the average of the fifth and sixth values. Mean is rounded to whole milliseconds.

| ID | Target | n | Median ms | Mean ms | p95 ms | Result |
| --- | --- | --- | --- | --- | --- | --- |
| PERF01 | Landing page HTTP body | 10 | 52 | 56 | 82 | PASS pilot |
| PERF02 | Invalid-token explanation HTTP body | 10 | 89.5 | 234 | 1462 | PASS pilot |
| PERF03 | Authenticated invitation validation | 0 | — | — | — | NOT TESTED |
| PERF04 | Admission through remote media received | 0 | — | — | — | NOT TESTED |
| PERF05 | Two-way audio/video quality | 0 | — | — | — | NOT TESTED |
| PERF06 | Concurrent consultations and sustained load | 0 | — | — | — | NOT TESTED |
| PERF07 | Reviewed AI documentation time | 0 | — | — | — | NOT TESTED |

Raw observations are in `evidence/2026-11-17/assessment.json`. The landing
sample's CDN header was HIT. Node fetch measures neither JavaScript execution
nor screen rendering. A public cached page response is not evidence that a
Firestore-backed authenticated consultation is equally fast.

## Proposed full experiment protocol

Agree on and freeze the following project targets before collecting the main
dataset. They are suggested engineering budgets, not ISO mandates or validated
clinical thresholds. Record a signed amendment if targets later change.

| ID | Metric | Proposed acceptance | Sample design |
| --- | --- | --- | --- |
| PERF08 | Browser LCP, INP, CLS | p75 LCP <=2.5 s, INP <=200 ms, CLS <=0.1 [2] | 30 task sessions per browser/network stratum; pilot lab values separate from field results |
| PERF09 | Authenticated history and invitation API | p95 <=2 s, unexpected error rate <1% | 30 valid trials per endpoint per three independent runs |
| PERF10 | Admission to both endpoints receiving media | p95 <=5 s | 30 doctor/patient admissions using fresh synthetic sessions |
| PERF11 | Stable baseline audio transport | p95 RTT <=300 ms, jitter <=30 ms, interval loss <=1% | 5 calls of 10 min, samples every second per endpoint |
| PERF12 | Video at specified 720p target | median delivered FPS >=24, interval loss <=1% | Same calls, codec/resolution and quality limitation recorded |
| PERF13 | Chat delivery | p95 <=1 s | 30 synthetic messages per run, synchronized clocks or echo RTT |
| PERF14 | Reconnection after 10 s network loss | p95 <=10 s after restoration, no duplicate active identity | 10 interruptions per client/network stratum |
| PERF15 | Long consultation | no unrecovered disconnect or record contamination | Three 30 min paired calls |
| PERF16 | AI generation | p95 <=60 s after final evidence accepted | 30 fixed synthetic transcripts, model/version/token count recorded |
| PERF17 | Documentation efficiency | report paired time difference and confidence interval | Counterbalanced manual vs AI plus clinician review on the same deidentified cases |
| PERF18 | Capacity | <1% unexpected API errors and PERF09/10/11 hold | 1, 3, then 5 simultaneous paired calls for 10 min each, three runs each |

Run load levels on isolated staging with synthetic accounts and a fixed spending
cap. Stop a level if unexpected errors exceed 5% for a minute or legitimate
test participants lose access. Warm-up for two minutes and exclude that interval
only if the rule was specified beforehand; retain its raw data. Make no claim
beyond the highest completed level. Two participants per call means five
consultations require ten media clients. HTTP virtual users alone do not
produce WebRTC capacity evidence.

Use k6 for a separate authenticated, read-only HTTP workload with thresholds [3].
Keep secrets in environment variables and enforce a staging-only host allowlist.
Do not interpret expected security-test 401/429 responses as ordinary workload
success. Capture CPU/memory, Firestore reads/writes, rate-limit hits, model cost
and LiveKit participant-minutes alongside response percentiles.

## WebRTC measurement method

Use browser `getStats()`/WebRTC internals or supported LiveKit statistics for
both endpoints [4]. Retain only pseudonymous run IDs and numeric metrics; raw
WebRTC dumps can contain network addresses and session identifiers and must be
redacted before inclusion. Sampling is observation, not a new authentication
mechanism.

Report selected ICE candidate-pair `currentRoundTripTime * 1000` in milliseconds.
Report inbound RTP `jitter * 1000`. Compute interval packet loss as
`100 * delta(packetsLost) / (delta(packetsReceived) + delta(packetsLost))` when
the denominator is positive. Exclude counter resets/negative deltas with a
recorded reason. Compute interval bitrate from `8 * delta(bytesReceived) /
delta(seconds)`. Record delivered FPS, resolution, codec and reconnect events.
Keep audio/video directions and streams separate. Average bitrate is not a
direct video-quality score.

RTT is round-trip network transport latency, not one-way mouth-to-ear or
glass-to-glass delay. Measure end-to-end audiovisual delay with an external
timestamp/clap/video method and synchronized capture if the manuscript claims
that metric. Screen sharing needs a separate motion/text legibility task.

## Interpretation for the thesis

Chapter III can describe the protocol and approved thresholds. Chapter IV can
report the two HTTP pilot results now, including n=10 and the cache/network
limitations. Leave media, authenticated performance, capacity and AI efficiency
results as not tested until evidence exists. Do not combine 1-second samples
from a single call as independent calls or average percentiles from different
workloads. Report distributions per condition and repeat-run variability.

## References

[1] ISO/IEC 25010:2023, Product quality model.
https://www.iso.org/standard/78176.html

[2] Google, Web Vitals. https://web.dev/articles/vitals

[3] Grafana, k6 Thresholds.
https://grafana.com/docs/k6/latest/using-k6/thresholds/

[4] W3C, Identifiers for WebRTC Statistics API.
https://www.w3.org/TR/webrtc-stats/
