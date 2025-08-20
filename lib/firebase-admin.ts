import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let firebaseApp: App | undefined;
let firestoreDb: Firestore | undefined;

function initializeFirebaseAdmin(): App | undefined {
  // Only initialize if not already initialized and environment variables are available
  if (!firebaseApp && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      return undefined;
    }
  }
  return firebaseApp;
}

export function getFirebaseAdmin(): Firestore | undefined {
  if (!firestoreDb) {
    const app = initializeFirebaseAdmin();
    if (app) {
      firestoreDb = getFirestore(app);
    }
  }
  return firestoreDb;
}

// Legacy export for backward compatibility
export const db = getFirebaseAdmin();
