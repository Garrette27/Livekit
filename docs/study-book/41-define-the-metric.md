# 41. Define a metric before collecting numbers

## The LiveKit boundary to trace

A measurement starts with an operational definition. Page response, first
render, successful authentication, admission, first remote frame and clinician
completion are different events. Give each a start, an end, a unit and an
interpretation. The question determines the instrument; a convenient
instrument must not silently redefine the question.

The performance protocol separates browser quality, authenticated API work,
WebRTC media, capacity and documentation efficiency. Its proposed thresholds
are project engineering budgets, not universal medical requirements. Freeze
the intended threshold and sampling plan before collecting the main dataset.
If the plan changes, record an amendment rather than selecting the method
that makes the current numbers look best.

## A worked measurement design

For admission-to-media time, specify the admission event and require both
endpoints to receive the expected media. Record synthetic run identity,
device, browser, network condition and any shaping. Do not start one run at
button click and another at server response while calling both the same
metric. The unexplained change can dominate the result.

For a percentile, retain the sample set and derivation rule. The earlier
HTTP pilot used ten sequential observations per page, making nearest-rank
p95 equal to the maximum. That is an exploratory result, not a robust
population estimate. Connection reuse and caching were part of its conditions;
the samples were not independently controlled cold starts.

## Exercise with answer

Someone reports an average of several p95 values as the system's p95. Why is
that generally misleading? Percentiles describe ordered observations within
a workload. Averaging summaries loses the distribution and can hide different
conditions. Report per-condition distributions or compute an explicitly
justified aggregate from the underlying observations.

Now distinguish absence of failures from proof of reliability. A short run
with no disconnects establishes that none were observed during that run.
It does not establish a year-long availability guarantee. Choose duration,
repetitions and failure definitions appropriate to the claim. A narrow honest
result is useful; a broad unsupported guarantee is not improved by more
decimal places.

## Turn an adjective into an operational definition

“Fast” is not yet a metric. The patient may mean that the invitation opens quickly, that admission appears promptly, that remote speech is not delayed or that a summary becomes available soon after the call. Each outcome crosses different boundaries. Write the start event, finish event, unit and population before choosing a tool. Otherwise the easiest available timing will quietly become the answer to a different question.

For invitation opening, a browser navigation timing may be relevant. For admission freshness, compare the committed admission with the patient's observed transition under a controlled clock or correlated run. For API latency, define whether the interval includes DNS, connection establishment, authentication refresh, retries and response parsing. For media, transport RTT and end-to-end audiovisual delay remain distinct. For documentation, include clinician review and correction rather than only provider generation.

Choose an experimental unit. It might be a request, a participant join, a call pair, a run at a specified load or a clinician completing one case. Samples collected every second within one call are not automatically independent calls. If you pool every sample from every run, a long run receives more weight than a short one. That may be appropriate for a time-weighted operational metric, but it differs from comparing per-call summaries. State which question the aggregation answers.

## Define inclusion and failure before looking at results

Decide what happens to unsuccessful attempts. A latency table containing only responses that returned successfully can conceal timeouts and denied operations. Keep success rate, failure categories and latency together. Do not assign a timeout an arbitrary fast value or drop it silently. If a run is excluded because the test device failed, document that rule and preserve the excluded run's label and reason.

Warm and cold conditions also matter. A first request may initialize server dependencies, obtain credentials or populate caches. Later requests may reuse connections and compiled code. Neither is inherently the “real” result; users encounter both kinds of state. Measure and label them separately when the distinction affects the claim. A tiny cached public-page pilot cannot establish authenticated API latency, much less media performance.

Record environmental conditions that could change interpretation: source and deployment identity, browser version, device class, network arrangement, region, media settings, load and observation duration. Do not collect identifying information merely to make the table look thorough. Pseudonymous run labels and relevant technical configuration are usually enough. The smallest sufficient dataset is easier to protect and easier to audit.

## Work through a fictional distribution

Suppose ten synthetic request durations, in milliseconds, are one hundred, one hundred ten, one hundred twenty, one hundred thirty, one hundred forty, one hundred fifty, one hundred sixty, one hundred seventy, one hundred eighty and one thousand. The mean is higher than the central cluster because the final observation is much slower. The median describes a different property. Neither number alone tells you whether that slow observation was a cold start, retry or unrelated test disturbance.

A percentile also depends on the estimator, especially with a small sample. State the method instead of presenting a software-generated value as uniquely correct. More importantly, do not report a precise-looking ninety-ninth percentile from a handful of requests as though it characterizes a large operational population. Keep sample size and uncertainty visible. The goal is a defensible description, not the most impressive decimal places.

Now imagine one additional request times out. The ten successful durations do not become false, but they are incomplete as a reliability account. Report the attempted and successful counts and the timeout threshold. A performance acceptance rule might require both a bounded failure rate and a latency distribution under the declared workload. Those thresholds should come from the study's requirements, not be chosen afterward to fit the observed data.

## Distinguish diagnosis from acceptance

An exploratory measurement can help find a bottleneck without satisfying a thesis acceptance criterion. For example, a local profile may show repeated serialization work and justify a focused optimization. A staging comparison can then test whether the change improves the relevant outcome. Do not describe the exploratory profile as a capacity pass. Conversely, an acceptance run may reveal failure without identifying the cause; follow-up diagnosis needs a narrower experiment.

Use a before-and-after comparison that holds important conditions constant. Record the source revisions and confirm that both runs exercise the same functional path. If the “after” version disables a security check or skips necessary data, a faster duration is not a valid improvement. Performance must preserve the product's correctness and privacy invariants. The efficient system is one that does the required work with less unnecessary cost, not one that silently stops doing required work.

For an independent exercise, rewrite “the application is efficient” into three testable claims. One could concern hidden-page request suppression, another visible queue freshness, and another clinician documentation time. Give each a unit, population, protocol and limit. Then state which available tools can measure it and what additional participant or environment is required. This exercise turns a vague thesis adjective into a practical evidence plan.

## Source trail

Read docs/testing/performance-assessment.md and remaining-experiments.md.
The book's worked calculations are training examples. They must not be
entered into Chapter IV as measured production outcomes.
