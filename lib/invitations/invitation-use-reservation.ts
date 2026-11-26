import type { Invitation } from '@/lib/types';

/**
 * Stored `maxUses` for a waiting-room invitation that stays reusable until it
 * expires. It is a legacy storage sentinel, not a real visit limit: the
 * waiting room and expiry are the actual controls. Never show this number to
 * a person; present it as "reusable until expiry"
 * (see formatInvitationUsage).
 */
export const REUSABLE_INVITATION_MAX_USES = 999999;

const MAX_ACCESS_EVENTS_PER_INVITATION = 100;
const MAX_ACCESS_EVENTS_PRUNED_PER_WRITE = 25;

/**
 * Keeps the invitation audit useful without turning a reusable link into an
 * indefinitely growing document tree. The newest event is written after old
 * overflow rows have been selected inside the same transaction.
 */
async function pruneOldAccessEvents(
  transaction: any,
  invitationRef: any
): Promise<any[]> {
  const overflowQuery = invitationRef
    .collection('accessAttempts')
    .orderBy('timestamp', 'desc')
    .offset(MAX_ACCESS_EVENTS_PER_INVITATION - 1)
    .limit(MAX_ACCESS_EVENTS_PRUNED_PER_WRITE);
  const overflow = await transaction.get(overflowQuery);
  return overflow.docs;
}

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
 * requests cannot both pass a stale `maxUses` check. Waiting-room arrivals use
 * reserveWaitingVisit instead, which adds queue capacity and visit binding.
 */
export async function reserveInvitationUse(
  db: any,
  invitationId: string,
  accessAttemptData: Record<string, unknown>,
  options: { markUsed?: boolean; usedByHash?: string } = {}
): Promise<boolean> {
  const invitationRef = db.collection('invitations').doc(invitationId);
  const auditRef = invitationRef.collection('accessAttempts').doc();

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

    const overflowEvents = await pruneOldAccessEvents(transaction, invitationRef);

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
    overflowEvents.forEach((eventDocument) => transaction.delete(eventDocument.ref));
    transaction.set(auditRef, accessAttemptData);
    return true;
  });
}

/** Default waiting target when an invitation predates the maxPatients field. */
export const DEFAULT_MAX_WAITING_PATIENTS = 10;

/** Row states that end a visit; arriving on such a row starts a new visit. */
const ENDED_VISIT_STATUSES = new Set(['left', 'rejected']);

export type WaitingVisitReservation =
  | { outcome: 'reserved'; visitId: string; startedNewVisit: boolean }
  /** The invitation's waiting target is already met by other visitors. */
  | { outcome: 'full'; maxPatients: number }
  /** Missing, revoked, expired or exhausted invitation. */
  | { outcome: 'unavailable' };

/**
 * Atomically places one visitor on an invitation's queue entry: it consumes an
 * invitation use, writes the audit event, enforces the waiting target, and
 * decides which visit the entry now represents — all in one transaction.
 *
 * Capacity: a visitor who would add a `waiting` row is refused when the
 * invitation already has `maxPatients` waiting rows. The count is read inside
 * the same transaction that updates the invitation document, and every
 * reservation for an invitation writes that document, so two concurrent
 * arrivals conflict and one retries against the other's committed row. A
 * visitor already waiting, or arriving directly admitted, does not consume a
 * waiting place.
 *
 * Visits: the entry id is stable per invitation and patient, so the same
 * document is reused when a person returns. A missing row, or one that ended
 * (`left`/`rejected`), starts a new visit: it receives `newVisitId`, a fresh
 * `joinedAt`, and its previous end markers are cleared, so a returning
 * visitor queues behind people already waiting instead of inheriting
 * yesterday's arrival time. Credentials carry the returned visitId, and
 * admission checks compare it with `currentVisitId`, so a credential from an
 * earlier visit cannot act on a later one.
 */
export async function reserveWaitingVisit(
  db: any,
  invitationId: string,
  accessAttemptData: Record<string, unknown>,
  waitingPatient: {
    id: string;
    roomName: string;
    /** Row status this arrival requests: queued, or verified direct entry. */
    status: 'waiting' | 'admitted';
    /** Fields written only when a new visit starts. */
    onNewVisit: Record<string, unknown>;
    /** Fields refreshed on every arrival. */
    onEachVisit: Record<string, unknown>;
    /** Immutable per-arrival history record. */
    visit?: Record<string, unknown>;
    /** Candidate id, used only if this arrival starts a new visit. */
    newVisitId: string;
  }
): Promise<WaitingVisitReservation> {
  const invitationRef = db.collection('invitations').doc(invitationId);
  const auditRef = invitationRef.collection('accessAttempts').doc();
  const waitingPatientRef = db.collection('waitingPatients').doc(waitingPatient.id);

  return db.runTransaction(async (transaction: any) => {
    // Firestore transactions require every read before the first write.
    const latestDocument = await transaction.get(invitationRef);
    if (!latestDocument.exists) {
      return { outcome: 'unavailable' };
    }
    const existingRow = await transaction.get(waitingPatientRef);

    const latest = latestDocument.data() as Invitation;
    const currentUses = latest.currentUses || 0;
    if (!invitationIsActive(latest) || (latest.maxUses && currentUses >= latest.maxUses)) {
      return { outcome: 'unavailable' };
    }

    const existing = existingRow?.exists ? existingRow.data() || {} : null;
    const startedNewVisit = !existing || ENDED_VISIT_STATUSES.has(String(existing.status));
    const addsWaitingRow = waitingPatient.status === 'waiting'
      && (startedNewVisit || existing?.status !== 'waiting');

    if (addsWaitingRow) {
      const maxPatients = latest.maxPatients || DEFAULT_MAX_WAITING_PATIENTS;
      const waitingRows = await transaction.get(
        db.collection('waitingPatients')
          .where('roomName', '==', waitingPatient.roomName)
          .where('invitationId', '==', invitationId)
          .where('status', '==', 'waiting')
      );
      if (waitingRows.size >= maxPatients) {
        return { outcome: 'full', maxPatients };
      }
    }

    const overflowEvents = await pruneOldAccessEvents(transaction, invitationRef);

    const existingVisitId = typeof existing?.currentVisitId === 'string' ? existing.currentVisitId : '';
    // Legacy rows created before visit binding receive an id on their next arrival.
    const visitId = startedNewVisit || !existingVisitId ? waitingPatient.newVisitId : existingVisitId;
    const now = new Date();

    transaction.update(invitationRef, {
      currentUses: currentUses + 1,
      'audit.lastAccessed': now,
    });
    overflowEvents.forEach((eventDocument) => transaction.delete(eventDocument.ref));
    transaction.set(auditRef, accessAttemptData);
    transaction.set(
      waitingPatientRef,
      {
        ...(startedNewVisit
          ? {
              ...waitingPatient.onNewVisit,
              joinedAt: now,
              admittedAt: null,
              leftAt: null,
              rejectedAt: null,
            }
          : {}),
        ...waitingPatient.onEachVisit,
        status: waitingPatient.status,
        currentVisitId: visitId,
      },
      { merge: true }
    );
    if (waitingPatient.visit) {
      transaction.set(
        waitingPatientRef.collection('visits').doc(),
        { ...waitingPatient.visit, visitId, startedNewVisit }
      );
    }
    return { outcome: 'reserved', visitId, startedNewVisit };
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

    const overflowEvents = await pruneOldAccessEvents(transaction, invitationRef);

    transaction.update(invitationRef, { 'audit.lastAccessed': new Date() });
    overflowEvents.forEach((eventDocument) => transaction.delete(eventDocument.ref));
    transaction.set(auditRef, accessAttemptData);
    return true;
  });
}
