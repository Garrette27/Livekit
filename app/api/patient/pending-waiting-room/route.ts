import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { signInvitationToken } from '@/lib/invitations/token-utils';
import { toDate } from '@/lib/invitations/utils';
import type { InvitationToken } from '@/lib/types';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

interface WaitingEntrySnapshot {
  id: string;
  invitationId: string;
  roomName: string;
  status: string;
  joinedAt: unknown;
}

interface InvitationSnapshot {
  id: string;
  roomName: string;
  status: string;
  waitingRoomEnabled: boolean;
  expiresAt: unknown;
}

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const firestoreError = error as { code?: number; message?: string; details?: string };
  if (firestoreError.code === 9) {
    return true;
  }

  const message = `${firestoreError.message || ''} ${firestoreError.details || ''}`.toLowerCase();
  return message.includes('requires an index');
}

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const asTimestamp = value as { toMillis?: () => number; toDate?: () => Date };
  if (typeof asTimestamp.toMillis === 'function') {
    return asTimestamp.toMillis();
  }
  if (typeof asTimestamp.toDate === 'function') {
    return asTimestamp.toDate().getTime();
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isInvitationActive(invitation: InvitationSnapshot, nowMs: number): boolean {
  const status = invitation.status.trim().toLowerCase();
  if (status !== 'active') {
    return false;
  }
  if (!invitation.waitingRoomEnabled) {
    return false;
  }

  const expiresAtMs = toMillis(invitation.expiresAt);
  return expiresAtMs > nowMs;
}

function toWaitingEntrySnapshot(
  id: string,
  data: Record<string, unknown>
): WaitingEntrySnapshot {
  return {
    id,
    invitationId: typeof data.invitationId === 'string' ? data.invitationId : '',
    roomName: typeof data.roomName === 'string' ? data.roomName : '',
    status: typeof data.status === 'string' ? data.status : 'waiting',
    joinedAt: data.joinedAt,
  };
}

function toInvitationSnapshot(
  id: string,
  data: Record<string, unknown>
): InvitationSnapshot {
  return {
    id,
    roomName: typeof data.roomName === 'string' ? data.roomName : '',
    status: typeof data.status === 'string' ? data.status : 'active',
    waitingRoomEnabled: data.waitingRoomEnabled === true,
    expiresAt: data.expiresAt,
  };
}

async function listWaitingEntriesByPatientEmail(
  db: Firestore,
  patientEmail: string
): Promise<WaitingEntrySnapshot[]> {
  try {
    const snapshot = await db
      .collection('waitingPatients')
      .where('patientEmail', '==', patientEmail)
      .where('status', '==', 'waiting')
      .limit(100)
      .get();

    return snapshot.docs.map((doc) => toWaitingEntrySnapshot(doc.id, doc.data() as Record<string, unknown>));
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const fallbackSnapshot = await db
      .collection('waitingPatients')
      .where('patientEmail', '==', patientEmail)
      .limit(200)
      .get();

    return fallbackSnapshot.docs
      .map((doc) => toWaitingEntrySnapshot(doc.id, doc.data() as Record<string, unknown>))
      .filter((entry) => entry.status === 'waiting');
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization token required' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const idToken = authHeader.slice(7);
    const adminAuth = getFirebaseAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin auth not initialized' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const patientEmail = (decodedToken.email || '').trim().toLowerCase();
    if (!patientEmail) {
      return NextResponse.json(
        { success: true, pendingWaitingRoom: null },
        { headers: NO_STORE_HEADERS }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const waitingEntries = await listWaitingEntriesByPatientEmail(db, patientEmail);
    if (waitingEntries.length === 0) {
      return NextResponse.json(
        { success: true, pendingWaitingRoom: null },
        { headers: NO_STORE_HEADERS }
      );
    }

    const invitationIds = Array.from(
      new Set(waitingEntries.map((entry) => entry.invitationId).filter((invitationId) => invitationId.trim().length > 0))
    );
    if (invitationIds.length === 0) {
      return NextResponse.json(
        { success: true, pendingWaitingRoom: null },
        { headers: NO_STORE_HEADERS }
      );
    }

    const invitationDocs = await Promise.all(
      invitationIds.map((invitationId) => db.collection('invitations').doc(invitationId).get())
    );
    const invitationsById = new Map<string, InvitationSnapshot>();
    invitationDocs.forEach((invitationDoc) => {
      if (!invitationDoc.exists) {
        return;
      }
      invitationsById.set(
        invitationDoc.id,
        toInvitationSnapshot(invitationDoc.id, invitationDoc.data() as Record<string, unknown>)
      );
    });

    const nowMs = Date.now();
    const activeEntries = waitingEntries.filter((entry) => {
      const invitation = invitationsById.get(entry.invitationId);
      if (!invitation) {
        return false;
      }
      if (!isInvitationActive(invitation, nowMs)) {
        return false;
      }
      return !invitation.roomName || invitation.roomName === entry.roomName;
    });

    if (activeEntries.length === 0) {
      return NextResponse.json(
        { success: true, pendingWaitingRoom: null },
        { headers: NO_STORE_HEADERS }
      );
    }

    const latestEntry = [...activeEntries].sort((left, right) => toMillis(right.joinedAt) - toMillis(left.joinedAt))[0];
    const invitation = invitationsById.get(latestEntry.invitationId);
    if (!invitation) {
      return NextResponse.json(
        { success: true, pendingWaitingRoom: null },
        { headers: NO_STORE_HEADERS }
      );
    }

    const expiresAt = toDate(invitation.expiresAt, new Date(0));
    const tokenPayload: InvitationToken = {
      invitationId: invitation.id,
      roomName: invitation.roomName || latestEntry.roomName,
      email: patientEmail,
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      oneUse: false,
    };
    const inviteToken = signInvitationToken(tokenPayload);
    const invitePath = `/invite/${inviteToken}`;

    return NextResponse.json(
      {
        success: true,
        pendingWaitingRoom: {
          waitingPatientId: latestEntry.id,
          invitationId: latestEntry.invitationId,
          roomName: invitation.roomName || latestEntry.roomName,
          joinedAt: toDate(latestEntry.joinedAt, new Date()).toISOString(),
          invitePath,
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Error resolving pending waiting-room status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve pending waiting-room status' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
