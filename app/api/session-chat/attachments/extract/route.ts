import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExtractAttachmentBody;
    const {
      consultationSessionId,
      attachmentId,
      extractedText = null,
      extractionStatus,
      errorMessage = null,
    } = body;

    if (!consultationSessionId || !attachmentId || !extractionStatus) {
      return NextResponse.json(
        { success: false, error: 'Missing required extraction fields' },
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

    await db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('attachments')
      .doc(attachmentId)
      .set(
        {
          extractionStatus,
          extractedText,
          extractionError: errorMessage,
          extractedAtIso: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating attachment extraction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update attachment extraction' },
      { status: 500 }
    );
  }
}
