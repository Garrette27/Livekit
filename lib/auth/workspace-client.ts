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

/** Thrown when the access check fails; `retryAfterMs` is set when the server asked callers to wait. */
export class WorkspaceAccessError extends Error {
  constructor(message: string, readonly retryAfterMs: number | null) {
    super(message);
    this.name = 'WorkspaceAccessError';
  }
}

/** How long one successful answer is shared between the header, guards and pages. */
const SHARED_ANSWER_MS = 15_000;
const sharedByUser = new Map<string, { promise: Promise<WorkspaceAccess>; settledAt: number | null }>();

async function requestWorkspaceAccess(): Promise<WorkspaceAccess> {
  const response = await authenticatedFetch('/api/account/access');
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const retryAfterSeconds = Number(response.headers.get('Retry-After'));
    throw new WorkspaceAccessError(
      data.error || 'Could not check account access. Please retry.',
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : null
    );
  }
  return data as WorkspaceAccess;
}

/**
 * Returns the server's private navigation projection for `user`.
 *
 * Concurrent callers for the same account share one request, and a success is
 * reused for a few seconds, so mounting several guarded components costs one
 * read instead of one each. `refresh` (used at sign-in entry) forces a fresh
 * ID token and a fresh answer. Failures are never cached.
 */
export async function fetchWorkspaceAccess(user: User, refresh = false): Promise<WorkspaceAccess> {
  const shared = sharedByUser.get(user.uid);
  const fresh = shared && (shared.settledAt === null || Date.now() - shared.settledAt < SHARED_ANSWER_MS);
  if (!refresh && shared && fresh) return shared.promise;

  const entry: { promise: Promise<WorkspaceAccess>; settledAt: number | null } = { promise: Promise.resolve(null as never), settledAt: null };
  entry.promise = (async () => {
    if (refresh) await user.getIdToken(true);
    return requestWorkspaceAccess();
  })().then(
    (access) => {
      entry.settledAt = Date.now();
      return access;
    },
    (error) => {
      if (sharedByUser.get(user.uid) === entry) sharedByUser.delete(user.uid);
      throw error;
    }
  );
  sharedByUser.set(user.uid, entry);
  return entry.promise;
}
