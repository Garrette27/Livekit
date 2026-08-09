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

    // The room and call documents are convenience records for transcripts and
    // room metadata. They are keyed by room name, so a document another account
    // created for the same name is rejected by the ownership rules — that must
    // never prevent the consultation itself from being recorded.
    const writeRoomDocument = async () => {
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
    };

    const writeCallDocument = async () => {
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
    };

    /**
     * Opens the consultation. Tracking the doctor's presence is the step that
     * actually creates the consultation session, so it runs regardless of
     * whether the optional room/call writes succeeded.
     */
    const openConsultation = async () => {
      const optionalWrites = await Promise.allSettled([writeRoomDocument(), writeCallDocument()]);
      optionalWrites.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(
            `Could not write the ${index === 0 ? 'room' : 'call'} document for "${roomName}"; continuing to open the consultation.`,
            result.reason
          );
        }
      });

      try {
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
        console.error(
          'Failed to track doctor presence; this consultation will not appear in history.',
          error
        );
      }
    };

    openConsultation();

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


