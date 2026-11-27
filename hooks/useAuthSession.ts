'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserRole } from '@/lib/auth-utils';
import type { AppRole } from '@/lib/auth/access-policy';
import { fetchWorkspaceAccess } from '@/lib/auth/workspace-client';

type UserRole = AppRole | null;

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

      // Stop exposing the previous account's workspace while resolving a new
      // identity. Data-bearing children must not remain authorized in this gap.
      setState({ user, role: null, isAuthenticated: true, isAuthorized: false, isLoading: true });
      let role: UserRole = null;
      let doctorAccess = true;
      try {
        // A cached profile may predate a platform-owner configuration change.
        // Re-query authority before opening clinician subscriptions or screens.
        if (requiredRole === 'doctor') {
          doctorAccess = false;
          const access = await fetchWorkspaceAccess(user);
          doctorAccess = access.doctorAccess;
          role = doctorAccess ? 'doctor' : null;
          if (requestId === requestIdRef.current && access.administratorLevel) {
            window.location.replace('/admin');
          }
        } else if (resolveRole) {
          role = await resolveUserRole(user);
        }
      } catch (error) {
        console.error('Error resolving auth session state:', error);
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      const isAuthorized = requiredRole ? role === requiredRole && doctorAccess : true;
      setState({
        user,
        role,
        isAuthenticated: true,
        isAuthorized,
        isLoading: false,
      });

      if (onAuthenticated && isAuthorized) {
        void Promise.resolve(onAuthenticated(user)).catch((error) => {
          console.error('Error in onAuthenticated callback:', error);
        });
      }
    });
  }, [onAuthenticated, requiredRole, resolveRole]);

  return useMemo(() => state, [state]);
}
