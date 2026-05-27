import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

const COLLECTION = 'waitingPatients';

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const firestoreError = error as { code?: number; message?: string; details?: string };
  if (firestoreError.code === 9) {
    return true;
  }
  const message = `${firestoreError.message || ''} ${firestoreError.details || ''}`.toLowerCase();
  return message.includes('requires an index');
}

/**
 * Sole owner of the `waitingPatients` collection. Read helpers transparently
 * fall back to a single-field query + in-memory filter when a composite index
 * is missing, so callers never have to handle that Firestore quirk.
 */
export class WaitingPatientRepository {
  constructor(private readonly db: Firestore) {}

  /** All waiting-patient documents (used by admin migrations/backfills). */
  async listAll(): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await this.db.collection(COLLECTION).get();
    return snapshot.docs;
  }

  async setDoctorUserId(waitingPatientId: string, doctorUserId: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(waitingPatientId).update({ doctorUserId });
  }

  /** Currently-waiting entries for a patient email (status === 'waiting'). */
  async findWaitingByPatientEmail(patientEmail: string): Promise<QueryDocumentSnapshot[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTION)
        .where('patientEmail', '==', patientEmail)
        .where('status', '==', 'waiting')
        .limit(100)
        .get();
      return snapshot.docs;
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }
      const fallback = await this.db
        .collection(COLLECTION)
        .where('patientEmail', '==', patientEmail)
        .limit(200)
        .get();
      return fallback.docs.filter((doc) => (doc.data() as { status?: string }).status === 'waiting');
    }
  }
}
