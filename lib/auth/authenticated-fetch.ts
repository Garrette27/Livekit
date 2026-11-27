'use client';

import { auth } from '@/lib/firebase';

/**
 * Sends a same-origin request as the current Firebase user. Callers own only
 * their domain payload; token retrieval and Authorization header construction
 * stay centralized here.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  expectedUserId?: string
): Promise<Response> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  if (expectedUserId && user.uid !== expectedUserId) throw new Error('Your signed-in account changed. Reload this workspace.');

  const idToken = await user.getIdToken();
  if (auth?.currentUser?.uid !== user.uid) throw new Error('Your signed-in account changed. Reload this workspace.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);

  const response = await fetch(input, {
    ...init,
    headers,
  });
  if (auth?.currentUser?.uid !== user.uid) throw new Error('Your signed-in account changed. Reload this workspace.');
  return response;
}
