import type {
  DocumentSnapshot,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

const COLLECTION = 'invitations';

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const e = error as { code?: number; message?: string; details?: string };
  if (e.code === 9) {
    return true;
  }
  const message = `${e.message || ''} ${e.details || ''}`.toLowerCase();
  return message.includes('requires an index');
}

/**
 * Sole owner of the `invitations` collection. Encapsulates the active-by-room
 * lookup including its composite-index fallback so route/service callers don't
 * repeat that Firestore quirk.
 */
export class InvitationRepository {
  constructor(private readonly db: Firestore) {}

  getById(invitationId: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(invitationId).get();
  }

  async mergeFields(invitationId: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(invitationId).set(data, { merge: true });
  }

  /** Creates an invitation document with an explicit id. */
  async create(invitationId: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(invitationId).set(data);
  }

  /**
   * Candidate invitations for a room (most recent first). Tries the indexed
   * status+createdAt query and falls back to a roomName-only query when the
   * composite index is missing; the caller applies final active/expiry rules.
   */
  async findActiveByRoom(roomName: string, limit = 20): Promise<QueryDocumentSnapshot[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTION)
        .where('roomName', '==', roomName)
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs;
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }
      const fallback = await this.db.collection(COLLECTION).where('roomName', '==', roomName).limit(limit).get();
      return fallback.docs;
    }
  }

  /** Invitations whose allowed email matches (used when linking a patient's past consultations). */
  async findByEmailAllowed(email: string, limit = 200): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await this.db.collection(COLLECTION).where('emailAllowed', '==', email).limit(limit).get();
    return snapshot.docs;
  }
}
