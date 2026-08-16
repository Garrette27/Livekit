import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { AttachmentRepository } from '@/lib/repositories/attachment-repository';
import { authorizeAdminSecret } from '@/lib/services/shared/admin-secret-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { isConsultationCapabilityEnabled } from '@/lib/consultations/consultation-capabilities';

interface ExtractAttachmentBody {
  consultationSessionId: string;
  attachmentId: string;
  extractedText?: string | null;
  extractionStatus: 'pending' | 'ready' | 'failed';
  errorMessage?: string | null;
}

/**
 * Extraction worker endpoint.
 * A background worker can call this after OCR/text parsing to update attachment extraction status.
 */
async function handlePOST(req: NextRequest) {
  try {
    if (!isConsultationCapabilityEnabled('file-attachments')) {
      return NextResponse.json(
        { success: false, error: 'File attachments are not enabled' },
        { status: 404 }
      );
    }

    const authorization = authorizeAdminSecret(req);
    if (!authorization.ok) {
      return serviceResultToResponse(authorization);
    }

    const body = (await req.json()) as ExtractAttachmentBody;
    const {
      consultationSessionId,
      attachmentId,
      extractedText = null,
      extractionStatus,
      errorMessage = null,
    } = body;

    const normalizedText = typeof extractedText === 'string' ? extractedText.trim() : '';
    const normalizedError = typeof errorMessage === 'string' ? errorMessage.trim().slice(0, 500) : null;
    if (
      !consultationSessionId
      || !attachmentId
      || !['pending', 'ready', 'failed'].includes(extractionStatus)
      || normalizedText.length > 100_000
      || (extractionStatus === 'ready' && !normalizedText)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid attachment extraction result' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    await new AttachmentRepository(db).updateExtraction(consultationSessionId, attachmentId, {
      extractionStatus,
      extractedText: normalizedText || null,
      errorMessage: normalizedError,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating attachment extraction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update attachment extraction' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
