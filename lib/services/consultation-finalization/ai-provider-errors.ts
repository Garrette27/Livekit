/**
 * The AI provider refused because the account has no usable credit or quota.
 * Unlike a rate limit, waiting does not fix it, so the summary is recorded as
 * `unavailable` (a configuration/entitlement state) and never enters the
 * retry queue, where repeated attempts would only spend Firestore writes.
 */
export class AiProviderQuotaExhaustedError extends Error {
  constructor() {
    super('AI provider quota exhausted');
    this.name = 'AiProviderQuotaExhaustedError';
  }
}

/** OpenAI reports exhausted billing credit as HTTP 429 with this error code. */
export async function isQuotaExhaustedResponse(response: Response): Promise<boolean> {
  if (response.status !== 429) {
    return false;
  }
  try {
    const body = await response.clone().json();
    return body?.error?.code === 'insufficient_quota' || body?.error?.type === 'insufficient_quota';
  } catch {
    return false;
  }
}
