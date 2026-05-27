import type { ServiceResult } from '@/lib/services/shared/service-result';

export type ConsultationAction = 'join' | 'leave';

export interface TrackConsultationInput {
  roomName: string;
  action: ConsultationAction;
  patientName: string;
  /** Caller-provided id of the participant; resolved to a patient or 'anonymous'. */
  userId: string;
  patientEmail?: string;
  /** Preferred session id for leave events (e.g. from the client). */
  consultationSessionId?: string;
}

export interface TrackConsultationResult {
  message: string;
  roomName: string;
  action: ConsultationAction;
  consultationSessionId?: string | null;
  durationMinutes?: number;
}

/**
 * Tracks a patient joining/leaving a consultation room: it resolves the
 * patient identity (vs. the room's doctor), opens or closes the consultation
 * session, and on leave triggers reliable finalization + AI summary generation.
 * Doctor self-events are recognized and ignored (presence is tracked elsewhere).
 */
export interface ConsultationTrackingService {
  trackConsultation(input: TrackConsultationInput): Promise<ServiceResult<TrackConsultationResult>>;
}
