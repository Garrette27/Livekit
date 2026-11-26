import type { ValidateInvitationResponse, WaitingPatient } from '@/lib/types';

export interface ValidateInviteContext {
  token: string;
  userEmail?: string;
  clientIP: string;
  userAgent: string;
  /** Identity from a verified Firebase token; absent for visitors with no account. */
  authenticatedVisitor?: import('@/lib/invitations/admission-policy').VisitorIdentity;
}

export interface ValidateInviteResult {
  status: number;
  body: ValidateInvitationResponse;
}

export interface CreateWaitingEntryInput {
  waitingPatientId?: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  roomName: string;
  invitationId: string;
  doctorUserId: string;
  status?: WaitingPatient['status'];
  metadata?: Record<string, unknown>;
}

export interface ListWaitingEntriesInput {
  roomName?: string;
  invitationId?: string;
  doctorUserId?: string;
  statuses?: Array<WaitingPatient['status']>;
  activeOnly?: boolean;
}

export interface CheckAdmissionInput {
  invitationId?: string;
  waitingPatientId: string;
  /** Verified room grant from the caller's signed waiting/consultation credential. */
  credentialRoomName: string;
  /** Visit named by the same signed credential; must match the entry's current visit. */
  credentialVisitId?: string;
}

export interface CheckAdmissionResult {
  success: boolean;
  admitted: boolean;
  status: 'admitted' | 'waiting' | 'rejected' | 'left' | 'not_found';
  waitingPatientId?: string;
  liveKitToken?: string;
  roomName?: string;
  error?: string;
}

export interface InvitationAccessService {
  validateInvite(input: ValidateInviteContext): Promise<ValidateInviteResult>;
  createWaitingEntry(input: CreateWaitingEntryInput): Promise<{ waitingPatientId: string }>;
  listWaitingEntries(input: ListWaitingEntriesInput): Promise<WaitingPatient[]>;
  checkAdmission(input: CheckAdmissionInput): Promise<CheckAdmissionResult>;
  admitWaitingEntry(input: {
    waitingPatientId: string;
    roomName: string;
    doctorUserId?: string;
    /** currentVisitId the doctor saw; refused with 409 if the entry moved on. */
    expectedVisitId?: string;
  }): Promise<{ liveKitToken: string; roomName: string; waitingPatientId: string }>;
  rejectWaitingEntry(input: {
    waitingPatientId: string;
    doctorUserId?: string;
    expectedVisitId?: string;
  }): Promise<{ waitingPatientId: string; status: 'rejected' }>;
  /**
   * `credential` is present when a patient asks to leave; it must name the
   * entry's current visit. The verified LiveKit webhook calls without it.
   */
  markWaitingEntryLeft(
    input: { waitingPatientId: string; credential?: { visitId?: string } }
  ): Promise<{ waitingPatientId: string; status: 'left' | 'rejected' }>;
}
