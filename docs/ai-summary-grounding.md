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
