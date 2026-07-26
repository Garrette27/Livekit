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

  const authorization = req.headers.get('authorization') || '';
  const suppliedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const configuredDigest = crypto.createHash('sha256').update(configuredSecret).digest();
  const suppliedDigest = crypto.createHash('sha256').update(suppliedSecret).digest();
  if (!crypto.timingSafeEqual(configuredDigest, suppliedDigest)) {
    return serviceError(401, 'admin_unauthorized', 'Unauthorized');
  }

  return serviceOk(undefined);
}
