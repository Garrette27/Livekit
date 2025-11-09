import { initializeApp, cert, App, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let firebaseApp: App | undefined;
let firestoreDb: Firestore | undefined;
let authInstance: Auth | undefined;

function initializeFirebaseAdmin(): App | undefined {
  // Check if already initialized
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if there's an existing app
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  // Only initialize if environment variables are available
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return undefined;
  }

  try {
    // Clean up the private key - handle various formats
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Replace escaped newlines
    privateKey = privateKey?.replace(/\\n/g, '\n');
    
    // Ensure the private key starts and ends with proper markers
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }
    
    // Validate private key format
    if (!privateKey || !privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      console.error('Invalid Firebase private key format');
      return undefined;
    }

    firebaseApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    // Don't throw the error during build time
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('Firebase Admin initialization failed during build - this is expected if environment variables are not set');
      return undefined;
    }
    return undefined;
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

export function getFirebaseAdminAuth(): Auth | undefined {
  if (!authInstance) {
    const app = initializeFirebaseAdmin();
    if (app) {
      authInstance = getAuth(app);
    }
  }
  return authInstance;
}

// Legacy export for backward compatibility
export const db = getFirebaseAdmin();
