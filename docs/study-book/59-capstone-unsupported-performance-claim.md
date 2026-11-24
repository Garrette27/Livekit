# 59. Capstone: the call connects but the thesis claim is unsupported

## Separate achievement from inference

A fictional defense rehearsal shows a clinician and patient connected in the browser. They exchange a greeting and a chat message. The slide says, “The system supports reliable low-latency consultations at scale and reduces clinician documentation time.” The demonstration is useful evidence of one successful interaction, but it does not establish all three claims. Your task is not to dismiss the demonstration. It is to preserve what it proves, identify the missing measurements, and design a feasible study without inventing a dataset.

Write the claims separately. Connection success asks whether the intended participants could join under the access policy. Media quality asks what happened to audio and video during a declared observation interval. Capacity asks how outcomes change as simultaneous load increases under specified conditions. Efficiency asks how long a real reviewer takes to produce acceptable documentation compared with a baseline. Each claim needs its own unit of observation, protocol and acceptance rule.

The existing thesis prototype has security and regression evidence, historical deployment observations and proposed performance protocols. This book does not promote those protocols into completed experiments. In particular, an HTTP request returning quickly is not a WebRTC media-latency measurement, and one connected pair is not a concurrent-call capacity study. A failed optional AI entitlement is not evidence that the core call is insecure, but it can prevent an efficiency experiment requiring generated drafts.

## Design the smallest meaningful media run

Use isolated staging, synthetic participants and a fixed software revision. Identify device models or relevant hardware classes, browser versions, network arrangement, media settings, region and time interval. Record the room and participant labels without publishing invitation secrets. Decide whether the run is a functional smoke check or a measurement session. A smoke check can establish that both intended endpoints exchanged media; a measurement session needs a stable collection method and predefined metrics.

For transport observations, select the actual LiveKit peer connection, not an unrelated ChatGPT or browser tab connection. Record selected candidate-pair RTT with its unit, inbound packet counters, jitter, received frame rate and relevant resolution information. Keep audio and video streams distinct. If a counter resets after reconnection, begin a new interval or mark the affected delta invalid. Do not smooth a negative delta into an apparently excellent result.

Suppose a fictional sample has a selected-pair RTT of zero point zero eight seconds. Convert it to eighty milliseconds and label it a round trip. Do not call it forty milliseconds of one-way audiovisual latency by dividing it in half. The forward and reverse paths may differ, and capture, encoding, buffering, decoding and rendering add their own delays. A glass-to-glass claim requires an appropriate synchronized observation method and its uncertainty, not an algebraic relabeling of RTT.

Choose a sampling interval and retain the raw numeric samples needed to reproduce calculations, with sensitive fields removed. A spreadsheet containing only one average is difficult to audit. Preserve run identifiers, valid sample counts, dropped intervals and reasons. State whether a summary statistic describes per-stream samples, per-call summaries or all pooled observations. Pooling can give a long run disproportionate influence if the experimental unit is supposed to be the call.

## Capacity is a controlled change in load

Capacity cannot be inferred from the number of historical encounter documents because those records may represent different times, reconnects or incomplete visits. Define simultaneous load operationally. Five doctor-patient pairs mean ten connected clients if each pair has exactly two clients. If observers or screen shares are present, document them. Fixed media settings make comparisons interpretable, though adaptive behavior should still be reported rather than hidden.

A modest proposed progression is one pair, then three pairs, then five pairs, with an explicit duration and resource budget at each level. This is a feasible thesis protocol, not a promised platform limit. Set stop conditions for participant disruption, quota pressure, provider refusal, excessive failures or a predetermined budget. Do not keep increasing load until production breaks. A safe study can report a tested range without claiming the maximum possible capacity.

Repeat runs when feasible and include unsuccessful starts. A chart containing only successfully connected calls underestimates failure. Record attempted pairs, completed joins, disconnects, recoveries and excluded runs with reasons. If one level is tested on a different network or browser version, treat that as a condition change rather than attributing every difference to load. Repetition cannot remove a confound that is perfectly aligned with the experimental condition.

## Documentation efficiency needs a human outcome

An AI route's response time is not clinician documentation time. The meaningful workflow includes producing a draft, reading it, correcting unsupported statements, adding necessary information and accepting the final note. A fast draft that requires extensive repair may save no time. A delayed draft may still help if review is much faster, but that is an empirical question. The study must include quality criteria so speed does not reward incomplete or unsafe notes.

Use synthetic cases and a participating clinician or appropriately qualified reviewer. Compare manual documentation with assisted documentation under a counterbalanced order when practical. Measure the same start and finish definitions for both conditions. Include review and editing time in the assisted condition. Keep the case evidence equivalent and avoid letting the reviewer memorize one case before repeating it in the other condition. Report the sample and recruitment limitations honestly.

If AI credits or provider entitlement are unavailable, do not fabricate generated outputs or quietly substitute a different tool and call it the same system. Mark the assisted condition blocked or not tested, and preserve the functional observation that calls can continue with optional transcription off. A manually prepared teaching example can illustrate the rubric, but it is not a measured product output. Labeling that difference protects the thesis from an avoidable validity problem.

## Write a defensible results paragraph

A careful rehearsal statement might say: “The demonstration established that one synthetic clinician-patient pair joined and exchanged media and chat under the tested configuration. Automated local tests covered the listed access and lifecycle invariants. Controlled media latency, simultaneous-call capacity and clinician documentation efficiency were not measured in this session. The following staging protocols define how those outcomes would be evaluated.” This preserves the achievement without overstating it.

If a later authorized study produces results, replace only the affected not-tested fields and link the dataset, revision and method. Do not erase earlier failed baselines. A source update, dependency audit or rule deployment changes a different evidence category. A living verification checklist should say which environment passed, when, against what revision and under what limits. The word “passed” without its object and scope is too vague for a technical defense.

## Exercise and worked answer

You have twelve successful calls from different days, each with a screenshot. Can you claim twelve-call concurrency? No. Concurrency requires overlapping active intervals under a common load condition. The screenshots may support historical use, not simultaneous capacity. Recovering timestamps may improve the observation, but it does not turn an uncontrolled history into the planned capacity experiment.

You have a mean API response time of two hundred milliseconds and a participant says the call felt delayed. Which evidence is wrong? Neither must be wrong. The API request and media path measure different systems. Investigate the actual media stream, device workload and network condition. Disagreement between measurements often reveals a boundary mismatch rather than a dishonest observer.

The capstone ends with a revised claim table and a safe execution plan, not with a manufactured pass. A strong defense explains both what the prototype has demonstrated and what remains unknown. Scientific restraint is an engineering capability: it prevents a convenient number from becoming a decision it cannot support.

## Source trail

Read docs/testing/performance-assessment.md, docs/testing/verification-status.md,
docs/thesis-defense-guide.md and docs/ai-summary-status.md. The W3C WebRTC
statistics definitions govern the meaning of transport fields. All sample
numbers in this chapter are fictional calculations, not production results.
