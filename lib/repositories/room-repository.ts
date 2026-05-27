import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'rooms';

/** Sole owner of the `rooms` collection, keyed by roomName. */
export class RoomRepository {
  constructor(private readonly db: Firestore) {}

  getByRoom(roomName: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(roomName).get();
  }

  async mergeFields(roomName: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(roomName).set(data, { merge: true });
  }
}
