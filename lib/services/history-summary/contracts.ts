export interface WaitingRoomParticipantHistoryRecord {
  waitingPatientId: string;
  invitationId: string | null;
  displayName: string;
  patientEmail: string | null;
  isAnonymous: boolean;
  status: 'waiting' | 'admitted' | 'left' | 'rejected';
  joinedAt: string | null;
  admittedAt: string | null;
  leftAt: string | null;
  removedAt: string | null;
  waitingDurationMinutes: number | null;
}

export interface WaitingRoomHistoryRecord {
  totalParticipants: number;
  registeredParticipantCount: number;
  anonymousParticipantCount: number;
  participantEmails: string[];
  participants: WaitingRoomParticipantHistoryRecord[];
}

export interface HistoryRecord {
  id: string;
  roomName: string;
  createdAt: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  duration: number;
  doctorEmail?: string;
  patientEmail?: string;
  createdBy?: string;
  patientUserId?: string;
  summary?: string;
  riskLevel?: string;
  category?: string;
  keyPoints?: string[];
  recommendations?: string[];
  followUpActions?: string[];
  waitingRoomHistory?: WaitingRoomHistoryRecord;
}

export interface SummaryProjectionService {
  buildSummary(input: {
    consultationSessionId: string;
    regenerate?: boolean;
  }): Promise<{ summaryId: string; summary: Record<string, unknown> | null }>;
  buildDoctorHistory(doctorUserId: string): Promise<HistoryRecord[]>;
  buildPatientHistory(input: {
    patientUserId: string;
    patientEmail?: string | null;
  }): Promise<HistoryRecord[]>;
}
