import type { ServiceResult } from '@/lib/services/shared/service-result';

/**
 * Why a consultation is being finalized. Drives how the effective end time is
 * resolved (see resolveEffectiveSessionEndedAt) and is recorded on the summary.
 *
 * - patient_left:          reliable client-driven leave (track-consultation).
 * - patient_left_webhook:  LiveKit participant_left backstop.
 * - room_finished_webhook: LiveKit room_finished backstop.
 * - doctor_left / invitation_revoked / invitation_expired: doctor-side endings.
 */
export type FinalizationReason =
  | 'doctor_left'
  | 'invitation_revoked'
  | 'invitation_expired'
  | 'patient_left'
  | 'patient_left_webhook'
  | 'room_finished_webhook';

export interface FinalizeConsultationInput {
  roomName: string;
  finalizedAt: Date;
  reason: FinalizationReason;
  /**
   * When true, only an 'active' session is finalized. Webhook/backstop callers
   * pass false so an already-completed session is still picked up and its
   * summary generated (summary writes stay idempotent internally).
   */
  requireActiveSession?: boolean;
  /** When true (default), (re)generate the AI summary as part of finalization. */
  regenerateSummary?: boolean;
}

export interface FinalizationResult {
  consultationSessionId: string;
  finalDurationMinutes: number;
}

export interface GenerateConsultationSummaryParams {
  roomName: string;
  patientName: string;
  durationMinutes: number;
  userId: string;
  consultationSessionId?: string | null;
  /**
   * Conversation transcript lines. When omitted, the generator loads stored
   * transcript text from the `calls/{roomName}` document so summaries include
   * conversation context regardless of which path triggered finalization.
   */
  transcriptionData?: string[] | null;
  patientUserId?: string | null;
  patientEmail?: string | null;
}

/**
 * Single owner of "consultation session ended -> stored AI summary". All
 * lifecycle entry points (client leave, LiveKit webhook backstop, invitation
 * revoke/expire, history rebuild) route through this so finalization is
 * consistent and summary generation is reliable rather than webhook-dependent.
 */
export interface ConsultationFinalizationService {
  finalizeConsultation(input: FinalizeConsultationInput): Promise<ServiceResult<FinalizationResult | null>>;
}
