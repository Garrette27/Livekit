export type SortOrder = 'desc' | 'asc';

type TimestampLike = {
  toDate?: () => Date;
};

type DateLike = Date | TimestampLike | null | undefined;

type SummaryMetadataLike = {
  createdBy?: string;
  source?: string;
  testData?: boolean;
  test?: boolean;
};

export interface SummaryLike {
  roomName?: string;
  createdBy?: string;
  createdAt?: DateLike;
  metadata?: SummaryMetadataLike;
  testData?: boolean;
  duration?: number;
}

export interface ConsultationLike {
  createdBy?: string;
  patientUserId?: string;
  isRealConsultation?: boolean;
  status?: string;
  metadata?: {
    createdBy?: string;
    patientUserId?: string;
    visibleToUsers?: string[];
  };
}

export function isTestDataSummary(summary: SummaryLike): boolean {
  return Boolean(
    summary.metadata?.testData ||
      summary.testData ||
      summary.metadata?.source === 'test' ||
      summary.metadata?.test === true ||
      summary.roomName?.includes('test-room-') ||
      summary.roomName?.includes('test-transcription-') ||
      summary.roomName?.includes('test_')
  );
}

export function isTestConsultationSummary(summary: SummaryLike): boolean {
  return summary.metadata?.source === 'test_consultation';
}

export function shouldIncludeUserSummary(summary: SummaryLike, userId: string): boolean {
  const summaryUserId = summary.createdBy || summary.metadata?.createdBy;
  const isUserSummary = summaryUserId === userId;
  const isTest = isTestDataSummary(summary);
  const isAllowedTest = isTestConsultationSummary(summary);

  return isUserSummary && (!isTest || isAllowedTest);
}

export function isVisibleConsultationForUser(consultation: ConsultationLike, userId: string): boolean {
  const consultationUserId = consultation.createdBy || consultation.metadata?.createdBy;
  const patientUserId = consultation.patientUserId || consultation.metadata?.patientUserId;
  const visibleToUsers = consultation.metadata?.visibleToUsers || [];

  const isDoctorConsultation = consultationUserId === userId;
  const isPatientConsultation = patientUserId === userId;
  const isVisibleToUser = visibleToUsers.includes(userId);
  const isRealConsultation = consultation.isRealConsultation === true;
  const isCompleted = consultation.status === 'completed';

  return (isDoctorConsultation || isPatientConsultation || isVisibleToUser) && isRealConsultation && isCompleted;
}

export function toCreatedAtMillis(createdAt: DateLike): number {
  if (!createdAt) {
    return 0;
  }

  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }

  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().getTime();
  }

  return 0;
}

export function toCreatedAtDate(createdAt: DateLike): Date {
  if (!createdAt) {
    return new Date(0);
  }

  if (createdAt instanceof Date) {
    return createdAt;
  }

  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }

  return new Date(0);
}

export function sortSummariesByCreatedAt<T extends SummaryLike>(summaries: T[], sortOrder: SortOrder): T[] {
  const direction = sortOrder === 'desc' ? -1 : 1;
  return [...summaries].sort((left, right) => (toCreatedAtMillis(left.createdAt) - toCreatedAtMillis(right.createdAt)) * direction);
}

export function mergeUniqueByRoomName<T extends SummaryLike>(summaries: T[]): T[] {
  return summaries.filter((summary, index, list) => index === list.findIndex((candidate) => candidate.roomName === summary.roomName));
}

export function isInCurrentMonth(summary: SummaryLike, now: Date): boolean {
  const summaryDate = toCreatedAtDate(summary.createdAt);
  return summaryDate.getMonth() === now.getMonth() && summaryDate.getFullYear() === now.getFullYear();
}
