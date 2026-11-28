import type { Firestore, Query } from 'firebase-admin/firestore';

/** Server maximum for one audit page, per docs/admin-oversight-design.md. */
export const AUDIT_PAGE_SIZE = 50;

export type OversightScope =
  | { level: 'super_admin' }
  | { level: 'admin'; clinicId: string | null };

/** One aggregate with an explicit label, so a card never shows an unlabeled number. */
export interface OversightMetric {
  key: string;
  label: string;
  value: number;
}

/** Metadata-only audit row: ids, action and time. Never names, emails or clinical text. */
export interface OversightAuditEvent {
  id: string;
  at: string | null;
  action: string;
  role: string | null;
  clinicId: string | null;
  actorUid: string | null;
  targetUid: string | null;
}

export interface OversightSnapshot {
  scope: 'platform' | 'clinic';
  generatedAt: string;
  metrics: OversightMetric[];
  retention: { ranAt: string | null; enabled: boolean; days: number; eligibleBefore: number; deletedCount: number } | null;
  auditEvents: OversightAuditEvent[];
}

const isoOrNull = (value: unknown): string | null => {
  const date = value instanceof Date ? value : (value as { toDate?: () => Date })?.toDate?.();
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

/**
 * Builds the administrator oversight view: control-plane aggregates plus the
 * most recent page of administrative audit events, scoped by server authority.
 *
 * - A platform owner sees platform-wide operating counts (staff, invitations,
 *   encounters, summary review/failure backlog, upcoming appointments) and all
 *   administrative events.
 * - A clinic administrator sees only their verified clinic's staff counts and
 *   audit events; clinical/operational counts are not clinic-scoped today, so
 *   they are withheld rather than shown as misleading platform totals.
 *
 * Every number is a Firestore `count()` aggregation (no documents are read),
 * so the view costs roughly one read per 1,000 matching index entries. No
 * patient identity, transcript, summary text or chat is ever read or returned.
 */
export async function buildOversightSnapshot(db: Firestore, scope: OversightScope, now: Date = new Date()): Promise<OversightSnapshot> {
  const count = async (key: string, label: string, query: Query): Promise<OversightMetric> =>
    ({ key, label, value: (await query.count().get()).data().count });
  const users = db.collection('users');
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  if (scope.level === 'admin') {
    if (!scope.clinicId) return { scope: 'clinic', generatedAt: now.toISOString(), metrics: [], retention: null, auditEvents: [] };
    const [doctors, events] = await Promise.all([
      count('doctors', 'Provisioned doctors in your clinic', users.where('role', '==', 'doctor').where('clinicId', '==', scope.clinicId)),
      db.collection('adminAuditEvents').where('clinicId', '==', scope.clinicId).orderBy('at', 'desc').limit(AUDIT_PAGE_SIZE).get(),
    ]);
    return { scope: 'clinic', generatedAt: now.toISOString(), metrics: [doctors], retention: null, auditEvents: events.docs.map(auditRow) };
  }

  const [metrics, retentionDoc, events] = await Promise.all([
    Promise.all([
      count('doctors', 'Provisioned doctors', users.where('role', '==', 'doctor')),
      count('admins', 'Clinic administrators', users.where('role', '==', 'admin')),
      count('patients', 'Patient accounts', users.where('role', '==', 'patient')),
      count('activeInvitations', 'Active invitations', db.collection('invitations').where('status', '==', 'active')),
      count('encounters30d', 'Encounters, last 30 days', db.collection('consultationSessions').where('sessionStartedAt', '>=', since30)),
      count('summaries30d', 'Summaries created, last 30 days', db.collection('call-summaries').where('createdAt', '>=', since30)),
      count('awaitingReview', 'AI drafts awaiting clinician review', db.collection('call-summaries').where('metadata.requiresClinicianReview', '==', true)),
      count('failedSummaryJobs', 'Summary jobs in retry queue (failed)', db.collection('summaryJobs').where('status', '==', 'failed')),
      count('upcomingAppointments', 'Upcoming booked appointments', db.collection('appointments').where('startsAt', '>=', now)),
    ]),
    db.collection('retention-runs').orderBy('ranAt', 'desc').limit(1).get(),
    db.collection('adminAuditEvents').orderBy('at', 'desc').limit(AUDIT_PAGE_SIZE).get(),
  ]);
  const last = retentionDoc.docs[0]?.data();
  return {
    scope: 'platform',
    generatedAt: now.toISOString(),
    metrics,
    retention: last ? {
      ranAt: isoOrNull(last.ranAt), enabled: last.enabled === true, days: Number(last.days) || 0,
      eligibleBefore: Number(last.eligibleBefore) || 0, deletedCount: Number(last.deletedCount) || 0,
    } : null,
    auditEvents: events.docs.map(auditRow),
  };
}

function auditRow(doc: FirebaseFirestore.QueryDocumentSnapshot): OversightAuditEvent {
  const data = doc.data();
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 128) : null);
  return {
    id: doc.id,
    at: isoOrNull(data.at),
    action: text(data.action) || 'unknown',
    role: text(data.role),
    clinicId: text(data.clinicId),
    actorUid: text(data.actorUid),
    targetUid: text(data.targetUid),
  };
}
