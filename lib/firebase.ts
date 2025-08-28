import { initializeApp, FirebaseApp, getApps } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we're in a browser environment and Firebase config is available
const isClient = typeof window !== 'undefined';
const hasFirebaseConfig = firebaseConfig.apiKey && firebaseConfig.projectId;

// Initialize Firebase only if we have the config and we're on the client side
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let provider: GoogleAuthProvider | undefined;

if (isClient && hasFirebaseConfig) {
  try {
    // Check if Firebase is already initialized
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
  }

  if (app) {
    try {
      auth = getAuth(app);
      db = getFirestore(app);
      provider = new GoogleAuthProvider();
    } catch (error) {
      console.warn('Firebase services initialization failed:', error);
    }
  }
}

// Export with fallbacks for SSR
export { auth, db, provider };
