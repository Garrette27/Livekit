import type { DocumentSnapshot, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

const COLLECTION = 'consultations';

/**
 * Sole owner of the `consultations` collection, keyed by roomName. One
 * consultation document per room tracks the current/most-recent encounter.
 */
export class ConsultationRepository {
  constructor(private readonly db: Firestore) {}

  getByRoom(roomName: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(roomName).get();
  }

  async mergeFields(roomName: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(roomName).set(data, { merge: true });
  }

  async deleteByRoom(roomName: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(roomName).delete();
  }

  /**
   * Consultations matching a patient email (top-level or `metadata.patientEmail`),
   * deduped by room name. Used when linking a registered patient to consultations
   * they attended anonymously.
   */
  async findByPatientEmail(email: string, limit = 200): Promise<QueryDocumentSnapshot[]> {
    const snapshots = await Promise.all([
      this.db.collection(COLLECTION).where('patientEmail', '==', email).limit(limit).get(),
      this.db.collection(COLLECTION).where('metadata.patientEmail', '==', email).limit(limit).get(),
    ]);
    const byId = new Map<string, QueryDocumentSnapshot>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => byId.set(doc.id, doc)));
    return Array.from(byId.values());
  }
}
