import type { Invitation } from '@/lib/types';

/**
 * Atomically reserve one successful invitation use and append its audit event.
 *
 * The transaction re-reads the authoritative counter, so concurrent token
 * requests cannot both pass a stale `maxUses` check.
 */
export async function reserveInvitationUse(
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
    const currentUses = latest.currentUses || 0;
    if (latest.maxUses && currentUses >= latest.maxUses) {
      return false;
    }

    transaction.update(invitationRef, {
      currentUses: currentUses + 1,
      'audit.lastAccessed': new Date(),
    });
    transaction.set(auditRef, accessAttemptData);
    return true;
  });
}
