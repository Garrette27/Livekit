import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'roomDoctorPresence';

/**
 * Sole owner of the `roomDoctorPresence` collection, keyed by roomName. Holds
 * the live set of doctors currently in a room plus their last-left timestamps.
 */
export class RoomDoctorPresenceRepository {
  constructor(private readonly db: Firestore) {}

  getByRoom(roomName: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(roomName).get();
  }

  async mergeFields(roomName: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(roomName).set(data, { merge: true });
  }
}
