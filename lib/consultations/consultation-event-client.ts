export type ConsultationEventAction = 'join' | 'leave';

export interface ConsultationEventInput {
  /** Signed LiveKit credential proving this participant belongs to the room. */
  accessToken: string;
  roomName: string;
  action: ConsultationEventAction;
  patientName: string;
  userId?: string | null;
  patientEmail?: string | null;
  duration?: number;
  consultationSessionId?: string | null;
}

export interface TrackConsultationEventResponse {
  success: boolean;
  message?: string;
  consultationSessionId?: string | null;
  durationMinutes?: number;
  error?: string;
  details?: string;
}

interface TrackConsultationRequestBody {
  accessToken: string;
  roomName: string;
  action: ConsultationEventAction;
  patientName: string;
  userId: string;
  patientEmail?: string | null;
  duration?: number;
  consultationSessionId?: string | null;
}

interface TrackConsultationOptions {
  keepalive?: boolean;
}

function normalizeUserId(userId?: string | null): string {
  return userId && userId.trim() ? userId : 'anonymous';
}

function buildBody(input: ConsultationEventInput): TrackConsultationRequestBody {
  return {
    accessToken: input.accessToken,
    roomName: input.roomName,
    action: input.action,
    patientName: input.patientName,
    userId: normalizeUserId(input.userId),
    patientEmail: input.patientEmail ?? null,
    duration: input.duration,
    consultationSessionId: input.consultationSessionId ?? null,
  };
}

export async function trackConsultationEvent(
  input: ConsultationEventInput,
  { keepalive = false }: TrackConsultationOptions = {}
): Promise<TrackConsultationEventResponse> {
  const response = await fetch('/api/track-consultation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(input)),
    keepalive,
  });

  let result: TrackConsultationEventResponse | null = null;
  try {
    result = (await response.json()) as TrackConsultationEventResponse;
  } catch {
    result = null;
  }

  if (!response.ok) {
    const errorMessage =
      result?.error || result?.details || 'Failed to track consultation event';
    throw new Error(errorMessage);
  }

  return result || { success: true };
}

export function trackConsultationEventWithBeacon(input: ConsultationEventInput): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  return navigator.sendBeacon('/api/track-consultation', JSON.stringify(buildBody(input)));
}
