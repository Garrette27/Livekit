'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserRole } from '@/lib/auth-utils';

type UserRole = 'doctor' | 'patient' | null;

interface UseAuthSessionOptions {
  requiredRole?: Exclude<UserRole, null>;
  resolveRole?: boolean;
  onAuthenticated?: (user: User) => void | Promise<void>;
}

export interface AuthSessionState {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isAuthorized: boolean;
  isLoading: boolean;
}

const roleCache = new Map<string, UserRole>();

async function resolveUserRole(user: User): Promise<UserRole> {
  const cached = roleCache.get(user.uid);
  if (cached !== undefined) {
    return cached;
  }

  const nextRole = await getUserRole(user);
  roleCache.set(user.uid, nextRole);
  return nextRole;
}

export function useAuthSession({
  requiredRole,
  resolveRole = Boolean(requiredRole),
  onAuthenticated,
}: UseAuthSessionOptions = {}): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    user: null,
    role: null,
    isAuthenticated: false,
    isAuthorized: false,
    isLoading: true,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!auth) {
      setState({
        user: null,
        role: null,
        isAuthenticated: false,
        isAuthorized: false,
        isLoading: false,
      });
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      const requestId = ++requestIdRef.current;

      if (!user) {
        setState({
          user: null,
          role: null,
          isAuthenticated: false,
          isAuthorized: false,
          isLoading: false,
        });
        return;
      }

      let role: UserRole = null;
      try {
        if (resolveRole) {
          role = await resolveUserRole(user);
        }

        if (onAuthenticated) {
          await onAuthenticated(user);
        }
      } catch (error) {
        console.error('Error resolving auth session state:', error);
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      const isAuthorized = requiredRole ? role === requiredRole : true;
      setState({
        user,
        role,
        isAuthenticated: true,
        isAuthorized,
        isLoading: false,
      });
    });
  }, [onAuthenticated, requiredRole, resolveRole]);

  return useMemo(() => state, [state]);
}
