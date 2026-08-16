import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { AttachmentRepository } from '@/lib/repositories/attachment-repository';
import { authorizeSessionParticipant } from '@/lib/services/shared/session-participant-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { isConsultationCapabilityEnabled } from '@/lib/consultations/consultation-capabilities';

interface CreateAttachmentBody {
  consultationSessionId: string;
  name: string;
  mimeType: string;
  size: number;
}

const ATTACHMENT_LIMITS = new Map<string, number>([
  ['image/jpeg', 10 * 1024 * 1024],
  ['image/png', 10 * 1024 * 1024],
  ['image/gif', 10 * 1024 * 1024],
  ['image/webp', 10 * 1024 * 1024],
  ['application/pdf', 5 * 1024 * 1024],
]);

function normalizedFileName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
}

/**
 * Create server-owned attachment metadata. Upload locations, download URLs,
 * extraction text, and extraction status are never accepted from the browser.
 */
async function handlePOST(req: NextRequest) {
  try {
    if (!isConsultationCapabilityEnabled('file-attachments')) {
      return NextResponse.json(
        { success: false, error: 'File attachments are not enabled' },
        { status: 404 }
      );
    }

    const body = (await req.json()) as CreateAttachmentBody;
    const {
      consultationSessionId,
      name,
      mimeType,
      size,
    } = body;

    const safeName = typeof name === 'string' ? normalizedFileName(name) : '';
    const maximumSize = ATTACHMENT_LIMITS.get(mimeType);
    if (
      !consultationSessionId ||
      !safeName ||
      !maximumSize ||
      !Number.isFinite(size) ||
      size <= 0 ||
      size > maximumSize
    ) {
      return NextResponse.json(
        { success: false, error: 'Attachment type or size is not allowed' },
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

    const participant = await authorizeSessionParticipant(req, db, consultationSessionId);
    if (!participant.ok) {
      return serviceResultToResponse(participant);
    }

    const attachmentId = await new AttachmentRepository(db).create(consultationSessionId, {
      consultationSessionId,
      uploaderId: participant.data.identity,
      uploaderName: participant.data.participantName,
      name: safeName,
      mimeType,
      size,
      storagePath: null,
      downloadUrl: null,
      extractedText: null,
      extractionStatus: 'pending',
    });

    return NextResponse.json({
      success: true,
      attachmentId,
    });
  } catch (error) {
    console.error('Error creating session attachment metadata:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create attachment metadata' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
