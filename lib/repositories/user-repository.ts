import type {
  DocumentSnapshot,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

const COLLECTION = 'users';

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Sole owner of the `users` collection, keyed by Firebase uid. */
export class UserRepository {
  constructor(private readonly db: Firestore) {}

  getById(userId: string): Promise<DocumentSnapshot> {
    return this.db.collection(COLLECTION).doc(userId).get();
  }

  /** Convenience read for the common "what's this user's email" lookup. */
  async getEmail(userId: string): Promise<string | undefined> {
    const userDoc = await this.getById(userId);
    return userDoc.exists ? ((userDoc.data()?.email as string | undefined) ?? undefined) : undefined;
  }

  /**
   * The current profile for an email address, or null.
   *
   * Emails are meant to be unique, but a profile outlives the auth account it
   * was created for — deleting a sign-in leaves its document behind, and
   * registering again creates a second one under a new uid. Taking whichever
   * document the index happened to return first meant the same email could
   * resolve to the abandoned profile on one request and the live one on the
   * next. The most recently registered profile is the one the person is
   * actually using, so it wins deterministically.
   */
  async findByEmail(email: string): Promise<QueryDocumentSnapshot | null> {
    const snapshot = await this.db.collection(COLLECTION).where('email', '==', email).limit(20).get();
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs.reduce((newest, candidate) => {
      const newestAt = toMillis(newest.data()?.registeredAt);
      const candidateAt = toMillis(candidate.data()?.registeredAt);
      return candidateAt > newestAt ? candidate : newest;
    });
  }

  async findAllByEmail(email: string, limit = 20): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await this.db.collection(COLLECTION).where('email', '==', email).limit(limit).get();
    return snapshot.docs;
  }

  async mergeFields(userId: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(userId).set(data, { merge: true });
  }

  async update(userId: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection(COLLECTION).doc(userId).update(data);
  }

  /** Creates a user document with an auto-generated id; returns the new id. */
  async create(data: Record<string, unknown>): Promise<string> {
    const ref = await this.db.collection(COLLECTION).add(data);
    return ref.id;
  }
}
