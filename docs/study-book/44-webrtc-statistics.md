# 44. Read WebRTC statistics and compute interval metrics correctly

## The LiveKit boundary to trace

WebRTC statistics describe transport and media observations, not a single
universal latency value. Selected candidate-pair round-trip time is a network
round trip. Inbound jitter is a stream statistic. Delivered frame rate and
resolution concern received media. One-way mouth-to-ear or glass-to-glass
delay needs a separate synchronized capture method if the manuscript claims
that outcome.

Select the LiveKit peer connection for the intended synthetic call. The
earlier pasted diagnostic view selected a ChatGPT peer in a new state, which
could not support a LiveKit call-quality claim. Browser diagnostics may
include unrelated tabs; do not inspect or record them merely because they
appear in the same tool.

## A worked numeric example

Suppose two consecutive inbound samples show packets received rising from
one thousand to one thousand nine hundred ninety and packets lost rising
from ten to twenty. The interval contains nine hundred ninety received and
ten lost packets. Divide lost packets by received plus lost packets and
multiply by one hundred: the interval loss is one percent. Using the entire
lifetime counter instead would answer a different question.

For bitrate, multiply the change in received bytes by eight and divide by
the elapsed seconds. Keep streams and directions separate. Reject counter
resets or negative deltas with a recorded reason rather than forcing them
into a plausible percentage. Convert seconds to milliseconds explicitly for
RTT and jitter fields whose units require it.

## Exercise with answer

Why not download every WebRTC dump and attach it to the thesis? Raw dumps
can contain URLs, credentials, network addresses and unrelated connection
information. Retain pseudonymous run labels and required numeric metrics
instead. Audio and DataChannel recordings are different, more invasive data
collection modes and are unnecessary for ordinary transport-statistics work.

A call shows low RTT but poor video. What alternatives remain? Bandwidth,
packet loss, jitter, encoding/decoding work, resolution adaptation, rendering
and device limitations can affect experience. The next check should
discriminate these possibilities rather than declaring low RTT proof of
excellent audiovisual quality.

## Prepare a minimal transport worksheet

Create a worksheet with run label, relative sample time, connection label, stream identifier, direction and metric name. Preserve units in the column headings. Do not mix lifetime counters with interval rates in one unlabeled column. A received-byte count is cumulative state; bitrate is calculated from a change over time. A jitter value is not a lost-packet count. The worksheet should make these distinctions obvious before any chart is drawn.

Use two consecutive samples from the same stream and connection generation. Suppose bytes received rise from five hundred thousand to seven hundred thousand over two seconds. The difference is two hundred thousand bytes. Multiplying by eight and dividing by two gives eight hundred thousand bits per second. This is an interval receive rate, not the codec's configured maximum and not the server's total outbound bandwidth. Keep the scope in the result label.

Suppose the next sample comes from a new connection after a restart and its byte counter is lower. Do not subtract it from the old connection's total. Mark a generation boundary and begin a new interval. The same principle applies when a stream is replaced or its statistics identifier changes. A negative rate is evidence that the continuity assumption failed, not a value to clamp quietly to zero.

## Interpret loss without erasing its assumptions

For an interval loss calculation, use changes in packets lost and packets received under the chosen stream's semantics. State the formula and retain the contributing deltas. If the total interval packet count is zero, the loss percentage is undefined for that interval rather than automatically perfect. Counter corrections or resets can make naive subtraction inappropriate. Record invalid intervals and their reasons instead of forcing every row into a numeric percentage.

Loss alone does not describe perceived quality. A short burst may be more disruptive than the same number of losses spread over time. Concealment, retransmission and buffering can change what a listener experiences. The browser's statistics expose useful mechanisms, but they do not directly certify intelligibility or clinical adequacy. If the thesis claims user-perceived quality, add an appropriate observation or rating protocol and distinguish it from transport statistics.

Frame rate and resolution also need context. Adaptive video can lower resolution to preserve continuity under constrained bandwidth. A lower received resolution is not necessarily a software defect, though it may fail a study's declared requirement. Record both adaptation and user-facing outcomes. A comparison that ignores adaptation can mistake the system's response to a poor network for an unexplained inconsistency.

## Read candidate-pair RTT narrowly

The selected candidate pair describes the active network path at the observed time. Its RTT is a round-trip transport observation. The selected pair can change during a session, so retain the path-generation context without publishing raw addresses. A run that moves from a direct path to a relay should not be summarized as though every sample used one unchanged condition. The change may be relevant to both latency and reliability.

Do not disable certificate checks, open arbitrary ports or expose credentials to make a diagnostic capture easier. The purpose of the lab is to observe the intended secure path. If staging cannot establish that path, record the configuration blocker. A technically successful insecure workaround would measure a different system and undermine the security argument accompanying the performance result.

Browser diagnostic pages can include other tabs and incognito activity. Select only the intended synthetic call. Avoid enabling audio or DataChannel message recording for a transport-statistics study. Those modes collect substantially different information and need their own consent, retention and handling plan. A dump export should be reviewed for secrets and network identifiers before it leaves the local machine; a masked metric extract is usually a better thesis artifact.

## Work from observations toward hypotheses

Consider three fictional runs. The first has stable RTT but low video frame rate and a busy receiving device. The second has increasing RTT and loss under constrained bandwidth. The third has a brief disconnect followed by a new candidate pair and recovery. They may all be described by a user as “lag,” but their next diagnostic experiments differ. The first suggests examining decode or rendering workload; the second suggests the network path and bandwidth; the third suggests recovery behavior and path changes.

Those are hypotheses, not automatic diagnoses. Test one discriminating change at a time. Reduce competing device workload for the first case, use a controlled network condition for the second, and repeat a bounded reconnection schedule for the third. Preserve the original observation and explain what the new result rules out. Avoid changing codec, browser, network and source revision simultaneously, because any improvement would then have several plausible causes.

An independent answer should include the metric definitions, sampling continuity rules, invalid-interval policy and privacy handling. It should also state what the worksheet cannot prove: synchronized one-way media delay, maximum platform capacity or clinician efficiency. Correct calculations are necessary, but the larger skill is preventing a valid number from being assigned an invalid meaning.

## Source trail

Use docs/testing/performance-assessment.md and the W3C WebRTC Statistics API
reference named there. These numeric examples are fictional worked
calculations, not samples collected from the production application.
