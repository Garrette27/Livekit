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

  /**
   * Atomically claims an unowned room for a doctor or confirms the existing
   * owner. Returns false on an ownership conflict so callers cannot overwrite a
   * room between a separate read and write.
   */
  async claimForDoctor(
    roomName: string,
    doctor: { userId: string; email?: string; name?: string }
  ): Promise<boolean> {
    const roomRef = this.db.collection(COLLECTION).doc(roomName);

    return this.db.runTransaction(async (transaction) => {
      const roomDoc = await transaction.get(roomRef);
      const roomData = roomDoc.exists ? roomDoc.data() : undefined;
      const metadata = (roomData?.metadata as Record<string, unknown> | undefined) || {};
      const owner =
        (typeof roomData?.createdBy === 'string' && roomData.createdBy)
        || (typeof metadata.createdBy === 'string' && metadata.createdBy)
        || null;

      if (owner && owner !== doctor.userId) {
        return false;
      }

      if (!roomDoc.exists) {
        const now = new Date();
        transaction.set(roomRef, {
          roomName,
          createdBy: doctor.userId,
          createdAt: now,
          status: 'active',
          metadata: {
            createdBy: doctor.userId,
            userId: doctor.userId,
            userEmail: doctor.email || null,
            userName: doctor.name || null,
          },
        });
      }

      return true;
    });
  }
}
