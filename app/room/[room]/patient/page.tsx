'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, provider } from '@/lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
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

function PatientRoomClient({ roomName }: { roomName: string }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthSession();
  const [token, setToken] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      void fetch('/api/link-patient-consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
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

  const handleGoogleSignIn = async () => {
    if (!auth || !provider) {
      setError('Authentication service is not available. Please refresh the page.');
      return;
    }

    try {
      await signInWithPopup(auth, provider);
    } catch (signInError) {
      console.error('Google sign-in error:', signInError);
      setError('Sign-in failed. Please try again.');
    }
  };

  const handleJoinAsPatient = async () => {
    if (!patientName.trim()) {
      setError('Please enter your name before joining.');
      return;
    }

    try {
      setIsJoining(true);
      setError(null);

      localStorage.setItem(`patientName_${roomName}`, patientName);
      localStorage.setItem(`patientInCall_${roomName}`, 'true');

      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          participantName: `Patient: ${patientName}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get token');
      }

      localStorage.setItem(`patientToken_${roomName}`, data.token);
      setToken(data.token);

      const result = await trackConsultationEvent({
        roomName,
        action: 'join',
        patientName,
        userId: user?.uid,
        patientEmail: user?.email || null,
      });
      const resolvedSessionId = updateConsultationSessionId(
        result.consultationSessionId || consultationSessionIdRef.current
      );
      addPendingConsultationSessionId(resolvedSessionId);
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : 'Failed to join room';
      setError(message);
      console.error('Patient room join error:', joinError);
    } finally {
      setIsJoining(false);
    }
  };

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
    const trackedWithBeacon = trackConsultationEventWithBeacon({
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
  }, [patientName, roomName, updateConsultationSessionId, user?.email, user?.uid]);

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
      <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '2rem' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #E5E7EB',
            padding: '1rem 2rem',
            marginBottom: '2rem',
            borderRadius: '0.75rem',
          }}
        >
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Telehealth Consultation</h1>
              <p style={{ color: '#4B5563' }}>Room: {roomName}</p>
            </div>
            <Link href="/" style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
              Home
            </Link>
          </div>
        </div>

        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Join Consultation</h2>
            <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '2rem' }}>
              Welcome to your telehealth consultation. Please enter your name to join the call.
            </p>

            <div style={{ marginBottom: '2rem' }}>
              <label htmlFor="patientName" style={{ display: 'block', fontSize: '1.125rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>
                Your Name
              </label>
              <input
                id="patientName"
                name="patientName"
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: '100%',
                  border: '1px solid #D1D5DB',
                  borderRadius: '0.5rem',
                  padding: '1rem 1.25rem',
                  fontSize: '1.125rem',
                  marginBottom: '1rem',
                }}
                onKeyPress={(event) => event.key === 'Enter' && handleJoinAsPatient()}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '0.5rem',
                  color: '#DC2626',
                  fontSize: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <strong>Error:</strong> {error}
              </div>
            )}

            {!isAuthenticated ? (
              <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#F0F9FF', borderRadius: '0.5rem', border: '1px solid #BAE6FD' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0369A1', marginBottom: '0.75rem' }}>Sign in with Google (Optional)</h3>
                <p style={{ color: '#0369A1', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Sign in to save your consultation history and preferences.
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  style={{
                    backgroundColor: '#4285F4',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    fontSize: '1rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(66, 133, 244, 0.3)',
                  }}
                >
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#F0FDF4', borderRadius: '0.5rem', border: '1px solid #BBF7D0' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#166534', marginBottom: '0.75rem' }}>
                  Signed in as {user?.displayName || user?.email}
                </h3>
                <p style={{ color: '#166534', marginBottom: '1rem', fontSize: '0.875rem' }}>Your consultation history will be saved.</p>
                <button
                  onClick={() => auth && signOut(auth)}
                  style={{
                    backgroundColor: '#DC2626',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={handleJoinAsPatient}
                disabled={isJoining || !patientName.trim()}
                style={{
                  backgroundColor: isJoining || !patientName.trim() ? '#9CA3AF' : '#2563EB',
                  color: 'white',
                  padding: '1rem 2rem',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  fontSize: '1.125rem',
                  border: 'none',
                  cursor: isJoining || !patientName.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isJoining ? 'Joining...' : 'Join as Patient'}
              </button>
            </div>
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
          setError('Connection error. Please try again.');
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
