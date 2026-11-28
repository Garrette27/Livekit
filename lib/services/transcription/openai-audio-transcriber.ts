const OPENAI_TRANSCRIPTION_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-transcribe';
const TRANSCRIPTION_TIMEOUT_MS = 25_000;

/** Bounded provider status only; never retain the upstream audio/error body. */
export class AudioTranscriptionProviderError extends Error {
  constructor(public readonly providerStatus: number) {
    super(`OpenAI audio transcription failed with status ${providerStatus}`);
    this.name = 'AudioTranscriptionProviderError';
  }
}

export interface AudioTranscriptionResult {
  text: string;
  model: string;
  /**
   * Mean log-probability of the returned tokens (0 = certain), or null when
   * the model does not report token log-probabilities. Speech the model heard
   * clearly scores near 0; song lyrics, TV and crosstalk score lower. The
   * summary gate in lib/ai/consultation-evidence.ts owns the threshold.
   */
  meanTokenLogprob: number | null;
}

/** gpt-4o-transcribe and gpt-4o-mini-transcribe report token log-probabilities; whisper-1 does not. */
function reportsLogprobs(model: string): boolean {
  return /^gpt-4o.*transcribe/i.test(model);
}

/** Average of the reported token log-probabilities; null when absent or malformed. */
export function meanLogprob(logprobs: unknown): number | null {
  if (!Array.isArray(logprobs)) return null;
  const values = logprobs
    .map((entry) => Number((entry as { logprob?: unknown })?.logprob))
    .filter((value) => Number.isFinite(value) && value <= 0);
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Transcribes one bounded participant-audio chunk and returns only normalized
 * text. Provider request details and retry policy are intentionally hidden so
 * callers cannot accidentally persist raw audio or provider payloads.
 */
export class OpenAiAudioTranscriber {
  private readonly model: string;

  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL
  ) {
    this.model = model.trim() || DEFAULT_TRANSCRIPTION_MODEL;
  }

  async transcribe(input: {
    audio: Blob;
    filename: string;
  }): Promise<AudioTranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI transcription is not configured');
    }

    const attempt = async (): Promise<Response> => {
      const body = new FormData();
      body.set('model', this.model);
      body.set('response_format', 'json');
      body.set(
        'prompt',
        'Telehealth conversation in Filipino/Tagalog, English, or Taglish. Transcribe exactly as spoken, preserve medical terms and names, and do not translate or add content. Transcribe only a person speaking to the other participant; leave out background music, song lyrics, TV, radio and other background audio, and return nothing if no one is speaking.'
      );
      if (reportsLogprobs(this.model)) body.append('include[]', 'logprobs');
      body.set('file', input.audio, input.filename);

      return fetch(OPENAI_TRANSCRIPTION_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body,
        signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
      });
    };

    let response: Response;
    let transportRetried = false;
    try {
      response = await attempt();
    } catch (firstError) {
      transportRetried = true;
      console.warn('OpenAI audio transcription request failed; retrying once.');
      try {
        response = await attempt();
      } catch {
        throw firstError;
      }
    }

    // A transport retry already consumed the budget. Keep at most two
    // 25-second attempts inside the route's 60-second execution limit.
    if (isTransientStatus(response.status) && !transportRetried) {
      console.warn('OpenAI audio transcription returned a transient status; retrying once:', response.status);
      response = await attempt();
    }
    if (!response.ok) {
      throw new AudioTranscriptionProviderError(response.status);
    }

    const payload = (await response.json()) as { text?: unknown; logprobs?: unknown };
    return {
      text: typeof payload.text === 'string' ? payload.text.trim() : '',
      model: this.model,
      meanTokenLogprob: meanLogprob(payload.logprobs),
    };
  }
}
