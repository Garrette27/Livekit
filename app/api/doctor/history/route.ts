import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FirestoreSummaryProjectionService } from '@/lib/services/history-summary';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await authorizeBearerRequest(req, 'consultation:read-own');
    if (!auth.ok) {
      return serviceResultToResponse(auth);
    }
    if (auth.data.role !== 'doctor' && auth.data.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Doctor role required' },
        { status: 403 }
      );
    }
    const doctorUserId = auth.data.userId;

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const historyProjection = new FirestoreSummaryProjectionService(db);
    const includeChatHistory = searchParams.get('includeChatHistory') === 'true';
    const summaries = await historyProjection.buildDoctorHistory({
      doctorUserId,
      includeChatHistory,
    });

    return NextResponse.json({
      success: true,
      summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('Error fetching doctor consultation history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch doctor consultation history',
      },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
