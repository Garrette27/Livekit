import { FieldValue, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

const PARENT_COLLECTION = 'consultationSessions';
const SUBCOLLECTION = 'attachments';

/**
 * Sole owner of the per-session `attachments` subcollection
 * (`consultationSessions/{sessionId}/attachments`). Centralizes the nested path
 * and the upload/extraction timestamp conventions.
 */
export class AttachmentRepository {
  constructor(private readonly db: Firestore) {}

  private collection(consultationSessionId: string) {
    return this.db.collection(PARENT_COLLECTION).doc(consultationSessionId).collection(SUBCOLLECTION);
  }

  /** Creates an attachment metadata document; returns its generated id. */
  async create(consultationSessionId: string, data: Record<string, unknown>): Promise<string> {
    const ref = await this.collection(consultationSessionId).add({
      ...data,
      uploadedAtIso: new Date().toISOString(),
      uploadedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  /** Records the result of background text extraction for one attachment. */
  async updateExtraction(
    consultationSessionId: string,
    attachmentId: string,
    input: { extractionStatus: 'pending' | 'ready' | 'failed'; extractedText?: string | null; errorMessage?: string | null }
  ): Promise<void> {
    await this.collection(consultationSessionId)
      .doc(attachmentId)
      .set(
        {
          extractionStatus: input.extractionStatus,
          extractedText: input.extractedText ?? null,
          extractionError: input.errorMessage ?? null,
          extractedAtIso: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  /** Attachments whose text extraction has completed, for summary context. */
  async findReady(consultationSessionId: string, limit = 20): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await this.collection(consultationSessionId)
      .where('extractionStatus', '==', 'ready')
      .limit(limit)
      .get();
    return snapshot.docs;
  }
}
