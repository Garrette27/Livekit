import type { ValidateInvitationResponse, WaitingPatient } from '@/lib/types';

export interface ValidateInviteContext {
  token: string;
  userEmail?: string;
  clientIP: string;
  userAgent: string;
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
  patientEmail?: string;
  waitingPatientId?: string;
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
  }): Promise<{ liveKitToken: string; roomName: string; waitingPatientId: string }>;
  rejectWaitingEntry(input: {
    waitingPatientId: string;
    doctorUserId?: string;
  }): Promise<{ waitingPatientId: string; status: 'rejected' }>;
  markWaitingEntryLeft(
    input: { waitingPatientId: string }
  ): Promise<{ waitingPatientId: string; status: 'left' | 'rejected' }>;
}
