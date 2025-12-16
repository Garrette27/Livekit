'use client';

import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, provider } from '@/lib/firebase';

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
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

  // Subscribe to auth changes
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);

      if (currentUser && !doctorName) {
        const displayName = currentUser.displayName || currentUser.email || 'Dr. Anonymous';
        setDoctorName(displayName);
        localStorage.setItem(`doctorName_${roomName}`, displayName);
      }
    });
  }, [roomName, doctorName]);

  const signIn = useCallback(async () => {
    if (!auth || !provider) {
      setAuthError('Authentication not available');
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const signedInUser = result.user;
      setUser(signedInUser);
      setIsAuthenticated(true);
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
        setUser(null);
        setIsAuthenticated(false);
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


