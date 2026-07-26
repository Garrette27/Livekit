'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RoomShell from '../components/shared/RoomShell';
import PatientSessionPanels from './components/PatientSessionPanels';
import { PATIENT_ROOM_CONTROLS } from '../components/shared/room-controls-policy';
import { PATIENT_ROOM_CHAT } from '../components/shared/room-chat-policy';
import { PATIENT_ROOM_GRID } from '../components/shared/room-grid-policy';
import { useAuthSession } from '@/hooks/useAuthSession';
import {
  trackConsultationEvent,
  trackConsultationEventWithBeacon,
} from '@/lib/consultations/consultation-event-client';
import {
  addPendingConsultationSessionId,
  getPendingConsultationSessionIds,
  removePendingConsultationSessionIds,
} from '@/lib/consultations/pending-session-client';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';

function PatientRoomClient({ roomName }: { roomName: string }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthSession();
  const [token, setToken] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  const [consultationSessionId, setConsultationSessionId] = useState<string | null>(null);
  const isLeavingRef = useRef(false);
  const consultationSessionIdRef = useRef<string | null>(null);
  const consultationSessionStorageKey = `patientConsultationSessionId_${roomName}`;

  const updateConsultationSessionId = useCallback(
    (nextSessionId?: string | null): string | null => {
      const normalizedSessionId =
        typeof nextSessionId === 'string' && nextSessionId.trim()
          ? nextSessionId.trim()
          : null;
      consultationSessionIdRef.current = normalizedSessionId;
      setConsultationSessionId(normalizedSessionId);

      if (normalizedSessionId) {
        localStorage.setItem(consultationSessionStorageKey, normalizedSessionId);
      } else {
        localStorage.removeItem(consultationSessionStorageKey);
      }

      return normalizedSessionId;
    },
    [consultationSessionStorageKey]
  );

  useEffect(() => {
    const storedConsultationSessionId = localStorage.getItem(consultationSessionStorageKey);
    if (storedConsultationSessionId) {
      updateConsultationSessionId(storedConsultationSessionId);
    }
  }, [consultationSessionStorageKey, updateConsultationSessionId]);

  useEffect(() => {
    if (!user || !roomName) {
      return;
    }

    const pendingSessionIds = getPendingConsultationSessionIds();

    if (user.email) {
      void authenticatedFetch('/api/link-patient-consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingSessionIds,
        }),
      })
        .then((response) => {
          if (response.ok && pendingSessionIds.length > 0) {
            removePendingConsultationSessionIds(pendingSessionIds);
          }
        })
        .catch((linkError) => {
          console.error('Error linking consultations after sign-in:', linkError);
        });
    }

    if (!token) {
      return;
    }

    const wasInCall = localStorage.getItem(`patientInCall_${roomName}`);
    if (wasInCall !== 'true') {
      return;
    }

    void trackConsultationEvent({
      accessToken: token,
      roomName,
      action: 'join',
      patientName: patientName || localStorage.getItem(`patientName_${roomName}`) || 'Patient',
      userId: user.uid,
      patientEmail: user.email || null,
      consultationSessionId: consultationSessionIdRef.current,
    })
      .then((result) => {
        const resolvedSessionId = updateConsultationSessionId(
          result.consultationSessionId || consultationSessionIdRef.current
        );
        addPendingConsultationSessionId(resolvedSessionId);
      })
      .catch((updateError) => {
        console.error('Error updating consultation after sign-in:', updateError);
      });
  }, [patientName, roomName, token, updateConsultationSessionId, user]);

  useEffect(() => {
    const savedName = localStorage.getItem(`patientName_${roomName}`);
    if (savedName) {
      setPatientName(savedName);
    }
  }, [roomName]);

  useEffect(() => {
    const wasInCall = localStorage.getItem(`patientInCall_${roomName}`);
    const savedToken = localStorage.getItem(`patientToken_${roomName}`);
    if (wasInCall === 'true' && patientName && savedToken) {
      setToken(savedToken);
    }
  }, [patientName, roomName]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!token) {
        return;
      }
      const trackedWithBeacon = trackConsultationEventWithBeacon({
        accessToken: token,
        roomName,
        action: 'leave',
        patientName,
        userId: user?.uid,
        patientEmail: user?.email || null,
        consultationSessionId: consultationSessionIdRef.current,
      });

      if (trackedWithBeacon) {
        if (consultationSessionIdRef.current) {
          addPendingConsultationSessionId(consultationSessionIdRef.current);
        }
        return;
      }

      void trackConsultationEvent(
        {
          accessToken: token,
          roomName,
          action: 'leave',
          patientName,
          userId: user?.uid,
          patientEmail: user?.email || null,
          consultationSessionId: consultationSessionIdRef.current,
        },
        { keepalive: true }
      ).catch((trackError) => {
        console.error('Error tracking consultation leave on unload:', trackError);
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [patientName, roomName, token, user?.email, user?.uid]);

  const getPostCallRedirectPath = useCallback(() => {
    if (user?.uid || isAuthenticated) {
      return '/patient/dashboard';
    }

    const registeredEmail = localStorage.getItem('patientRegisteredEmail');
    if (registeredEmail) {
      return `/patient/login?registered=true&email=${encodeURIComponent(registeredEmail)}`;
    }

    return '/patient/login';
  }, [isAuthenticated, user?.uid]);

  const trackPatientLeave = useCallback(() => {
    if (!token) {
      return;
    }

    const trackedWithBeacon = trackConsultationEventWithBeacon({
      accessToken: token,
      roomName,
      action: 'leave',
      patientName,
      userId: user?.uid,
      patientEmail: user?.email || null,
      consultationSessionId: consultationSessionIdRef.current,
    });

    if (trackedWithBeacon) {
      if (consultationSessionIdRef.current) {
        addPendingConsultationSessionId(consultationSessionIdRef.current);
      }
      return;
    }

    void trackConsultationEvent(
      {
        accessToken: token,
        roomName,
        action: 'leave',
        patientName,
        userId: user?.uid,
        patientEmail: user?.email || null,
        consultationSessionId: consultationSessionIdRef.current,
      },
      { keepalive: true }
    )
      .then((result) => {
        const resolvedSessionId = updateConsultationSessionId(
          result.consultationSessionId || consultationSessionIdRef.current
        );
        addPendingConsultationSessionId(resolvedSessionId);
      })
      .catch((trackError) => {
        console.error('Error tracking patient leave:', trackError);
      });
  }, [patientName, roomName, token, updateConsultationSessionId, user?.email, user?.uid]);

  const leaveConsultation = useCallback(() => {
    if (isLeavingRef.current) {
      return;
    }

    isLeavingRef.current = true;
    trackPatientLeave();

    localStorage.removeItem(`patientToken_${roomName}`);
    localStorage.removeItem(`patientInCall_${roomName}`);
    updateConsultationSessionId(null);
    setToken(null);
    router.replace(getPostCallRedirectPath());
  }, [getPostCallRedirectPath, roomName, router, trackPatientLeave, updateConsultationSessionId]);

  if (!token) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F9FAFB',
          padding: 'clamp(1rem, 4vw, 2rem)',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #E5E7EB',
            padding: '1rem clamp(1rem, 4vw, 2rem)',
            marginBottom: '2rem',
            borderRadius: '0.75rem',
          }}
        >
          <div
            style={{
              maxWidth: '52rem',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#111827',
                  margin: 0,
                }}
              >
                Telehealth Consultation
              </h1>
            </div>
            <Link
              href="/"
              style={{
                color: '#2563EB',
                fontSize: '1rem',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              Home
            </Link>
          </div>
        </div>

        <div style={{ maxWidth: '52rem', margin: '0 auto' }}>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              border: '1px solid #E5E7EB',
              padding: 'clamp(1.5rem, 5vw, 2.5rem)',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '9999px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.5rem',
                margin: '0 auto 1rem',
              }}
            >
              🔒
            </div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.75rem',
              }}
            >
              Secure invitation required
            </h2>
            <p
              style={{
                fontSize: '1rem',
                lineHeight: 1.6,
                color: '#4B5563',
                maxWidth: '38rem',
                margin: '0 auto 1.5rem',
              }}
            >
              Ask your doctor to send a current invitation link for this consultation. For
              privacy and safety, a room name alone cannot be used to enter a call.
            </p>
            <div
              style={{
                backgroundColor: '#F0F9FF',
                border: '1px solid #BAE6FD',
                color: '#075985',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              Invitation links expire and securely connect you to the correct doctor and room.
            </div>
            <Link
              href="/patient/login"
              style={{
                display: 'inline-block',
                backgroundColor: '#2563EB',
                color: 'white',
                padding: '0.75rem 1.25rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              View patient portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <PatientSessionPanels
        roomName={roomName}
        patientName={patientName}
        onLeave={() => {
          void leaveConsultation();
        }}
      />

      <RoomShell
        token={token}
        consultationSessionId={consultationSessionId}
        onDisconnected={(reason) => {
          console.log('Patient disconnected from room:', roomName, 'reason:', reason);
          void leaveConsultation();
        }}
        onError={(roomError) => {
          const isCameraPermissionError =
            roomError.message?.includes('NotReadableError') ||
            roomError.message?.includes('video source') ||
            roomError.message?.includes('Could not start video source') ||
            roomError.name === 'NotReadableError';

          if (isCameraPermissionError) {
            console.error('Camera/video track error in patient room:', {
              error: roomError.message || roomError,
              name: roomError.name,
              stack: roomError.stack,
              suggestion:
                'Check browser permissions and ensure camera is not in use by another application. You can enable video manually via the Camera button in the control bar.',
            });
            return;
          }

          console.error('LiveKit error:', roomError);
        }}
        controlBarColor="blue"
        controlsPolicy={PATIENT_ROOM_CONTROLS}
        chatPolicy={PATIENT_ROOM_CHAT}
        gridPolicy={PATIENT_ROOM_GRID}
      />
    </div>
  );
}

export default function PatientRoomPage({ params }: { params: Promise<{ room: string }> }) {
  return <PatientRoomClientWrapper params={params} />;
}

function PatientRoomClientWrapper({ params }: { params: Promise<{ room: string }> }) {
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    params.then((resolvedParams) => {
      setRoomName(resolvedParams.room);
    });
  }, [params]);

  if (!roomName) {
    return null;
  }

  return <PatientRoomClient roomName={roomName} />;
}
