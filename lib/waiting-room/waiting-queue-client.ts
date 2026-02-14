import { AdmitPatientResponse, WaitingPatient } from '@/lib/types';

interface WaitingRoomListResponse {
  success: boolean;
  waitingPatients?: WaitingPatient[];
  error?: string;
}

interface WaitingRoomMutationResponse {
  success: boolean;
  error?: string;
}

interface ListWaitingPatientsArgs {
  roomName?: string;
  doctorUserId?: string;
  statuses?: Array<'waiting' | 'admitted' | 'left' | 'rejected'>;
}

function toTimestampMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof maybeTimestamp.toMillis === 'function') {
      return maybeTimestamp.toMillis();
    }
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().getTime();
    }
  }

  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  return parsed.getTime();
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response but received status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function listWaitingPatients({
  roomName,
  doctorUserId,
  statuses,
}: ListWaitingPatientsArgs): Promise<WaitingRoomListResponse> {
  const params = new URLSearchParams();
  if (roomName) {
    params.set('roomName', roomName);
  }
  if (doctorUserId) {
    params.set('doctorUserId', doctorUserId);
  }
  if (Array.isArray(statuses) && statuses.length > 0) {
    params.set('statuses', statuses.join(','));
  }

  const query = params.toString();
  const endpoint = query ? `/api/waiting-room/list?${query}` : '/api/waiting-room/list';
  const response = await fetch(endpoint);
  const result = await parseJsonResponse<WaitingRoomListResponse>(response);

  const waitingPatients = [...(result.waitingPatients || [])].sort((a, b) => {
    return toTimestampMillis(a.joinedAt) - toTimestampMillis(b.joinedAt);
  });

  return {
    ...result,
    waitingPatients,
  };
}

export async function admitWaitingPatient(
  waitingPatientId: string,
  roomName: string,
  doctorUserId?: string
): Promise<AdmitPatientResponse> {
  const response = await fetch('/api/waiting-room/admit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ waitingPatientId, roomName, doctorUserId }),
  });

  return parseJsonResponse<AdmitPatientResponse>(response);
}

export async function rejectWaitingPatient(
  waitingPatientId: string,
  doctorUserId?: string
): Promise<WaitingRoomMutationResponse> {
  const response = await fetch('/api/waiting-room/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ waitingPatientId, doctorUserId }),
  });

  return parseJsonResponse<WaitingRoomMutationResponse>(response);
}
