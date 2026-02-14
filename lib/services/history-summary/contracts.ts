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
