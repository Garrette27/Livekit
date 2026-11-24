# 47. Conservative summaries and insufficient-evidence outcomes

## The LiveKit boundary to trace

A structured model response can still be wrong. Schema validation controls
shape, not truth. The summary pipeline therefore needs evidence-quality
gates, conservative instructions, explicit provenance and clinician review.
Operational connection events cannot supply diagnoses, recommendations or a
low-risk conclusion in the absence of clinical evidence.

The system prefers normalized session transcripts and trusted ready
attachment evidence when that future capability is permitted. Empty arrays
and Unknown risk are valid results. Deterministic no-show, never-admitted
and insufficient-evidence outcomes avoid spending a model call merely to
invent a narrative where the application already knows evidence is absent.

## A worked investigation

Prepare synthetic cases with no transcript, a very short transcript,
repetitive fragments and a sufficiently detailed conversation. State the
expected evidence classification before generation. Check that the first
cases follow deterministic conservative branches and that a richer case
still produces a draft requiring review.

Inspect how clinical evidence is bounded and deduplicated. Removing duplicate
recognition fragments can improve the input without pretending that missing
speech was recovered. Preserve speaker labels and source distinctions. A
merged paragraph that loses who said what can defeat a careful prompt even
when every original segment was accurate.

## Exercise with answer

A model returns valid JSON with a confident recommendation not supported by
the transcript. Has structured output succeeded? Shape validation succeeded;
grounding failed. The clinician must correct the draft, and evaluation should
record the unsupported content. Do not report schema compliance as clinical
accuracy.

Why keep deterministic outcomes separate from generated drafts? Their
provenance and uncertainty differ. A no-show record is derived from lifecycle
facts, while a generated draft interprets evidence. Both can be useful in
history, but neither should impersonate a clinician-reviewed clinical note.
Lifecycle vocabulary makes that distinction visible.

## Source trail

Read the consultation-finalization summary generator and
docs/ai-summary-status.md. Model availability, generation speed, factual
grounding and clinician usefulness require separate evidence.
