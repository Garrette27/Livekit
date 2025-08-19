import { initializeApp, FirebaseApp } from "firebase/app";
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

// Lazy initialization - only create instances when accessed
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let providerInstance: GoogleAuthProvider | null = null;

// Initialize Firebase only when first accessed
function initializeFirebase() {
  if (!app) {
    try {
      app = initializeApp(firebaseConfig);
      authInstance = getAuth(app);
      dbInstance = getFirestore(app);
      providerInstance = new GoogleAuthProvider();
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }
}

// Export getter functions that initialize Firebase on first use
export const auth = new Proxy({} as Auth, {
  get(target, prop) {
    if (!authInstance) {
      initializeFirebase();
    }
    return authInstance?.[prop as keyof Auth];
  }
});

export const db = new Proxy({} as Firestore, {
  get(target, prop) {
    if (!dbInstance) {
      initializeFirebase();
    }
    return dbInstance?.[prop as keyof Firestore];
  }
});

export const provider = new Proxy({} as GoogleAuthProvider, {
  get(target, prop) {
    if (!providerInstance) {
      initializeFirebase();
    }
    return providerInstance?.[prop as keyof GoogleAuthProvider];
  }
});
