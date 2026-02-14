'use client';

import { useEffect } from 'react';
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

export function useRoomLifecycle({ token, user, roomName, doctorName }: RoomLifecycleArgs) {
  useEffect(() => {
    if (!token || !user || !roomName || !db) return;

    const firestoreDb = db; // Store in const so TypeScript knows it's defined

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

        await trackDoctorPresenceEvent({
          roomName,
          action: 'join',
          doctorUserId: user.uid,
          doctorName: doctorName || user.displayName || user.email,
          doctorEmail: user.email || null,
        });
      } catch (error) {
        console.error('Error creating room/call records:', error);
      }
    };

    createRecords();

    return () => {
      void trackDoctorPresenceEvent(
        {
          roomName,
          action: 'leave',
          doctorUserId: user.uid,
          doctorName: doctorName || user.displayName || user.email,
          doctorEmail: user.email || null,
        },
        { keepalive: true }
      ).catch((presenceError) => {
        console.error('Error tracking doctor leave on room lifecycle cleanup:', presenceError);
      });
    };
  }, [token, user, roomName, doctorName]);
}


