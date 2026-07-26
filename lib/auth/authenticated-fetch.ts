'use client';

import { auth } from '@/lib/firebase';

/**
 * Sends a same-origin request as the current Firebase user. Callers own only
 * their domain payload; token retrieval and Authorization header construction
 * stay centralized here.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }

  const idToken = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
