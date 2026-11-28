# AI summary grounding: evidence-linked claims — 28 November 2026

## Problem

A production draft stated "Patient reported having malaria" during a test
consultation with Taglish speech. Whether the word came from speech
recognition (for example Tagalog *malala*, "serious", misheard) or from the
model could not be checked: production Firebase credentials are not
available locally, and transcript text is not printed under the data rules.
The design therefore had to stop both paths. Before this change the pipeline
had strong prompt rules (no invented diagnoses, temperature 0, strict JSON),
but **nothing verified the output against the transcript**.

## Pattern: evidence-linked summarization with deterministic verification

Ambient clinical-documentation tools link every generated statement to the
transcript passage it came from ("linked evidence") so a clinician can audit
it. We adopt the same idea and add a server-side check the model cannot
bypass (`lib/ai/claim-verification.ts`):

1. Transcript lines are numbered and speaker-labelled for the model
   (`L3 [Patient] …`, unlabelled browser speech notes as
   `[Speaker not identified]`).
2. The strict JSON schema returns every summary sentence, key point,
   recommendation and follow-up as `{text, speaker, kind, term, evidence:
   [{line, quote}]}`.
3. The server keeps a statement only if at least one quote occurs, as whole
   words (case, spacing and punctuation insensitive), in the cited line, and
   that line's speaker does not contradict the statement's speaker.
4. **Verbatim rule for high-stakes entities:** when `kind` is
   `condition_or_diagnosis`, `medication` or `test_or_measurement`, the `term`
   must appear verbatim in both the statement and one verified quote.
   Translation, correction or inference of a condition, drug or test name is
   rejected. Everyday symptoms may still be translated from Taglish, and the
   original words stay visible as the source.
5. Recommendations and follow-ups must rest on the doctor's words.
6. The narrative is rebuilt from verified sentences only, so prose cannot
   carry an unsupported claim. If nothing verifies, the deterministic
   insufficient-evidence record is stored instead of an AI draft
   (`aiSummarySkippedReason: no_verifiable_claims`). Risk stays `Unknown`
   unless a key point verifies.
7. Verified statements are stored with their sources (`claimEvidence`) and
   shown in history under **Sources for AI statements**: statement, speaker,
   line and quote, with a note that recognition can mishear words.
   `metadata.claimVerification` records proposed/verified/dropped counts.

Tradeoffs: drafts become shorter, because uncited prose is dropped; that is
intended. A model could still mislabel a condition as a `symptom` to avoid the
verbatim rule. The quote is then still shown to the clinician, and review
remains required. Verification proves the words were in the recognized
transcript, not that recognition was correct. Speech-recognition accuracy for
Taglish needs the paired-script evaluation described in the panel Q&A.

Legacy summaries keep their stored text and project an empty source list; no
migration was run. Regenerating a summary (not a `reviewed` one) applies the
new verification.

Tests: `tests/claim-verification.test.mjs` (the malaria-from-*malala* case,
whole-word matching, speaker contradiction, doctor-only recommendations,
verbatim medication names, null result, defensive parsing of stored evidence).

## Abstain when the audio is not clear — 28 November 2026

Observed: with music playing in the room, song lyrics were transcribed and
then quoted in a draft ("Patient and doctor did not say any of these"). The
quotes passed verification because the words *were* in the recognized
transcript. Verification cannot catch speech that should never have become
evidence. Both microphones in one room also transcribed the same sentence
twice, once under the wrong speaker.

Pattern: **selective prediction (abstention)**. The system declines to answer
when its input confidence is low, rather than producing a fluent but
unsupported draft. It is applied before the model is called:

1. **Recognition confidence.** Transcription requests token log-probabilities
   (`include[]=logprobs`, supported by `gpt-4o-transcribe`/`-mini`). Each
   segment stores `meanTokenLogprob`. Segments below -1.0 are kept in the
   transcript but excluded from summary evidence. -1.0 is the
   `logprob_threshold` OpenAI Whisper's own decoder uses to reject a segment.
   Legacy segments and models without log-probabilities count as clear.
2. **Prompted rejection of background audio.** The transcription prompt asks
   the model to leave out music, lyrics, TV and radio, and to return nothing
   when no one is speaking.
3. **Crosstalk removal.** A line is dropped when one of the 3 preceding lines
   is from the other speaker and shares ≥60% of its words. The first capture
   is kept.
4. **Abstention rules** (`prepareTranscriptEvidence`). The deterministic "No
   reliable clinical summary could be generated because…" record is stored,
   with no model call, when:
   - at least half the recognized segments were unclear (`unclear_audio`), or
   - speaker-labelled evidence has fewer than 8 words from the doctor or from
     the patient (`one_sided_capture`).

   A consultation summary needs both sides of the conversation.
5. A session that captured participant audio never falls back to the older
   room buffer, even when every segment was unclear.

Tradeoffs:
- A doctor-only dictation, or a call where the patient declined
  transcription, no longer gets an AI draft. The clinician writes the note.
- Confident singing can still pass the confidence floor. The two-party rule,
  claim verification and clinician review remain the backstops.
- Advise participants to turn off music and TV during a consultation.

Metadata records `transcriptUnclearSegments`, `transcriptCrosstalkLines` and
`transcriptEvidenceReason`. Summaries already stored are unchanged;
regenerating a non-reviewed summary applies the gate.

Tests: `tests/transcript-evidence.test.mjs`.
