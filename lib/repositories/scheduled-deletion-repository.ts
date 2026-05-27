import type { Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'scheduled-deletions';

/**
 * Sole owner of the `scheduled-deletions` collection, keyed by roomName. Tracks
 * the HIPAA retention/auto-delete schedule for a consultation's records.
 */
export class ScheduledDeletionRepository {
  constructor(private readonly db: Firestore) {}

  async deleteByRoom(roomName: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(roomName).delete();
  }
}
