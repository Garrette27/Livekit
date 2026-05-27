import type { Firestore } from 'firebase-admin/firestore';
import { CallSummaryRepository } from '@/lib/repositories/call-summary-repository';
import { ConsultationRepository } from '@/lib/repositories/consultation-repository';
import { ScheduledDeletionRepository } from '@/lib/repositories/scheduled-deletion-repository';
import { serviceError, serviceOk, type ServiceResult } from '@/lib/services/shared/service-result';
import type {
  DeleteSummaryInput,
  SummaryEditableFields,
  SummaryManagementService,
  UpdateSummaryInput,
} from './contracts';

const EDITABLE_FIELD_KEYS: Array<keyof SummaryEditableFields> = [
  'summary',
  'keyPoints',
  'recommendations',
  'followUpActions',
  'riskLevel',
  'category',
];

function resolveCreatedBy(summary: Record<string, any>): unknown {
  return summary?.createdBy ?? summary?.metadata?.createdBy;
}

export class FirestoreSummaryManagementCore implements SummaryManagementService {
  private readonly summaryRepo: CallSummaryRepository;
  private readonly consultationRepo: ConsultationRepository;
  private readonly scheduledDeletionRepo: ScheduledDeletionRepository;

  constructor(db: Firestore) {
    this.summaryRepo = new CallSummaryRepository(db);
    this.consultationRepo = new ConsultationRepository(db);
    this.scheduledDeletionRepo = new ScheduledDeletionRepository(db);
  }

  async updateSummary({
    summaryId,
    editorUserId,
    fields,
  }: UpdateSummaryInput): Promise<ServiceResult<{ summaryId: string; message: string }>> {
    const summaryDoc = await this.summaryRepo.getById(summaryId);
    if (!summaryDoc.exists) {
      return serviceError(404, 'not_found', 'Summary not found');
    }

    const existingSummary = (summaryDoc.data() as Record<string, any>) || {};
    if (resolveCreatedBy(existingSummary) !== editorUserId) {
      return serviceError(403, 'forbidden', 'Unauthorized: You can only edit summaries you created');
    }

    const updateData: Record<string, any> = {
      lastEditedAt: new Date(),
      lastEditedBy: editorUserId,
    };
    const changedFields: string[] = [];
    for (const key of EDITABLE_FIELD_KEYS) {
      if (fields[key] !== undefined) {
        updateData[key] = fields[key];
        changedFields.push(key);
      }
    }

    const existingMetadata = existingSummary.metadata || {};
    const editHistory = Array.isArray(existingMetadata.editHistory) ? [...existingMetadata.editHistory] : [];
    if (changedFields.length > 0) {
      editHistory.push({ editedAt: new Date(), editedBy: editorUserId, changes: changedFields });
    }

    updateData.metadata = {
      ...existingMetadata,
      editHistory,
      lastEditedAt: new Date(),
      lastEditedBy: editorUserId,
      isEdited: true,
    };

    await this.summaryRepo.update(summaryId, updateData);
    return serviceOk({ summaryId, message: 'Summary updated successfully' });
  }

  async deleteSummary({
    summaryId,
    requesterUserId,
  }: DeleteSummaryInput): Promise<ServiceResult<{ summaryId: string; message: string }>> {
    const summaryDoc = await this.summaryRepo.getById(summaryId);
    if (!summaryDoc.exists) {
      return serviceError(404, 'not_found', 'Summary not found');
    }

    const existingSummary = (summaryDoc.data() as Record<string, any>) || {};
    const createdBy = resolveCreatedBy(existingSummary);
    const patientUserId = existingSummary.patientUserId ?? existingSummary.metadata?.patientUserId;
    const isAuthorized = createdBy === requesterUserId || patientUserId === requesterUserId;
    if (!isAuthorized) {
      return serviceError(403, 'forbidden', 'Unauthorized: You can only delete your own consultations');
    }

    await this.summaryRepo.deleteById(summaryId);

    // Best-effort cleanup of the linked consultation + retention schedule; their
    // absence is not an error.
    const roomNameForCleanup = (existingSummary.roomName as string | undefined) || summaryId;
    try {
      await this.consultationRepo.deleteByRoom(roomNameForCleanup);
    } catch {
      console.log(`Consultation ${roomNameForCleanup} not found or already deleted`);
    }
    try {
      await this.scheduledDeletionRepo.deleteByRoom(roomNameForCleanup);
    } catch {
      console.log(`Scheduled deletion ${roomNameForCleanup} not found or already deleted`);
    }

    return serviceOk({ summaryId, message: `Summary ${summaryId} deleted successfully` });
  }
}
