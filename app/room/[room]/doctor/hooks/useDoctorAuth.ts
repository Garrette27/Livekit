'use client';

import { useEffect, useState, useCallback } from 'react';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, provider } from '@/lib/firebase';
import { useAuthSession } from '@/hooks/useAuthSession';

interface DoctorAuthState {
  user: User | null;
  isAuthenticated: boolean;
  doctorName: string;
  authError: string | null;
  setDoctorName: (name: string) => void;
  signIn: () => Promise<void>;
  signOutDoctor: () => Promise<void>;
  clearAuthError: () => void;
}

export function useDoctorAuth(roomName: string): DoctorAuthState {
  const { user, isAuthenticated } = useAuthSession();
  const [doctorName, setDoctorName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Load saved name on mount
  useEffect(() => {
    const savedName = typeof window !== 'undefined'
      ? localStorage.getItem(`doctorName_${roomName}`)
      : null;
    if (savedName) {
      setDoctorName(savedName);
    }
  }, [roomName]);

  // Hydrate doctor name from auth profile when no local name is present.
  useEffect(() => {
    if (!user) {
      return;
    }

    setDoctorName((currentName) => {
      if (currentName) {
        return currentName;
      }

      const displayName = user.displayName || user.email || 'Dr. Anonymous';
      localStorage.setItem(`doctorName_${roomName}`, displayName);
      return displayName;
    });
  }, [roomName, user]);

  const signIn = useCallback(async () => {
    if (!auth || !provider) {
      setAuthError('Authentication not available');
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const signedInUser = result.user;
      const name = signedInUser.displayName || signedInUser.email || 'Dr. Anonymous';
      setDoctorName(name);
      localStorage.setItem(`doctorName_${roomName}`, name);
      setAuthError(null);
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthError('Failed to sign in. Please try again.');
    }
  }, [roomName]);

  const signOutDoctor = useCallback(async () => {
    try {
      if (auth) {
        await signOut(auth);
        setDoctorName('');
        localStorage.removeItem(`doctorName_${roomName}`);
        localStorage.removeItem(`doctorToken_${roomName}`);
      }
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthError('Failed to sign out. Please try again.');
    }
  }, [roomName]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return {
    user,
    isAuthenticated,
    doctorName,
    authError,
    setDoctorName,
    signIn,
    signOutDoctor,
    clearAuthError
  };
}


