'use client';

import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { trackDoctorPresenceEvent } from '@/lib/consultations/doctor-presence-client';

interface RoomLifecycleArgs {
  token: string | null;
  user: User | null;
  roomName: string;
  doctorName: string;
}

interface RoomLifecycleState {
  consultationSessionId: string | null;
}

function normalizeConsultationSessionId(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Tracks doctor presence and exposes the active consultation session id for room-level features.
 */
export function useRoomLifecycle({ token, user, roomName, doctorName }: RoomLifecycleArgs): RoomLifecycleState {
  const [consultationSessionId, setConsultationSessionId] = useState<string | null>(null);
  const consultationSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !user || !roomName || !db) {
      if (consultationSessionIdRef.current !== null) {
        consultationSessionIdRef.current = null;
        setConsultationSessionId(null);
      }
      return;
    }

    const firestoreDb = db; // Store in const so TypeScript knows it's defined
    let cancelled = false;

    const createRecords = async () => {
      try {
        const roomRef = doc(firestoreDb, 'rooms', roomName);
        await setDoc(
          roomRef,
          {
            roomName,
            createdBy: user.uid,
            createdAt: new Date(),
            status: 'active',
            metadata: {
              createdBy: user.uid,
              userId: user.uid,
              userEmail: user.email,
              userName: doctorName || user.displayName || user.email,
              participantType: 'doctor',
              joinedVia: 'doctor-direct-access',
              timestamp: new Date().toISOString()
            }
          },
          { merge: true }
        );

        const callRef = doc(firestoreDb, 'calls', roomName);
        await setDoc(
          callRef,
          {
            roomName,
            createdBy: user.uid,
            createdAt: new Date(),
            status: 'active',
            transcription: [],
            manualNotes: [],
            lastUpdated: new Date()
          },
          { merge: true }
        );

        const presenceResult = await trackDoctorPresenceEvent({
          roomName,
          action: 'join',
          doctorUserId: user.uid,
          doctorName: doctorName || user.displayName || user.email,
          doctorEmail: user.email || null,
        });

        const normalizedConsultationSessionId = normalizeConsultationSessionId(
          presenceResult.consultationSessionId
        );
        if (!cancelled) {
          consultationSessionIdRef.current = normalizedConsultationSessionId;
          setConsultationSessionId(normalizedConsultationSessionId);
        }
      } catch (error) {
        console.error('Error creating room/call records:', error);
      }
    };

    createRecords();

    return () => {
      cancelled = true;

      void trackDoctorPresenceEvent(
        {
          roomName,
          action: 'leave',
          doctorUserId: user.uid,
          doctorName: doctorName || user.displayName || user.email,
          doctorEmail: user.email || null,
          consultationSessionId: consultationSessionIdRef.current,
        },
        { keepalive: true }
      ).catch((presenceError) => {
        console.error('Error tracking doctor leave on room lifecycle cleanup:', presenceError);
      });
    };
  }, [token, user, roomName, doctorName]);

  return {
    consultationSessionId,
  };
}


