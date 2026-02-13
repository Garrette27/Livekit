import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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

    const attachmentPayload = {
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
      uploadedAtIso: new Date().toISOString(),
      uploadedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const attachmentRef = await db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('attachments')
      .add(attachmentPayload);

    return NextResponse.json({
      success: true,
      attachmentId: attachmentRef.id,
    });
  } catch (error) {
    console.error('Error creating session attachment metadata:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create attachment metadata' },
      { status: 500 }
    );
  }
}
