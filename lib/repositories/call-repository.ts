import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'calls';

/**
 * Sole owner (server side) of the `calls` collection, keyed by roomName, which
 * holds the live transcript line buffer for a room. The browser client writes
 * transcript lines via its own TranscriptionService; this is the admin-side
 * read used during summarization.
 */
export class CallRepository {
  constructor(private readonly db: Firestore) {}

  getByRoom(roomName: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(roomName).get();
  }

  /**
   * Returns non-empty transcript lines for a room, or null when none are
   * stored. When the buffer declares its owning session, a caller for another
   * session never receives that stale text.
   */
  async getTranscriptLines(
    roomName: string,
    expectedConsultationSessionId?: string | null
  ): Promise<string[] | null> {
    const callDoc = await this.getByRoom(roomName);
    if (!callDoc.exists) {
      return null;
    }

    const callData = callDoc.data() as {
      consultationSessionId?: unknown;
      transcription?: unknown;
    } | undefined;
    const storedConsultationSessionId = typeof callData?.consultationSessionId === 'string'
      ? callData.consultationSessionId.trim()
      : '';
    if (
      expectedConsultationSessionId
      && storedConsultationSessionId
      && storedConsultationSessionId !== expectedConsultationSessionId
    ) {
      return null;
    }

    const transcription = callData?.transcription;
    if (!Array.isArray(transcription)) {
      return null;
    }

    const lines = transcription
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry): entry is string => entry.length > 0);

    return lines.length > 0 ? lines : null;
  }
}
