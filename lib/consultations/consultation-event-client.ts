export type ConsultationEventAction = 'join' | 'leave';

export interface ConsultationEventInput {
  roomName: string;
  action: ConsultationEventAction;
  patientName: string;
  userId?: string | null;
  patientEmail?: string | null;
  duration?: number;
}

interface TrackConsultationRequestBody {
  roomName: string;
  action: ConsultationEventAction;
  patientName: string;
  userId: string;
  patientEmail?: string | null;
  duration?: number;
}

interface TrackConsultationOptions {
  keepalive?: boolean;
}

function normalizeUserId(userId?: string | null): string {
  return userId && userId.trim() ? userId : 'anonymous';
}

function buildBody(input: ConsultationEventInput): TrackConsultationRequestBody {
  return {
    roomName: input.roomName,
    action: input.action,
    patientName: input.patientName,
    userId: normalizeUserId(input.userId),
    patientEmail: input.patientEmail ?? null,
    duration: input.duration,
  };
}

export async function trackConsultationEvent(
  input: ConsultationEventInput,
  { keepalive = false }: TrackConsultationOptions = {}
): Promise<void> {
  const response = await fetch('/api/track-consultation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(input)),
    keepalive,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to track consultation event');
  }
}

export function trackConsultationEventWithBeacon(input: ConsultationEventInput): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  return navigator.sendBeacon('/api/track-consultation', JSON.stringify(buildBody(input)));
}

