'use client';

import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';

interface DoctorTokenState {
  token: string | null;
  isJoining: boolean;
  tokenError: string | null;
  generateDoctorToken: () => Promise<string | null>;
  clearToken: () => void;
  clearTokenError: () => void;
}

interface DoctorTokenArgs {
  roomName: string;
  doctorName: string;
  user: User | null;
}

/** Decodes (does not verify) a LiveKit JWT to check expiry and owner. */
function isUsableDoctorToken(token: string, uid: string | undefined): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const fresh = typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 5 * 60 * 1000;
    const owned = !uid || (typeof payload.sub === 'string' && payload.sub.includes(uid));
    return fresh && owned;
  } catch {
    return false;
  }
}

export function useDoctorToken({ roomName, doctorName, user }: DoctorTokenArgs): DoctorTokenState {
  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Load persisted token
  useEffect(() => {
    const key = `doctorToken_${roomName}`;
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    // A saved token is reused only if it is unexpired (with a 5-minute margin)
    // and was issued to the account signed in now; otherwise it is dropped and
    // a fresh one is requested, instead of failing with "Connection error".
    if (savedToken && isUsableDoctorToken(savedToken, user?.uid)) {
      setToken(savedToken);
    } else if (savedToken) {
      localStorage.removeItem(key);
    }
  }, [roomName, user?.uid]);

  const generateDoctorToken = useCallback(async () => {
    if (!doctorName.trim()) {
      setTokenError('Please enter your name');
      return null;
    }

    if (!user) {
      setTokenError('Please sign in as a doctor to join this room');
      return null;
    }

    setIsJoining(true);
    setTokenError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/doctor-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          roomName,
          doctorName,
        })
      });

      const data = await response.json();

      if (data.success && data.token) {
        setToken(data.token);
        localStorage.setItem(`doctorToken_${roomName}`, data.token);
        localStorage.setItem(`doctorName_${roomName}`, doctorName);
        return data.token as string;
      }

      setTokenError(data.error || 'Failed to generate doctor access token');
      return null;
    } catch (error) {
      console.error('Doctor token generation error:', error);
      setTokenError('Network error. Please try again.');
      return null;
    } finally {
      setIsJoining(false);
    }
  }, [doctorName, roomName, user]);

  const clearToken = useCallback(() => {
    setToken(null);
    localStorage.removeItem(`doctorToken_${roomName}`);
  }, [roomName]);

  const clearTokenError = useCallback(() => setTokenError(null), []);

  return {
    token,
    isJoining,
    tokenError,
    generateDoctorToken,
    clearToken,
    clearTokenError
  };
}


