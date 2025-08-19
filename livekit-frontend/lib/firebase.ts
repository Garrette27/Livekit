// Check if we're in a browser environment before initializing Firebase
const isBrowser = typeof window !== 'undefined';

// Only initialize Firebase in browser environment
const firebaseConfig = isBrowser ? {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} : {};

// Initialize Firebase only in browser
let app: any = null;
let authInstance: any = null;
let dbInstance: any = null;
let providerInstance: any = null;

if (isBrowser) {
  try {
    const { initializeApp } = require('firebase/app');
    const { getAuth, GoogleAuthProvider } = require('firebase/auth');
    const { getFirestore } = require('firebase/firestore');
    
    app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    providerInstance = new GoogleAuthProvider();
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export const auth = authInstance;
export const db = dbInstance;
export const provider = providerInstance;
