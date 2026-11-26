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

export type WaitingVisitReservation =
  | {
      outcome: 'reserved';
      visitId: string;
      startedNewVisit: boolean;
      /** Status the entry holds after this arrival; may differ from the request. */
      status: 'waiting' | 'admitted';
    }
  /** The invitation's waiting target is already met by other visitors. */
  | { outcome: 'full'; maxPatients: number }
  /** Missing, revoked, expired or exhausted invitation. */
  | { outcome: 'unavailable' };

/**
 * Decides what an arrival means for an existing queue entry. Pure, so the
 * rules can be read (and tested) apart from the transaction that applies them.
 *
 * - No entry, or one whose visit ended by leaving: a new visit with the
 *   requested status.
 * - An entry the doctor rejected: a new visit that always waits. A rejection
 *   is the doctor's decision about this person on this invitation, so even a
 *   verified allowlisted account must be admitted by the doctor again.
 * - An entry still waiting: the same visit, still waiting.
 * - An entry already admitted: the same visit stays admitted when the entry
 *   is keyed by a verified principal (`principalKeyed`); otherwise (a
 *   device-keyed guest) the arrival starts a new waiting visit, so another
 *   person behind the same network and browser cannot inherit the admission.
 */
export function planWaitingArrival(input: {
  existingStatus: string | null;
  requestedStatus: 'waiting' | 'admitted';
  principalKeyed: boolean;
}): { startedNewVisit: boolean; status: 'waiting' | 'admitted' } {
  switch (input.existingStatus) {
    case null:
    case 'left':
      return { startedNewVisit: true, status: input.requestedStatus };
    case 'rejected':
      return { startedNewVisit: true, status: 'waiting' };
    case 'waiting':
      return { startedNewVisit: false, status: 'waiting' };
    case 'admitted':
      return input.principalKeyed
        ? { startedNewVisit: false, status: 'admitted' }
        : { startedNewVisit: true, status: 'waiting' };
    default:
      return { startedNewVisit: true, status: 'waiting' };
  }
}

/**
 * Atomically places one visitor on an invitation's queue entry: it applies
 * planWaitingArrival, enforces the waiting target, consumes an invitation use
 * when (and only when) a new visit starts, and writes the audit event — all
 * in one transaction.
 *
 * Capacity: an arrival that would add a `waiting` row is refused when the
 * invitation already has `maxPatients` waiting rows. The count is read inside
 * the same transaction that updates the invitation document, and every
 * reservation for an invitation writes that document, so two concurrent
 * arrivals conflict and one retries against the other's committed row.
 *
 * Uses: a reconnect to a visit that is still open does not spend another use
 * and is not refused by an exhausted `maxUses`; only a new visit is.
 *
 * Visits: a new visit receives `newVisitId`, a fresh `joinedAt`, and cleared
 * end markers, so a returning visitor queues behind people already waiting.
 * Credentials carry the returned visitId, and admission checks compare it with
 * `currentVisitId`, so a credential from an earlier visit cannot act on a
 * later one.
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
    /** True when `id` was derived from a server-verified Firebase uid. */
    principalKeyed: boolean;
    /** How the visitor was identified, for the invitation's visit breakdown. */
    visitorKind?: 'verifiedAccounts' | 'unverifiedAccounts' | 'guests';
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
    if (!invitationIsActive(latest)) {
      return { outcome: 'unavailable' };
    }

    const existing = existingRow?.exists ? existingRow.data() || {} : null;
    const plan = planWaitingArrival({
      existingStatus: existing ? String(existing.status) : null,
      requestedStatus: waitingPatient.status,
      principalKeyed: waitingPatient.principalKeyed,
    });

    const currentUses = latest.currentUses || 0;
    if (plan.startedNewVisit && latest.maxUses && currentUses >= latest.maxUses) {
      return { outcome: 'unavailable' };
    }

    const addsWaitingRow = plan.status === 'waiting'
      && (plan.startedNewVisit || existing?.status !== 'waiting');
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
    const visitId = plan.startedNewVisit || !existingVisitId ? waitingPatient.newVisitId : existingVisitId;
    const now = new Date();

    const stats = (latest as Invitation & { visitStats?: Record<string, number> }).visitStats || {};
    const kind = waitingPatient.visitorKind || 'guests';
    transaction.update(invitationRef, {
      ...(plan.startedNewVisit
        ? {
            currentUses: currentUses + 1,
            'visitStats.total': (stats.total || 0) + 1,
            [`visitStats.${kind}`]: (stats[kind] || 0) + 1,
          }
        : {}),
      'audit.lastAccessed': now,
    });
    overflowEvents.forEach((eventDocument) => transaction.delete(eventDocument.ref));
    transaction.set(auditRef, accessAttemptData);
    transaction.set(
      waitingPatientRef,
      {
        ...(plan.startedNewVisit
          ? {
              ...waitingPatient.onNewVisit,
              joinedAt: now,
              admittedAt: plan.status === 'admitted' ? now : null,
              leftAt: null,
              rejectedAt: null,
            }
          : {}),
        ...waitingPatient.onEachVisit,
        status: plan.status,
        currentVisitId: visitId,
      },
      { merge: true }
    );
    if (waitingPatient.visit) {
      transaction.set(
        waitingPatientRef.collection('visits').doc(),
        { ...waitingPatient.visit, status: plan.status, visitId, startedNewVisit: plan.startedNewVisit }
      );
    }
    return { outcome: 'reserved', visitId, startedNewVisit: plan.startedNewVisit, status: plan.status };
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
