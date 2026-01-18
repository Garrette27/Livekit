import { initializeApp, FirebaseApp, getApps } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { initializeApp as initializeAdminApp, cert, App as AdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestoreFromSDK, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuthFromSDK, Auth as AdminAuth } from 'firebase-admin/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

class FirebaseFactory {
  private static clientInstance: FirebaseApp | null = null;
  private static adminInstance: AdminApp | null = null;
  
  private static authInstance: Auth | null = null;
  private static dbInstance: Firestore | null = null;
  private static storageInstance: FirebaseStorage | null = null;
  private static providerInstance: GoogleAuthProvider | null = null;
  
  private static adminAuthInstance: AdminAuth | null = null;
  private static adminDbInstance: AdminFirestore | null = null;

  static getClient(): FirebaseApp {
    if (!this.clientInstance) {
      const isClient = typeof window !== 'undefined';
      const hasFirebaseConfig = firebaseConfig.apiKey && firebaseConfig.projectId;
      
      if (!isClient || !hasFirebaseConfig) {
        throw new Error('Firebase client can only be initialized in browser environment with valid config');
      }
      
      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.clientInstance = existingApps[0];
      } else {
        this.clientInstance = initializeApp(firebaseConfig);
      }
    }
    
    return this.clientInstance;
  }

  static getAdmin(): AdminApp {
    if (!this.adminInstance) {
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Firebase Admin requires environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      }
      
      const existingApps = getAdminApps();
      if (existingApps.length > 0) {
        this.adminInstance = existingApps[0];
      } else {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = privateKey.replace(/\\n/g, '\n');
        }
        
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        };
        
        this.adminInstance = initializeAdminApp({
          credential: cert(serviceAccount),
        });
      }
    }
    
    return this.adminInstance;
  }

  static getAuth(): Auth {
    if (!this.authInstance) {
      this.authInstance = getAuth(this.getClient());
    }
    return this.authInstance;
  }

  static getFirestore(): Firestore {
    if (!this.dbInstance) {
      this.dbInstance = getFirestore(this.getClient());
    }
    return this.dbInstance;
  }

  static getStorage(): FirebaseStorage {
    if (!this.storageInstance) {
      this.storageInstance = getStorage(this.getClient());
    }
    return this.storageInstance;
  }

  static getGoogleProvider(): GoogleAuthProvider {
    if (!this.providerInstance) {
      this.providerInstance = new GoogleAuthProvider();
      this.providerInstance.addScope('profile');
      this.providerInstance.addScope('email');
    }
    return this.providerInstance;
  }

  static getAdminAuth(): AdminAuth {
    if (!this.adminAuthInstance) {
      this.adminAuthInstance = getAdminAuthFromSDK(this.getAdmin());
    }
    return this.adminAuthInstance;
  }

  static getAdminFirestore(): AdminFirestore {
    if (!this.adminDbInstance) {
      this.adminDbInstance = getAdminFirestoreFromSDK(this.getAdmin());
    }
    return this.adminDbInstance;
  }
}

// Legacy exports for backward compatibility
export function getFirebaseClient() {
  return FirebaseFactory.getClient();
}

export function getFirebaseAdmin() {
  return FirebaseFactory.getAdmin();
}

export function getClientAuth() {
  return FirebaseFactory.getAuth();
}

export function getClientFirestore() {
  return FirebaseFactory.getFirestore();
}

export function getClientStorage() {
  return FirebaseFactory.getStorage();
}

export function getGoogleProvider() {
  return FirebaseFactory.getGoogleProvider();
}

export function getAdminAuth() {
  return FirebaseFactory.getAdminAuth();
}

export function getAdminFirestore() {
  return FirebaseFactory.getAdminFirestore();
}

// Export the factory for direct usage
export { FirebaseFactory };