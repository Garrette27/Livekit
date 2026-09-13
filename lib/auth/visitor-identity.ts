import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import {
  visitorIdentityFromClaims,
  type VisitorIdentity,
} from '@/lib/invitations/admission-policy';

/**
 * The visitor's identity as the identity provider attests it, or undefined
 * when the request carries no usable Firebase ID token.
 *
 * Never throws. An absent, expired, or forged token means an unidentified
 * visitor, and what that costs them is the caller's decision: an invitation
 * queues them for the doctor, the consent route asks them to sign in.
 */
export async function verifyVisitorIdentity(req: Request): Promise<VisitorIdentity | undefined> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined;
  }

  try {
    const decoded = await getFirebaseAdminAuth()?.verifyIdToken(authHeader.slice(7));
    return decoded ? visitorIdentityFromClaims(decoded) : undefined;
  } catch (error) {
    console.warn('Ignoring unverifiable visitor token:', error);
    return undefined;
  }
}
