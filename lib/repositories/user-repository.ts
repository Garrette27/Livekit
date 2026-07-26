import type {
  DocumentSnapshot,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

const COLLECTION = 'users';

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

  /** First user with the given email, or null. Emails are expected to be unique. */
  async findByEmail(email: string): Promise<QueryDocumentSnapshot | null> {
    const snapshot = await this.db.collection(COLLECTION).where('email', '==', email).limit(1).get();
    return snapshot.empty ? null : snapshot.docs[0];
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
