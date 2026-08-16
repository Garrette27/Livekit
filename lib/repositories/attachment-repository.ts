import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const PARENT_COLLECTION = 'consultationSessions';
const SUBCOLLECTION = 'attachments';

export interface ReadyAttachmentEvidence {
  attachmentId: string;
  name: string;
  extractedText: string;
}

export interface MessageAttachmentReference {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  extractionStatus: 'pending' | 'ready' | 'failed' | null;
}

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
    const attachmentRef = this.collection(consultationSessionId).doc(attachmentId);
    const evidenceRef = attachmentRef.collection('evidence').doc('extraction');
    await this.db.runTransaction(async (transaction) => {
      const attachmentDocument = await transaction.get(attachmentRef);
      if (!attachmentDocument.exists) {
        throw new Error('Attachment does not belong to this consultation session');
      }
      if (attachmentDocument.data()?.uploadStatus !== 'ready') {
        throw new Error('Attachment upload is not ready for extraction');
      }
      transaction.set(
        attachmentRef,
        {
          extractionStatus: input.extractionStatus,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      transaction.set(
        evidenceRef,
        {
          status: input.extractionStatus,
          extractedText: input.extractedText ?? null,
          errorMessage: input.errorMessage ?? null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );
    });
  }

  /** Ready evidence with the clinical text hidden behind this repository. */
  async findReady(consultationSessionId: string, limit = 20): Promise<ReadyAttachmentEvidence[]> {
    const snapshot = await this.collection(consultationSessionId)
      .where('extractionStatus', '==', 'ready')
      .limit(limit)
      .get();
    const evidence = await Promise.all(
      snapshot.docs.map(async (attachmentDocument) => {
        const attachment = attachmentDocument.data();
        const evidenceDocument = await attachmentDocument.ref
          .collection('evidence')
          .doc('extraction')
          .get();
        const evidenceData = evidenceDocument.data();
        const extractedText = typeof evidenceData?.extractedText === 'string'
          ? evidenceData.extractedText.trim()
          : '';
        if (evidenceData?.status !== 'ready' || !extractedText) {
          return null;
        }
        return {
          attachmentId: attachmentDocument.id,
          name: typeof attachment.name === 'string' ? attachment.name : 'Attachment',
          extractedText,
        };
      })
    );
    return evidence.filter((item): item is ReadyAttachmentEvidence => item !== null);
  }

  /**
   * Resolves client-supplied ids into safe message references. A browser can
   * select an attachment, but cannot choose its path, size, status, or text.
   */
  async resolveMessageReferences(
    consultationSessionId: string,
    attachmentIds: string[],
    uploaderId: string
  ): Promise<MessageAttachmentReference[]> {
    if (attachmentIds.length === 0) {
      return [];
    }

    const references = attachmentIds.map((attachmentId) =>
      this.collection(consultationSessionId).doc(attachmentId)
    );
    const documents = await this.db.getAll(...references);
    return documents.map((document) => {
      if (!document.exists) {
        throw new Error('Attachment does not belong to this consultation session');
      }
      const attachment = document.data() || {};
      if (attachment.uploaderId !== uploaderId) {
        throw new Error('Attachment may only be sent by its uploader');
      }
      if (attachment.uploadStatus !== 'ready' || typeof attachment.storagePath !== 'string') {
        throw new Error('Attachment upload is not ready');
      }

      return {
        id: document.id,
        name: String(attachment.name || 'Attachment'),
        mimeType: String(attachment.mimeType || 'application/octet-stream'),
        size: Number(attachment.size || 0),
        extractionStatus:
          attachment.extractionStatus === 'pending'
          || attachment.extractionStatus === 'ready'
          || attachment.extractionStatus === 'failed'
            ? attachment.extractionStatus
            : null,
      };
    });
  }
}
