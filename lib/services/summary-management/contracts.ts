import type { ServiceResult } from '@/lib/services/shared/service-result';

/** Editable fields of a consultation summary. Any omitted field is left unchanged. */
export interface SummaryEditableFields {
  summary?: string;
  keyPoints?: string[];
  recommendations?: string[];
  followUpActions?: string[];
  riskLevel?: string;
  category?: string;
}

export interface UpdateSummaryInput {
  summaryId: string;
  editorUserId: string;
  fields: SummaryEditableFields;
}

export interface DeleteSummaryInput {
  summaryId: string;
  requesterUserId: string;
}

/**
 * Owns editing and deletion of stored consultation summaries, including the
 * ownership checks (only the creating doctor may edit; creator or patient may
 * delete) and the cross-collection cleanup that deletion implies.
 */
export interface SummaryManagementService {
  updateSummary(input: UpdateSummaryInput): Promise<ServiceResult<{ summaryId: string; message: string }>>;
  deleteSummary(input: DeleteSummaryInput): Promise<ServiceResult<{ summaryId: string; message: string }>>;
}
