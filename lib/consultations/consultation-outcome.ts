/**
 * What actually happened in a consultation, decided from evidence rather than
 * from the absence of a transcript.
 *
 * "Nobody came" and "someone came and was never let in" both leave a session
 * with no patient and no conversation, but they are opposite facts: one is a
 * patient no-show, the other is an unmet appointment the practice owns. Calling
 * the second one a no-show misreports the clinic's own service failure, so the
 * two are classified separately and worded differently.
 */
export type ConsultationOutcome =
  | 'attended'
  | 'patient-not-admitted'
  | 'no-show';

export interface ConsultationOutcomeEvidence {
  /** Registered patient bound to the session, if any. */
  patientUserId?: string | null;
  patientEmail?: string | null;
  /** Whether any patient presence transition was recorded for the session. */
  hasPatientPresence: boolean;
  /** Stored transcript lines for the room. */
  transcriptLineCount: number;
  /** People who reached the waiting room for this consultation. */
  waitingRoomParticipantCount: number;
  /** Longest time any of them spent waiting, in minutes. */
  longestWaitMinutes?: number | null;
}

function isKnownIdentity(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() !== 'anonymous';
}

/**
 * Classifies a finished consultation. `attended` means there is something for a
 * language model to summarize; the other two mean there is not, and inventing a
 * clinical narrative for them would be fabrication.
 */
export function classifyConsultationOutcome(evidence: ConsultationOutcomeEvidence): ConsultationOutcome {
  const patientReachedConsultation =
    isKnownIdentity(evidence.patientUserId)
    || Boolean(evidence.patientEmail)
    || evidence.hasPatientPresence
    || evidence.transcriptLineCount > 0;

  if (patientReachedConsultation) {
    return 'attended';
  }

  return evidence.waitingRoomParticipantCount > 0 ? 'patient-not-admitted' : 'no-show';
}

/**
 * The stored record for a consultation with nothing to summarize. Wording is
 * deliberately factual and states who is expected to act next.
 */
export function buildUnattendedSummaryContent(
  outcome: Exclude<ConsultationOutcome, 'attended'>,
  context: { durationMinutes: number; waitingRoomParticipantCount: number; longestWaitMinutes?: number | null }
): {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  category: string;
} {
  const minutesLabel = `${context.durationMinutes} minute${context.durationMinutes === 1 ? '' : 's'}`;

  if (outcome === 'patient-not-admitted') {
    const waitedLabel = context.longestWaitMinutes && context.longestWaitMinutes > 0
      ? ` after waiting ${context.longestWaitMinutes} minute${context.longestWaitMinutes === 1 ? '' : 's'}`
      : '';
    const peopleLabel = context.waitingRoomParticipantCount === 1
      ? 'A patient'
      : `${context.waitingRoomParticipantCount} patients`;

    return {
      summary: `${peopleLabel} reached the waiting room but was never admitted, and left${waitedLabel}. No consultation took place.`,
      keyPoints: [
        'Patient arrived and waited in the waiting room',
        'Patient was never admitted to the consultation',
        'No consultation content to summarize',
      ],
      recommendations: [
        'Contact the patient to apologise and rebook',
        'Check the waiting queue earlier in future sessions',
      ],
      followUpActions: ['Rebook the consultation'],
      category: 'Not Admitted',
    };
  }

  return {
    summary: `No patient joined this consultation. The room was open for ${minutesLabel} with the doctor present.`,
    keyPoints: ['Room opened by doctor', 'No patient joined', 'No consultation content to summarize'],
    recommendations: ['Follow up with the patient to reschedule if this was a missed appointment'],
    followUpActions: ['Confirm the patient received a working invitation link'],
    category: 'No-Show',
  };
}
