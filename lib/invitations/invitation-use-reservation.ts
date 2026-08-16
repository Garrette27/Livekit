import type { Invitation } from '@/lib/types';

function invitationIsActive(invitation: Invitation): boolean {
  const expiresAt = invitation.expiresAt?.toDate?.()
    || (invitation.expiresAt instanceof Date ? invitation.expiresAt : null);

  return (!invitation.status || invitation.status === 'active')
    && (!expiresAt || expiresAt.getTime() > Date.now());
}

/**
 * Atomically reserve one successful invitation use and append its audit event.
 *
 * The transaction re-reads the authoritative counter, so concurrent token
 * requests cannot both pass a stale `maxUses` check.
 */
export async function reserveInvitationUse(
  db: any,
  invitationId: string,
  accessAttemptData: Record<string, unknown>,
  options: {
    markUsed?: boolean;
    usedByHash?: string;
    waitingPatient?: { id: string; data: Record<string, unknown> };
  } = {}
): Promise<boolean> {
  const invitationRef = db.collection('invitations').doc(invitationId);
  const auditRef = invitationRef.collection('accessAttempts').doc();
  const waitingPatientRef = options.waitingPatient
    ? db.collection('waitingPatients').doc(options.waitingPatient.id)
    : null;

  return db.runTransaction(async (transaction: any) => {
    const latestDocument = await transaction.get(invitationRef);
    if (!latestDocument.exists) {
      return false;
    }

    const latest = latestDocument.data() as Invitation;
    if (
      !invitationIsActive(latest)
      || (options.markUsed && Boolean(latest.usedAt))
    ) {
      return false;
    }

    const currentUses = latest.currentUses || 0;
    if (latest.maxUses && currentUses >= latest.maxUses) {
      return false;
    }

    transaction.update(invitationRef, {
      currentUses: currentUses + 1,
      'audit.lastAccessed': new Date(),
      ...(options.markUsed
        ? {
            status: 'used',
            usedAt: new Date(),
            ...(options.usedByHash ? { usedBy: options.usedByHash } : {}),
          }
        : {}),
    });
    transaction.set(auditRef, accessAttemptData);
    if (waitingPatientRef && options.waitingPatient) {
      transaction.set(waitingPatientRef, options.waitingPatient.data);
    }
    return true;
  });
}

/**
 * Record a reconnect for an already admitted patient without consuming
 * another invitation use. The transaction prevents a token from being issued
 * if the doctor revoked the invitation or it expired during validation.
 */
export async function recordExistingInvitationAccess(
  db: any,
  invitationId: string,
  accessAttemptData: Record<string, unknown>
): Promise<boolean> {
  const invitationRef = db.collection('invitations').doc(invitationId);
  const auditRef = invitationRef.collection('accessAttempts').doc();

  return db.runTransaction(async (transaction: any) => {
    const latestDocument = await transaction.get(invitationRef);
    if (!latestDocument.exists) {
      return false;
    }

    const latest = latestDocument.data() as Invitation;
    if (!invitationIsActive(latest)) {
      return false;
    }

    transaction.update(invitationRef, { 'audit.lastAccessed': new Date() });
    transaction.set(auditRef, accessAttemptData);
    return true;
  });
}
