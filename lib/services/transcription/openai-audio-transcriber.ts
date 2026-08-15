const OPENAI_TRANSCRIPTION_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-transcribe';
const TRANSCRIPTION_TIMEOUT_MS = 25_000;

export interface AudioTranscriptionResult {
  text: string;
  model: string;
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
        'Telehealth conversation in Filipino/Tagalog, English, or Taglish. Transcribe exactly as spoken, preserve medical terms and names, and do not translate or add content.'
      );
      body.set('file', input.audio, input.filename);

      return fetch(OPENAI_TRANSCRIPTION_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body,
        signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
      });
    };

    let response: Response;
    try {
      response = await attempt();
    } catch (firstError) {
      console.warn('OpenAI audio transcription request failed; retrying once.');
      try {
        response = await attempt();
      } catch {
        throw firstError;
      }
    }

    if (isTransientStatus(response.status)) {
      console.warn('OpenAI audio transcription returned a transient status; retrying once:', response.status);
      response = await attempt();
    }
    if (!response.ok) {
      throw new Error(`OpenAI audio transcription failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { text?: unknown };
    return {
      text: typeof payload.text === 'string' ? payload.text.trim() : '',
      model: this.model,
    };
  }
}
