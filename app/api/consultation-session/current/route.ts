import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
}

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const maybeDateLike = value as DateLike;
  if (typeof maybeDateLike.toMillis === 'function') {
    return maybeDateLike.toMillis();
  }
  if (typeof maybeDateLike.toDate === 'function') {
    return maybeDateLike.toDate().getTime();
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomName = searchParams.get('roomName');
    const patientUserId = searchParams.get('patientUserId');
    const doctorUserId = searchParams.get('doctorUserId');

    if (!roomName) {
      return NextResponse.json(
        { success: false, error: 'roomName is required' },
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

    const sessionDocs = await new ConsultationSessionRepository(db).findByRoom(roomName, 50);
    const sessions = sessionDocs.map((doc) => ({ id: doc.id, ...doc.data() })) as Record<string, any>[];

    const scopedSessions = sessions.filter((session) => {
      if (doctorUserId && session.doctorUserId && session.doctorUserId !== doctorUserId) {
        return false;
      }

      if (patientUserId && session.patientUserId && session.patientUserId !== patientUserId) {
        return false;
      }

      return true;
    });

    const sortedSessions = [...scopedSessions].sort((left, right) => {
      const leftStartedAt = toMillis(left.sessionStartedAt || left.startedAt);
      const rightStartedAt = toMillis(right.sessionStartedAt || right.startedAt);
      return rightStartedAt - leftStartedAt;
    });

    const activeSession =
      sortedSessions.find((session) => session.status === 'active') || sortedSessions[0] || null;

    return NextResponse.json({
      success: true,
      session: activeSession,
    });
  } catch (error) {
    console.error('Error fetching current consultation session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
