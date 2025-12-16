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

export function useDoctorToken({ roomName, doctorName, user }: DoctorTokenArgs): DoctorTokenState {
  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Load persisted token
  useEffect(() => {
    const savedToken = typeof window !== 'undefined'
      ? localStorage.getItem(`doctorToken_${roomName}`)
      : null;
    if (savedToken) {
      setToken(savedToken);
    }
  }, [roomName]);

  const generateDoctorToken = useCallback(async () => {
    if (!doctorName.trim()) {
      setTokenError('Please enter your name');
      return null;
    }

    setIsJoining(true);
    setTokenError(null);

    try {
      const response = await fetch('/api/doctor-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          doctorName,
          doctorEmail: user?.email || 'anonymous@example.com'
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


