import type {
  DocumentSnapshot,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

const COLLECTION = 'consultationSessions';

/**
 * Sole owner of the `consultationSessions` collection name and its query
 * shapes. A session's patient identity may be stored either top-level or under
 * `metadata.*`; that duplication is hidden behind findByPatient.
 *
 * Subcollections (events, messages, attachments) are owned by the modules that
 * specialize in them and are intentionally not exposed here.
 */
export class ConsultationSessionRepository {
  constructor(private readonly db: Firestore) {}

  getById(id: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(id).get();
  }

  async mergeFields(id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).set(data, { merge: true });
  }

  async findByRoom(roomName: string, limit = 50): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('roomName', '==', roomName)
      .limit(limit)
      .get();
    return snapshot.docs;
  }

  async findByDoctor(doctorUserId: string, limit = 300): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('doctorUserId', '==', doctorUserId)
      .limit(limit)
      .get();
    return snapshot.docs;
  }

  /** Every session for a patient, matched by user id and/or emails (top-level or metadata), deduped by id. */
  async findByPatient(
    input: { patientUserId?: string | null; emails?: string[] },
    limit = 300
  ): Promise<QueryDocumentSnapshot[]> {
    const queries: Array<Promise<{ docs: QueryDocumentSnapshot[] }>> = [];

    if (input.patientUserId) {
      queries.push(this.db.collection(COLLECTION).where('patientUserId', '==', input.patientUserId).limit(limit).get());
      queries.push(this.db.collection(COLLECTION).where('metadata.patientUserId', '==', input.patientUserId).limit(limit).get());
    }
    for (const email of input.emails ?? []) {
      queries.push(this.db.collection(COLLECTION).where('patientEmail', '==', email).limit(limit).get());
      queries.push(this.db.collection(COLLECTION).where('metadata.patientEmail', '==', email).limit(limit).get());
    }

    const snapshots = await Promise.all(queries);
    const byId = new Map<string, QueryDocumentSnapshot>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => byId.set(doc.id, doc)));
    return Array.from(byId.values());
  }
}
