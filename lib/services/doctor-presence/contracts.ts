import type { ServiceResult } from '@/lib/services/shared/service-result';

export type DoctorPresenceAction = 'join' | 'leave';

export interface TrackDoctorPresenceInput {
  roomName: string;
  action: DoctorPresenceAction;
  doctorUserId: string;
  doctorName?: string | null;
  doctorEmail?: string | null;
  consultationSessionId?: string | null;
}

export interface TrackDoctorPresenceResult {
  message: string;
  consultationSessionId?: string | null;
  doctorDurationMinutes?: number;
  finalDurationMinutes?: number;
}

/**
 * Tracks doctors joining/leaving a room and accrues per-doctor in-call duration
 * onto the consultation session. Join/leave are idempotent: a duplicate join
 * while already active, or a leave while not active, is reported as success
 * without double-counting time.
 */
export interface DoctorPresenceService {
  trackPresence(input: TrackDoctorPresenceInput): Promise<ServiceResult<TrackDoctorPresenceResult>>;
}
