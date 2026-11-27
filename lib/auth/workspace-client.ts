'use client';

import type { User } from 'firebase/auth';
import { authenticatedFetch } from './authenticated-fetch';

export interface WorkspaceAccess {
  administratorLevel: 'super_admin' | 'admin' | null;
  doctorAccess: boolean;
  clinicId: string | null;
  homePath: string | null;
  schedulingEnabled?: boolean;
}

/** Refresh claims explicitly at entry, then use the server's private navigation projection. */
export async function fetchWorkspaceAccess(user: User, refresh = false): Promise<WorkspaceAccess> {
  if (refresh) await user.getIdToken(true);
  const response = await authenticatedFetch('/api/account/access');
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not check account access. Please retry.');
  return data as WorkspaceAccess;
}
