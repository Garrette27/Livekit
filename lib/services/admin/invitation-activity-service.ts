import { createHash } from 'crypto';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { OversightScope } from '@/lib/services/admin/oversight-service';

/**
 * "Who created which invitation, and who came through it" for administrators.
 *
 * Pattern: an audit-trail read model (time · actor · action · target ·
 * outcome, as in Microsoft Entra audit logs) projected from records the
 * invitation flow already writes: the invitation document (creating doctor,
 * expiry, status) and its waiting-room rows (arrival, admission, outcome).
 * Nothing new is written, so invitations created before this view appear too.
 *
 * Minimum necessary: the creating doctor is named, because staff accountability
 * is the purpose. Patients are described by how they arrived (verified invited
 * account, signed-in account, guest) plus a short pseudonymous reference that
 * matches repeat visits; their names, emails, chat and clinical content are
 * never read into this result. The owning doctor still sees names in their queue.
 *
 * Scope comes only from server authority: the platform owner sees all
 * invitations; a clinic administrator only invitations created by doctors in
 * their verified clinic.
 */

export const ACTIVITY_INVITATION_LIMIT = 25;
const ARRIVALS_PER_INVITATION = 10;
const MAX_CLINIC_DOCTORS = 200;
const FIRESTORE_IN_LIMIT = 30;

export type InvitationLifecycle = 'active' | 'expired' | 'revoked' | 'used';
export type VisitStatus = 'waiting' | 'admitted' | 'left' | 'rejected';

export interface InvitationArrival {
  /** Short pseudonymous reference; the same visitor on the same invitation keeps it. */
  visitorRef: string;
  visitor: 'Verified invited account' | 'Signed-in account' | 'Guest (typed name)';
  status: VisitStatus;
  admission: 'joined directly' | 'admitted by doctor' | 'not admitted';
  arrivedAt: string | null;
  admittedAt: string | null;
  lastSeenAt: string | null;
}

export interface InvitationActivity {
  invitationRef: string;
  createdAt: string | null;
  expiresAt: string | null;
  lifecycle: InvitationLifecycle;
  doctor: { name: string; email: string | null };
  usage: 'reusable until expiry' | 'single use';
  visits: Record<VisitStatus, number> & { total: number };
  arrivals: InvitationArrival[];
}

export interface InvitationActivitySnapshot {
  scope: 'platform' | 'clinic';
  generatedAt: string;
  invitations: InvitationActivity[];
}

type Data = Record<string, any>;

const toDate = (value: unknown): Date | null => {
  const date = value instanceof Date ? value : (value as { toDate?: () => Date })?.toDate?.();
  return date && Number.isFinite(date.getTime()) ? date : null;
};
const iso = (value: unknown) => toDate(value)?.toISOString() ?? null;
const pseudonym = (value: string) => createHash('sha256').update(`invitation-activity\0${value}`).digest('hex').slice(0, 6);

function lifecycleOf(invitation: Data, now: Date): InvitationLifecycle {
  if (invitation.status === 'revoked') return 'revoked';
  if (invitation.status === 'used') return 'used';
  const expiresAt = toDate(invitation.expiresAt);
  return expiresAt && expiresAt.getTime() <= now.getTime() ? 'expired' : 'active';
}

function arrivalOf(row: Data, rowId: string): InvitationArrival {
  const status: VisitStatus = ['waiting', 'admitted', 'left', 'rejected'].includes(row.status) ? row.status : 'left';
  const direct = row.metadata?.admissionMode === 'auto-email-match';
  const admittedAt = iso(row.admittedAt);
  return {
    visitorRef: pseudonym(rowId),
    visitor: direct ? 'Verified invited account' : row.metadata?.isAnonymous === false ? 'Signed-in account' : 'Guest (typed name)',
    status,
    admission: direct ? 'joined directly' : admittedAt || status === 'admitted' ? 'admitted by doctor' : 'not admitted',
    arrivedAt: iso(row.joinedAt),
    admittedAt,
    lastSeenAt: iso(row.lastSeenAt),
  };
}

/**
 * Pure projection of invitation documents and their waiting-room rows into
 * administrator rows, newest invitation first. Only allowlisted fields are
 * copied, so a new sensitive field on either record cannot leak through.
 */
export function projectInvitationActivity(
  invitations: Array<{ id: string; data: Data }>,
  waitingRows: Array<{ id: string; data: Data }>,
  now: Date = new Date()
): InvitationActivity[] {
  const rowsByInvitation = new Map<string, Array<{ id: string; data: Data }>>();
  for (const row of waitingRows) {
    const key = String(row.data.invitationId || '');
    if (!key) continue;
    rowsByInvitation.set(key, [...(rowsByInvitation.get(key) || []), row]);
  }
  return invitations
    .map(({ id, data }) => {
      const rows = (rowsByInvitation.get(id) || [])
        .sort((left, right) => (toDate(right.data.joinedAt)?.getTime() ?? 0) - (toDate(left.data.joinedAt)?.getTime() ?? 0));
      const arrivals = rows.map((row) => arrivalOf(row.data, row.id));
      const visits = { total: arrivals.length, waiting: 0, admitted: 0, left: 0, rejected: 0 };
      arrivals.forEach((arrival) => { visits[arrival.status] += 1; });
      const metadata = data.metadata || {};
      return {
        invitationRef: pseudonym(id),
        createdAt: iso(data.createdAt),
        expiresAt: iso(data.expiresAt),
        lifecycle: lifecycleOf(data, now),
        doctor: {
          name: typeof metadata.doctorName === 'string' && metadata.doctorName !== 'Dr. System' ? metadata.doctorName.slice(0, 120) : 'Unnamed doctor',
          email: typeof metadata.doctorEmail === 'string' && metadata.doctorEmail !== 'system@example.com' ? metadata.doctorEmail.slice(0, 254) : null,
        },
        usage: data.waitingRoomEnabled === false ? 'single use' as const : 'reusable until expiry' as const,
        visits,
        arrivals: arrivals.slice(0, ARRIVALS_PER_INVITATION),
      };
    })
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
}

const chunks = <T,>(values: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));

const asRecord = (doc: QueryDocumentSnapshot) => ({ id: doc.id, data: doc.data() as Data });

/** Loads the newest invitations in scope and their waiting-room rows (bounded reads). */
export async function buildInvitationActivity(db: Firestore, scope: OversightScope, now: Date = new Date()): Promise<InvitationActivitySnapshot> {
  const invitations = db.collection('invitations');
  let invitationDocs: QueryDocumentSnapshot[];

  if (scope.level === 'super_admin') {
    invitationDocs = (await invitations.orderBy('createdAt', 'desc').limit(ACTIVITY_INVITATION_LIMIT).get()).docs;
  } else {
    if (!scope.clinicId) return { scope: 'clinic', generatedAt: now.toISOString(), invitations: [] };
    const doctors = await db.collection('users')
      .where('role', '==', 'doctor').where('clinicId', '==', scope.clinicId).limit(MAX_CLINIC_DOCTORS).get();
    const doctorIds = doctors.docs.map((doc) => doc.id);
    const pages = await Promise.all(chunks(doctorIds, FIRESTORE_IN_LIMIT).map((ids) =>
      invitations.where('createdBy', 'in', ids).orderBy('createdAt', 'desc').limit(ACTIVITY_INVITATION_LIMIT).get()));
    invitationDocs = pages.flatMap((page) => page.docs)
      .sort((left, right) => (toDate(right.get('createdAt'))?.getTime() ?? 0) - (toDate(left.get('createdAt'))?.getTime() ?? 0))
      .slice(0, ACTIVITY_INVITATION_LIMIT);
  }

  const ids = invitationDocs.map((doc) => doc.id);
  const rowPages = await Promise.all(chunks(ids, FIRESTORE_IN_LIMIT).map((page) =>
    db.collection('waitingPatients').where('invitationId', 'in', page).limit(300).get()));

  return {
    scope: scope.level === 'super_admin' ? 'platform' : 'clinic',
    generatedAt: now.toISOString(),
    invitations: projectInvitationActivity(invitationDocs.map(asRecord), rowPages.flatMap((page) => page.docs).map(asRecord), now),
  };
}
