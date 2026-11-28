import type { Firestore } from 'firebase-admin/firestore';
import { finalizeConsultationForRoom } from '@/lib/services/consultation-finalization';
import { FirestoreInvitationAccessCore } from '@/lib/services/invitation-access';
import { InvitationRepository } from '@/lib/repositories/invitation-repository';
import { serviceError, serviceOk, type ServiceResult } from '@/lib/services/shared/service-result';

export interface InvitationRevocation {
  invitationId: string;
  revokedAt: string;
  removedParticipantsCount: number;
  finalization: { consultationSessionId: string; finalDurationMinutes: number } | null;
}

/**
 * Revoke one invitation owned by `doctorUserId`: mark it revoked (idempotent),
 * reject everyone still waiting or admitted through it, and finalize the room's
 * open encounter so the summary pipeline runs. The single owner of revocation
 * side effects, used by the Revoke button and by appointment cancellation.
 */
export async function revokeInvitation(db: Firestore, invitationId: string, doctorUserId: string): Promise<ServiceResult<InvitationRevocation>> {
  const invitationRepo = new InvitationRepository(db);
  const invitationDoc = await invitationRepo.getById(invitationId);
  if (!invitationDoc.exists) return serviceError(404, 'invitation_not_found', 'Invitation not found');
  const invitation = invitationDoc.data() as { roomName?: string; status?: string; createdBy?: string };
  if (invitation.createdBy !== doctorUserId) {
    return serviceError(403, 'invitation_forbidden', 'You can only revoke invitations created by your account');
  }

  const revokedAt = new Date();
  if (invitation.status !== 'revoked') {
    await invitationRepo.mergeFields(invitationId, { status: 'revoked', revokedAt });
  }

  const invitationAccess = new FirestoreInvitationAccessCore(db);
  const activeWaitingEntries = await invitationAccess.listWaitingEntries({
    invitationId,
    statuses: ['waiting', 'admitted'],
    activeOnly: false,
  });
  await Promise.all(activeWaitingEntries.map((waitingEntry) =>
    invitationAccess.rejectWaitingEntry({ waitingPatientId: waitingEntry.id, doctorUserId })
  ));

  let finalization: InvitationRevocation['finalization'] = null;
  if (invitation.roomName) {
    finalization = await finalizeConsultationForRoom(db, {
      roomName: invitation.roomName,
      finalizedAt: revokedAt,
      reason: 'invitation_revoked',
      regenerateSummary: true,
    });
    if (finalization) {
      await invitationRepo.mergeFields(invitationId, {
        metadata: {
          finalization: {
            at: revokedAt.toISOString(),
            reason: 'invitation_revoked',
            consultationSessionId: finalization.consultationSessionId,
            finalDurationMinutes: finalization.finalDurationMinutes,
            removedParticipantsCount: activeWaitingEntries.length,
          },
        },
      });
    }
  }

  return serviceOk({ invitationId, revokedAt: revokedAt.toISOString(), removedParticipantsCount: activeWaitingEntries.length, finalization });
}

/** Maximum active invitations one appointment cancellation revokes; a visit room normally has one. */
export const MAX_CASCADE_REVOCATIONS = 10;

/**
 * Revoke this doctor's still-active invitations for `roomName` (cascade from a
 * cancelled appointment). Bounded and owner-scoped; returns how many were revoked.
 */
export async function revokeActiveInvitationsForRoom(db: Firestore, doctorUserId: string, roomName: string): Promise<number> {
  const snapshot = await db.collection('invitations')
    .where('createdBy', '==', doctorUserId)
    .where('roomName', '==', roomName)
    .where('status', '==', 'active')
    .limit(MAX_CASCADE_REVOCATIONS)
    .get();
  let revoked = 0;
  for (const doc of snapshot.docs) {
    const result = await revokeInvitation(db, doc.id, doctorUserId);
    if (result.ok) revoked += 1;
  }
  return revoked;
}
