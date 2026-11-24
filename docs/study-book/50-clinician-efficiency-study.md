# 50. Measure documentation efficiency with an actual reviewer

## The LiveKit boundary to trace

Model response time is not clinician time saved. A generated draft can be
fast and still require extensive review, correction or reconstruction.
Documentation efficiency compares the entire relevant workflow against a
defined baseline using the same case material and an appropriate reviewer.
Clinical usefulness and factual quality must accompany the time comparison.

The protocol proposes paired manual and AI-assisted documentation on
deidentified or synthetic cases with counterbalanced order. Record manual
documentation time, generation delay and clinician review/correction time.
Account for familiarity: doing the manual note first can make the later
assisted task easier even when the tool adds no genuine benefit.

## A worked study design

Choose a fixed case set and define what counts as a completed acceptable note.
Prepare a rubric for factual omissions, unsupported additions and necessary
corrections. Have the reviewer complete both workflows under the agreed order
design. Preserve timing and rubric outcomes using pseudonymous case labels,
not raw patient material in a public appendix.

Report paired differences and uncertainty appropriate to the sample. Do not
combine a provider latency pilot from one environment with a clinician task
from another and call the subtraction measured savings. If AI entitlement is
unavailable, record that limitation and conduct only the portions that remain
authorized and meaningful.

## Exercise with answer

A draft takes ten seconds to generate and two minutes to correct; a manual
note takes ninety seconds. Did the assistant improve efficiency for that
trial? Not under a workflow measure that includes generation and correction.
The result may still teach something about quality or a different task, but
it does not support the desired time-saving claim.

What if only students, not clinicians, participated? Describe the convenience
sample honestly and limit generalization. Their usability observations can
be useful without being representative evidence of clinician efficiency or
clinical safety. Methodological honesty makes the thesis more defensible,
not less valuable.

## Define the task a clinician actually completes

The assisted task is not “wait for a model response.” It is producing an acceptable consultation note from the available evidence. Define the start event, final acceptance event and quality rubric before timing. Include reading, correction and review in the assisted condition. Include equivalent evidence access in the manual condition. If the assisted workflow receives a prepared structured transcript while the manual workflow receives only an audio recording, the comparison changes more than the documentation tool.

Use synthetic cases to avoid exposing patient information and to control evidence. Each case should have a known set of supported facts and deliberate unknowns. Include an insufficient-evidence case so the system is not rewarded for inventing a complete-looking note. A qualified reviewer should judge factual support, completeness relative to the supplied evidence, unsupported statements and required corrections. The rubric should reward conservative uncertainty where evidence is absent.

## Counterbalance learning and order effects

If every participant writes manually first and uses assistance second, familiarity with the cases can look like a tool benefit. Counterbalance order where feasible and use comparable cases rather than simply repeating one memorized case. Record the assignment procedure. A small convenience sample can still provide exploratory evidence, but it does not establish broad clinical effectiveness across specialties or institutions. State recruitment and sample limitations plainly.

Training also matters. Give participants enough orientation to operate both workflows, then keep the measured task separate from learning the interface. Document what assistance or clarification the facilitator may provide. If the facilitator repairs every generated draft during the assisted condition, the measured time no longer represents the clinician's independent workflow. Preserve deviations and explain them rather than hiding them in an aggregate.

Record the actual elapsed task times with a consistent clock method. Pauses, interruptions and technical failures need predefined handling. A provider outage should not silently disappear from the dataset, but it may require a separate availability category rather than an artificial note-completion time. Keep attempted tasks, completed tasks and excluded tasks visible. The unit of comparison should remain the participant-case task or another explicitly defined unit.

## Quality and speed must be interpreted together

Suppose the assisted condition is faster but produces more unsupported recommendations. That is not an uncomplicated efficiency improvement. The task's acceptance criteria must include evidence-grounded quality. Conversely, a careful reviewer may spend longer correcting one difficult draft while benefiting on other cases. Preserve per-case patterns rather than compressing every outcome into a single percentage. A useful report explains where assistance helps, where it creates work and where it is unavailable.

Distinguish generated content from clinician-added content in the analysis where the protocol permits it. A clinician may appropriately add reasoning that was not in the transcript, but that does not mean the AI generated it accurately. The product's summary grounding requirement concerns the machine output's evidence. The final clinical note may include human judgment under a different provenance. Conflating them exaggerates model performance and erases the clinician's contribution.

Use fictional examples in the rubric. If the evidence says that a symptom was not discussed, an empty field or explicit unknown can be correct. If a draft fills the gap with a plausible diagnosis, mark that as unsupported even if it sounds professional. A short consultation or poor recognition must not be interpreted as low risk. The quality study should therefore include both factual omissions and hallucinated additions, not only grammar and readability.

## Handle unavailable AI honestly

The earlier provider-credit limitation means the assisted workflow may be unavailable under the current entitlement. Do not spend paid credits or substitute another provider without authorization. The proper status is blocked or not tested for the affected condition. You can still prepare cases, timing sheets and the review rubric, and verify that the core call works with transcription off. Preparation is progress, but it is not a completed efficiency result.

A manually authored example summary can teach the rubric if labeled as a teaching artifact. It cannot be counted as an output of the deployed AI workflow. Likewise, a local mock can test status transitions and review protection without measuring generation quality or provider latency. The report should separate software correctness evidence from human-study evidence so readers can see what remains unknown.

## A transparent analysis plan

For paired tasks, report the relevant paired differences and the number of completed pairs rather than comparing unrelated totals. Describe the summary statistics and uncertainty method selected for the sample. Avoid implying statistical certainty from a tiny convenience sample. Qualitative comments can explain friction and trust, but they should not be converted into invented numeric benefit. Keep survey responses, interview observations and task timings as distinct evidence types.

An independent exercise asks you to evaluate this claim: “The model returned in five seconds, so doctors save five minutes.” The missing elements include the manual baseline, assisted review time, note quality, participant sample, case comparability and actual measured difference. The provider response time is one component of the assisted workflow. It cannot supply the absent human outcome by arithmetic or enthusiasm.

The completed study should leave a reproducible protocol, de-identified task data, rubric decisions, deviations and a bounded conclusion. A result that finds no clear time saving can still be valuable if it identifies review burden or evidence-quality problems. The thesis passes through honest method and defensible interpretation, not through guaranteeing that every optional feature improves every outcome.

## Source trail

Read docs/testing/survey-and-interview-protocol.md and the performance
assessment. No reviewer results are invented in this book; proposed task
examples must remain labelled as exercises until actual data is collected.
