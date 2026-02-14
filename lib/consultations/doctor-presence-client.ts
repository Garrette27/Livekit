export type DoctorPresenceAction = 'join' | 'leave';

export interface DoctorPresenceEventInput {
  roomName: string;
  action: DoctorPresenceAction;
  doctorUserId: string;
  doctorName?: string | null;
  doctorEmail?: string | null;
  consultationSessionId?: string | null;
}

export interface TrackDoctorPresenceResponse {
  success: boolean;
  message?: string;
  consultationSessionId?: string | null;
  doctorDurationMinutes?: number;
  error?: string;
  details?: string;
}

function buildPayload(input: DoctorPresenceEventInput) {
  return {
    roomName: input.roomName,
    action: input.action,
    doctorUserId: input.doctorUserId,
    doctorName: input.doctorName || null,
    doctorEmail: input.doctorEmail || null,
    consultationSessionId: input.consultationSessionId || null,
  };
}

export async function trackDoctorPresenceEvent(
  input: DoctorPresenceEventInput,
  options: { keepalive?: boolean } = {}
): Promise<TrackDoctorPresenceResponse> {
  const response = await fetch('/api/track-doctor-presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(input)),
    keepalive: options.keepalive === true,
  });

  let payload: TrackDoctorPresenceResponse | null = null;
  try {
    payload = (await response.json()) as TrackDoctorPresenceResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.details || 'Failed to track doctor presence');
  }

  return payload || { success: true };
}
