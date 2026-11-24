# 46. Transcript consent, provenance and speaker attribution

## The LiveKit boundary to trace

Transcription is optional work around the call, not a prerequisite for
consultation access. Each participant explicitly opts in before the capture
path starts. Temporary audio is sent for transcription and discarded;
persisted text needs provenance and session binding. The browser speech-notes
fallback is labelled separately and starts only after clinician confirmation
of verbal patient consent.

Speaker attribution matters because identical words can mean different things
depending on who said them. A doctor's hypothetical question must not become
a patient's reported symptom. A transcript segment therefore needs its
session context and evidence source, not just a paragraph of text gathered
from whichever microphone happened to be available.

## A worked investigation

With synthetic dialogue and no real clinical material, test consent off and
on as separate cases. When off, the call should still complete and the
optional capture path should not upload audio. When enabled in an approved
fixture, inspect the session and speaker binding without preserving raw
audio in the study package. A friendly checkbox label is not proof that the
capture adapter obeys it.

Now interrupt the provider. The UI should explain that transcription paused
without breaking the working call. A retry or unavailable branch should not
silently substitute browser notes as though they were a complete transcript.
The evidence source must remain visible to later summary generation and
clinician review.

## Exercise with answer

A short recognition result contains repeated fragments. Should the summary
generator fill in likely clinical content? No. Repetition and sparse evidence
should reduce the evidence available, not invite inference. The application
can preserve a truthful insufficient-evidence outcome while the underlying
consultation remains a valid operational event.

Why distinguish audio disposal from text retention? Deleting temporary audio
does not delete persisted transcript text, logs, summaries or provider-side
records governed by separate policy. Consent and retention explanations must
describe the actual data classes. Avoid the vague promise that nothing is
stored if any derived clinical text survives.

## Source trail

Read the session-transcription route, SessionTranscriptionBridge and the
doctor speech-capture hook. The book does not enable recording or authorize
provider calls; demonstrations must use explicit participant choices and
synthetic dialogue.
