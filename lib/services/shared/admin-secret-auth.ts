import crypto from 'crypto';
import { serviceError, serviceOk, type ServiceResult } from './service-result';

/**
 * Authenticates maintenance workers with a fail-closed shared secret. A missing
 * environment variable can never turn the string "undefined" into a credential.
 */
export function authorizeAdminSecret(req: Request): ServiceResult<undefined> {
  const configuredSecret = process.env.ADMIN_SECRET_KEY;
  if (!configuredSecret) {
    return serviceError(503, 'admin_auth_unavailable', 'Admin authentication is not configured');
  }
  if (!bearerSecretMatches(req, configuredSecret)) {
    return serviceError(401, 'admin_unauthorized', 'Unauthorized');
  }

  return serviceOk(undefined);
}

/**
 * True only when the Authorization header is exactly `Bearer <configuredSecret>`.
 * Both sides are hashed to equal-length digests and compared in constant time,
 * so response timing reveals neither the secret's length nor its prefix. An
 * empty configured secret never matches.
 */
export function bearerSecretMatches(req: Request, configuredSecret: string | undefined): boolean {
  if (!configuredSecret) {
    return false;
  }
  const authorization = req.headers.get('authorization') || '';
  const suppliedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const configuredDigest = crypto.createHash('sha256').update(configuredSecret).digest();
  const suppliedDigest = crypto.createHash('sha256').update(suppliedSecret).digest();
  return crypto.timingSafeEqual(configuredDigest, suppliedDigest);
}
