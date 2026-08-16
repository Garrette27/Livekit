import { createHash } from 'crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const SESSION_COLLECTION = 'consultationSessions';
const SEGMENT_COLLECTION = 'transcriptSegments';
const MAX_SUMMARY_SEGMENTS = 2_000;

export type TranscriptSpeakerType = 'doctor' | 'patient';

export interface ConsultationTranscriptSegmentInput {
  consultationSessionId: string;
  participantIdentity: string;
  participantName: string;
  speakerType: TranscriptSpeakerType;
  captureId: string;
  sequence: number;
  capturedAt: Date;
  durationMs: number;
  text: string;
  model: string;
}

export interface ConsultationTranscriptAppendResult {
  inserted: boolean;
  revision: number;
  sessionStatus: string | null;
}

export interface ConsultationTranscriptEvidence {
  lines: string[];
  revision: number;
  segmentCount: number;
}

function toMillis(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function buildSegmentId(input: ConsultationTranscriptSegmentInput): string {
  return createHash('sha256')
    .update(`${input.participantIdentity}\0${input.captureId}\0${input.sequence}`)
    .digest('hex');
}

/**
 * Owns the normalized, session-scoped transcript. Segment identity, ordering,
 * speaker labels, idempotency, and revision tracking stay behind this one
 * interface so capture and summary code never depend on Firestore layout.
 */
export class ConsultationTranscriptRepository {
  constructor(private readonly db: Firestore) {}

  async appendSegment(
    input: ConsultationTranscriptSegmentInput
  ): Promise<ConsultationTranscriptAppendResult> {
    const sessionRef = this.db.collection(SESSION_COLLECTION).doc(input.consultationSessionId);
    const segmentRef = sessionRef.collection(SEGMENT_COLLECTION).doc(buildSegmentId(input));

    return this.db.runTransaction(async (transaction) => {
      const [sessionDoc, existingSegment] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(segmentRef),
      ]);
      if (!sessionDoc.exists) {
        throw new Error('Consultation session not found');
      }

      const sessionData = (sessionDoc.data() as Record<string, unknown>) || {};
      const transcription =
        (sessionData.transcription as Record<string, unknown> | undefined) || {};
      const currentRevision = toNonNegativeInteger(transcription.revision);
      const sessionStatus =
        typeof sessionData.status === 'string' ? sessionData.status.trim().toLowerCase() : null;

      if (existingSegment.exists) {
        return {
          inserted: false,
          revision: currentRevision,
          sessionStatus,
        };
      }

      const nextRevision = currentRevision + 1;
      transaction.create(segmentRef, {
        id: segmentRef.id,
        participantIdentity: input.participantIdentity,
        participantName: input.participantName,
        speakerType: input.speakerType,
        captureId: input.captureId,
        sequence: input.sequence,
        capturedAt: input.capturedAt,
        durationMs: input.durationMs,
        text: input.text,
        source: 'participant_audio_track',
        transcriptionProvider: 'openai',
        transcriptionModel: input.model,
        createdAt: new Date(),
      });
      transaction.set(
        sessionRef,
        {
          transcription: {
            revision: nextRevision,
            segmentCount: FieldValue.increment(1),
            source: 'participant_audio_tracks',
            updatedAt: new Date(),
          },
          updatedAt: new Date(),
        },
        { merge: true }
      );

      return {
        inserted: true,
        revision: nextRevision,
        sessionStatus,
      };
    });
  }

  /** Returns ordered speaker-attributed lines and the revision they represent. */
  async getSummaryEvidence(consultationSessionId: string): Promise<ConsultationTranscriptEvidence> {
    const sessionRef = this.db.collection(SESSION_COLLECTION).doc(consultationSessionId);
    const [sessionDoc, segmentSnapshot] = await Promise.all([
      sessionRef.get(),
      sessionRef.collection(SEGMENT_COLLECTION).limit(MAX_SUMMARY_SEGMENTS).get(),
    ]);
    const sessionData = (sessionDoc.data() as Record<string, unknown> | undefined) || {};
    const transcription =
      (sessionData.transcription as Record<string, unknown> | undefined) || {};

    const segments = segmentSnapshot.docs
      .map((document) => {
        const data = document.data() as Record<string, unknown>;
        const text = typeof data.text === 'string' ? data.text.trim() : '';
        const speakerType = data.speakerType === 'doctor' ? 'doctor' : 'patient';
        return {
          text,
          speakerType,
          capturedAtMs: toMillis(data.capturedAt || data.createdAt),
          sequence: toNonNegativeInteger(data.sequence),
          id: document.id,
        };
      })
      .filter((segment) => segment.text.length > 0)
      .sort((left, right) =>
        left.capturedAtMs - right.capturedAtMs
        || left.sequence - right.sequence
        || left.id.localeCompare(right.id)
      );

    return {
      lines: segments.map(
        (segment) => `[${segment.speakerType === 'doctor' ? 'Doctor' : 'Patient'}] ${segment.text}`
      ),
      revision: toNonNegativeInteger(transcription.revision),
      segmentCount: segments.length,
    };
  }
}
