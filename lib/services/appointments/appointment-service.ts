import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { APPOINTMENT_CANCELLATION_REASONS, type AppointmentCancellationReason, type AppointmentCommand, type AppointmentFields } from '@/lib/appointments/appointment-policy';
import { serviceError, serviceOk, type ServiceResult } from '../shared/service-result';

export interface AppointmentRecord extends AppointmentFields {
  id: string;
  doctorUserId: string;
  status: 'booked' | 'cancelled';
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Lifecycle metadata, set only when status is `cancelled`. */
  cancellation: { at: string; byUserId: string; reason: AppointmentCancellationReason; revokedInvitationCount: number | null } | null;
}

/** Immutable request receipt, distinct from later mutable booking state. Never logged or returned. */
function creationIntentHash(fields: AppointmentFields): string {
  return createHash('sha256').update(JSON.stringify([fields.patientName, fields.patientEmail, fields.startsAt, fields.endsAt, fields.displayTimeZone])).digest('hex');
}

/** Normalize SDK dates at the server boundary; malformed stored records fail closed. */
function isoDate(value: unknown): string {
  const date = value instanceof Date ? value : (value as { toDate?: () => Date })?.toDate?.();
  if (!date || !Number.isFinite(date.getTime())) throw new Error('Invalid appointment timestamp');
  return date.toISOString();
}

function appointmentRecord(id: string, value: Record<string, unknown>): AppointmentRecord {
  if (typeof value.doctorUserId !== 'string' || typeof value.patientName !== 'string' || typeof value.displayTimeZone !== 'string' || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || !['booked', 'cancelled'].includes(String(value.status)) || (value.patientEmail !== null && typeof value.patientEmail !== 'string')) {
    throw new Error('Invalid stored appointment');
  }
  return {
    id, doctorUserId: value.doctorUserId, patientName: value.patientName,
    patientEmail: value.patientEmail as string | null, displayTimeZone: value.displayTimeZone,
    status: value.status as 'booked' | 'cancelled', version: Number(value.version),
    startsAt: isoDate(value.startsAt), endsAt: isoDate(value.endsAt),
    createdAt: isoDate(value.createdAt), updatedAt: isoDate(value.updatedAt),
    cancellation: storedCancellation(value),
  };
}

/** Records cancelled before this metadata existed project as `null` rather than failing. */
function storedCancellation(value: Record<string, unknown>): AppointmentRecord['cancellation'] {
  const raw = value.cancellation as Record<string, unknown> | undefined;
  if (value.status !== 'cancelled' || !raw || typeof raw !== 'object') return null;
  let at: string;
  try { at = isoDate(raw.at); } catch { return null; }
  const reason = APPOINTMENT_CANCELLATION_REASONS.includes(raw.reason as AppointmentCancellationReason) ? raw.reason as AppointmentCancellationReason : 'other';
  return {
    at, byUserId: typeof raw.byUserId === 'string' ? raw.byUserId : '', reason,
    revokedInvitationCount: Number.isSafeInteger(raw.revokedInvitationCount) ? Number(raw.revokedInvitationCount) : null,
  };
}

/**
 * Owns calendar persistence and overlap serialization. A per-doctor lock makes
 * two initially empty overlap queries contend on one versioned document.
 * The caller identity is supplied by server auth, never the booking command.
 */
export class AppointmentService {
  constructor(private readonly db: Firestore, private readonly now: () => Date = () => new Date()) {}

  /** A bounded, stable-order page of this doctor's bookings, including recent cancellations. */
  async list(doctorUserId: string, cursor?: string): Promise<ServiceResult<{ appointments: AppointmentRecord[]; nextCursor: string | null }>> {
    let after: { startsAt: string; id: string } | null = null;
    if (cursor) {
      try {
        if (cursor.length > 512) throw new Error();
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!after || typeof after.startsAt !== 'string' || !Number.isFinite(Date.parse(after.startsAt)) || typeof after.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(after.id)) throw new Error();
      } catch { return serviceError(400, 'invalid_cursor', 'Refresh the booking list and try again.'); }
    }
    let query = this.db.collection('appointments').where('doctorUserId', '==', doctorUserId)
      .where('startsAt', '>=', new Date(this.now().getTime() - 30 * 86_400_000))
      .orderBy('startsAt', 'asc').orderBy(FieldPath.documentId(), 'asc');
    if (after) query = query.startAfter(new Date(after.startsAt), after.id);
    const snapshot = await query.limit(51).get();
    const appointments = snapshot.docs.slice(0, 50).map((doc) => appointmentRecord(doc.id, doc.data()));
    const last = appointments.at(-1);
    const nextCursor = snapshot.size > 50 && last ? Buffer.from(JSON.stringify({ startsAt: last.startsAt, id: last.id })).toString('base64url') : null;
    return serviceOk({ appointments, nextCursor });
  }

  /**
   * Record how many invitation links the cancellation revoked. Written after
   * the cascade, so a crash in between leaves `null` (unknown), never a false 0.
   */
  async recordRevokedInvitations(appointmentId: string, count: number): Promise<void> {
    await this.db.collection('appointments').doc(appointmentId).set({ cancellation: { revokedInvitationCount: count } }, { merge: true });
  }

  /** Commit a validated command, returning conflicts without mutating either booking or calendar. */
  async execute(doctorUserId: string, command: AppointmentCommand): Promise<ServiceResult<{ appointment: AppointmentRecord; replayed?: boolean }>> {
    const ref = this.db.collection('appointments').doc(command.id);
    const calendar = this.db.collection('appointmentCalendars').doc(doctorUserId);
    const at = this.now();
    return this.db.runTransaction(async (transaction) => {
      const calendarDoc = await transaction.get(calendar);
      const existing = await transaction.get(ref);
      if (existing.exists && existing.data()?.doctorUserId !== doctorUserId) return serviceError(403, 'appointment_forbidden', 'You can only change your own appointments.');
      const current = existing.exists ? appointmentRecord(existing.id, existing.data()!) : null;
      if (command.action === 'create' && current) {
        const same = existing.data()?.creationIntentHash === creationIntentHash(command);
        return same ? serviceOk({ appointment: current, replayed: true }) : serviceError(409, 'request_id_conflict', 'This booking request was already used. Refresh before retrying.');
      }
      if (command.action !== 'create') {
        if (!current) return serviceError(404, 'appointment_not_found', 'Appointment not found.');
        if (current.version !== command.expectedVersion) return serviceError(409, 'appointment_changed', 'This appointment changed. Refresh before trying again.');
        if (current.status === 'cancelled') return command.action === 'cancel' ? serviceOk({ appointment: current }) : serviceError(409, 'appointment_cancelled', 'A cancelled appointment cannot be rescheduled. Create a new booking.');
      }
      if (command.action !== 'cancel') {
        if (Date.parse(command.startsAt) <= at.getTime() || Date.parse(command.startsAt) > at.getTime() + 180 * 86_400_000) return serviceError(400, 'appointment_time_invalid', 'Choose a future time within 180 days.');
        const overlaps = await transaction.get(this.db.collection('appointments')
          .where('doctorUserId', '==', doctorUserId).where('status', '==', 'booked')
          .where('startsAt', '<', new Date(command.endsAt)).where('endsAt', '>', new Date(command.startsAt))
          .orderBy('startsAt', 'asc').orderBy('endsAt', 'asc').limit(2));
        if (overlaps.docs.some((doc) => doc.id !== command.id)) return serviceError(409, 'appointment_overlap', 'You already have a booking during this time. Choose another slot.');
      }
      const version = (current?.version || 0) + 1;
      const fields: AppointmentFields = command.action === 'cancel' ? current! : command;
      const appointment: AppointmentRecord = {
        id: command.id, doctorUserId, patientName: fields.patientName, patientEmail: fields.patientEmail,
        startsAt: fields.startsAt, endsAt: fields.endsAt, displayTimeZone: fields.displayTimeZone,
        status: command.action === 'cancel' ? 'cancelled' : 'booked', version,
        createdAt: current?.createdAt || at.toISOString(), updatedAt: at.toISOString(),
        cancellation: command.action === 'cancel'
          ? { at: at.toISOString(), byUserId: doctorUserId, reason: command.cancellationReason, revokedInvitationCount: null }
          : null,
      };
      const { id: documentId, cancellation, ...stored } = appointment;
      void documentId;
      transaction.set(ref, {
        ...stored,
        cancellation: cancellation ? { ...cancellation, at } : null,
        creationIntentHash: command.action === 'create' ? creationIntentHash(command) : existing.data()?.creationIntentHash || null,
        startsAt: new Date(stored.startsAt), endsAt: new Date(stored.endsAt), createdAt: new Date(stored.createdAt), updatedAt: at,
      });
      transaction.set(calendar, { version: Number(calendarDoc.data()?.version || 0) + 1, updatedAt: at });
      return serviceOk({ appointment });
    });
  }
}
