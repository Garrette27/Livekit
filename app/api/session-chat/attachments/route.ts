import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { AttachmentRepository } from '@/lib/repositories/attachment-repository';

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateAttachmentBody;
    const {
      consultationSessionId,
      uploaderId,
      uploaderName,
      name,
      mimeType,
      size,
      storagePath,
      downloadUrl,
      extractedText,
      extractionStatus = extractedText ? 'ready' : 'pending',
    } = body;

    if (!consultationSessionId || !uploaderId || !uploaderName || !name || !mimeType || !size) {
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

    const attachmentId = await new AttachmentRepository(db).create(consultationSessionId, {
      consultationSessionId,
      uploaderId,
      uploaderName,
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
