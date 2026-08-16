import type { WaitingPatient } from '@/lib/types';
import { dateValueToIso } from '@/lib/time/date-value';

export interface WaitingPatientTransport
  extends Omit<WaitingPatient, 'joinedAt' | 'admittedAt' | 'leftAt' | 'rejectedAt' | 'metadata'> {
  joinedAt: string | null;
  admittedAt?: string | null;
  leftAt?: string | null;
  rejectedAt?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Defines the server-to-browser waiting-row contract. Database timestamp
 * objects never cross the HTTP boundary; callers receive ISO strings or null.
 */
export function toWaitingPatientTransport(patient: WaitingPatient): WaitingPatientTransport {
  const metadata = patient.metadata
    ? {
        ...(patient.metadata as Record<string, unknown>),
        ...('lastAccessed' in patient.metadata
          ? { lastAccessed: dateValueToIso(patient.metadata.lastAccessed) }
          : {}),
      }
    : undefined;

  return {
    ...patient,
    joinedAt: dateValueToIso(patient.joinedAt),
    ...(patient.admittedAt !== undefined ? { admittedAt: dateValueToIso(patient.admittedAt) } : {}),
    ...(patient.leftAt !== undefined ? { leftAt: dateValueToIso(patient.leftAt) } : {}),
    ...(patient.rejectedAt !== undefined ? { rejectedAt: dateValueToIso(patient.rejectedAt) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}
