# AI transcription and summary status

Status as of 18 November 2026: **unavailable — no OpenAI credit.** This is
accepted for now. The consultation itself (invitation, waiting room, admission,
audio/video, chat, history) does not depend on AI and keeps working.

## What users see

| Feature | Behavior without OpenAI credit |
| --- | --- |
| Live call, waiting room, chat, history | Works normally |
| Consented audio transcription | Each audio chunk is rejected by OpenAI; the room shows transcription as temporarily unavailable; the call continues |
| AI summary after the call | Recorded as **unavailable** with the reason "AI provider quota exhausted"; risk `Unknown`, no invented findings; the doctor documents manually |

Since the 18 November change
(`lib/services/consultation-finalization/ai-provider-errors.ts`), an OpenAI "insufficient_quota"
response is treated as *unavailable*, not as a temporary failure. Before that,
each call was retried, marked `failed` and put in the retry queue, spending
Firestore writes for an error that waiting cannot fix. Deployed to production
in `28b437e`.

## Thesis reporting

- AI-related performance items (PERF07, PERF16, PERF17) and the AI
  documentation evaluation: **BLOCKED — no AI provider credit**. Do not report
  them as passed or failed.
- The behavior itself is evidence for the design: when the AI is unavailable,
  the system says so and does not guess. That supports the "AI is not the
  clinical authority" argument in Chapter III.
- Survey sessions: keep transcription **off** and skip doctor task D6 in
  `docs/testing/survey-and-interview-protocol.md`. Usability results are not
  affected.

## Ways around it

| Option | Cost | Code change | Notes |
| --- | --- | --- | --- |
| 1. Run without AI (current) | Free | None | Recommended for the usability survey |
| 2. Remove `OPENAI_API_KEY` from Vercel while there is no credit | Free | None (Vercel setting, then redeploy) | Summaries become `unavailable` immediately without calling OpenAI; transcription reports "not configured". Also saves Firestore reads, because each transcription chunk is authorized against the database before OpenAI rejects it |
| 3. Add a small prepaid OpenAI credit | A few US dollars (OpenAI's minimum prepaid amount) | None | Enough for the planned 5–10 fictional transcripts of the AI evaluation. Check current model pricing first and set a usage limit in the OpenAI dashboard |
| 4. Clinician-started browser speech recognition | Free | None | Existing, clearly labeled fallback for transcription (Chrome), started only after the doctor confirms verbal patient consent. It produces a transcript but still needs an AI model for the summary |
| 5. Another provider with a free tier (e.g. Google Gemini API) | Free tier with rate limits | Yes: a new provider adapter with the same strict structured output and evidence gates | Free-tier inputs may be used by the provider to improve its products, so use fictional transcripts only. Needs its own regression tests |
| 6. Local open model (e.g. via Ollama) for the offline AI evaluation only | Free | Yes: adapter for local runs | Cannot run on Vercel; results describe that model, not OpenAI |

Recommendation: option 1 for the survey now, option 2 if the key stays
unused for a while, and option 3 shortly before the AI-documentation
evaluation. Options 5 and 6 change what the thesis evaluates (a different
model), so agree them with the adviser first.
