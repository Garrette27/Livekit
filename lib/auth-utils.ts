import { User } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';

/**
 * Get user role from Firestore user profile
 * @param user Firebase Auth user object
 * @returns Promise resolving to 'doctor' | 'patient' | null
 */
export async function getUserRole(user: User | null): Promise<'doctor' | 'patient' | null> {
  if (!user || !db) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserProfile;
      return userData.role || null;
    }
  } catch (error) {
    console.error('Error fetching user role:', error);
  }

  return null;
}

/**
 * Check if user is a doctor
 * @param user Firebase Auth user object
 * @returns Promise resolving to boolean
 */
export async function isDoctor(user: User | null): Promise<boolean> {
  const role = await getUserRole(user);
  return role === 'doctor';
}

/**
 * Check if user is a patient
 * @param user Firebase Auth user object
 * @returns Promise resolving to boolean
 */
export async function isPatient(user: User | null): Promise<boolean> {
  const role = await getUserRole(user);
  return role === 'patient';
}

/**
 * Get full user profile from Firestore
 * @param user Firebase Auth user object
 * @returns Promise resolving to UserProfile or null
 */
export async function getUserProfile(user: User | null): Promise<UserProfile | null> {
  if (!user || !db) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data()
      } as UserProfile;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }

  return null;
}

