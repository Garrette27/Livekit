import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { AttachmentRepository } from '@/lib/repositories/attachment-repository';
import { authorizeSessionParticipant } from '@/lib/services/shared/session-participant-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

interface CreateAttachmentBody {
  consultationSessionId: string;
  uploaderId: string;
  uploaderName: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  downloadUrl?: string;
  extractedText?: string;
  extractionStatus?: 'pending' | 'ready' | 'failed';
}

async function handlePOST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateAttachmentBody;
    const {
      consultationSessionId,
      name,
      mimeType,
      size,
      storagePath,
      downloadUrl,
      extractedText,
      extractionStatus = extractedText ? 'ready' : 'pending',
    } = body;

    if (!consultationSessionId || !name || !mimeType || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required attachment fields' },
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
      name,
      mimeType,
      size,
      storagePath: storagePath || null,
      downloadUrl: downloadUrl || null,
      extractedText: extractedText || null,
      extractionStatus,
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
