import type {
  DocumentSnapshot,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

const COLLECTION = 'call-summaries';

/**
 * Sole owner of the `call-summaries` collection name and query shapes. All
 * reads/writes of consultation summaries go through here so the collection
 * name, the document id convention (consultationSessionId, falling back to
 * roomName), and the fact that a patient identity may live under either
 * top-level or `metadata.*` fields are known in exactly one place.
 *
 * Methods return raw Firestore snapshots so callers keep using `.data()`,
 * `.id`, and `.ref`; the value added here is information hiding, not DTO
 * mapping.
 */
export class CallSummaryRepository {
  constructor(private readonly db: Firestore) {}

  getById(id: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(id).get();
  }

  async overwrite(id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).set(data);
  }

  /**
   * Stores generated content only when it cannot overwrite a clinician edit or
   * a summary built from a newer transcript revision. This closes the race
   * between finalization and audio chunks that finish transcription afterward.
   */
  async overwriteGenerated(
    id: string,
    data: Record<string, unknown>,
    transcriptRevision: number
  ): Promise<boolean> {
    const summaryRef = this.db.collection(COLLECTION).doc(id);
    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(summaryRef);
      if (existing.exists) {
        const existingData = (existing.data() as Record<string, unknown>) || {};
        const metadata =
          (existingData.metadata as Record<string, unknown> | undefined) || {};
        const existingRevision = Number(metadata.transcriptRevision || 0);
        if (metadata.isEdited === true || existingRevision > transcriptRevision) {
          return false;
        }
      }

      transaction.set(summaryRef, data);
      return true;
    });
  }

  async mergeFields(id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).set(data, { merge: true });
  }

  async update(id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).update(data);
  }

  async deleteById(id: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).delete();
  }

  async findByDoctor(doctorUserId: string, limit = 300): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('createdBy', '==', doctorUserId)
      .limit(limit)
      .get();
    return snapshot.docs;
  }

  /**
   * Returns every summary that belongs to a patient, deduped by document id.
   * A patient is matched by user id and/or any of their known emails, each of
   * which may be stored either top-level or under `metadata.*`.
   */
  async findByPatient(
    input: { patientUserId?: string | null; emails?: string[] },
    limit = 300
  ): Promise<QueryDocumentSnapshot[]> {
    const queries: Array<Promise<{ docs: QueryDocumentSnapshot[] }>> = [];

    if (input.patientUserId) {
      queries.push(
        this.db.collection(COLLECTION).where('patientUserId', '==', input.patientUserId).limit(limit).get()
      );
      queries.push(
        this.db.collection(COLLECTION).where('metadata.patientUserId', '==', input.patientUserId).limit(limit).get()
      );
    }

    for (const email of input.emails ?? []) {
      queries.push(
        this.db.collection(COLLECTION).where('patientEmail', '==', email).limit(limit).get()
      );
      queries.push(
        this.db.collection(COLLECTION).where('metadata.patientEmail', '==', email).limit(limit).get()
      );
    }

    const snapshots = await Promise.all(queries);
    const byId = new Map<string, QueryDocumentSnapshot>();
    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((doc) => byId.set(doc.id, doc));
    });
    return Array.from(byId.values());
  }
}
