'use client';

import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DoctorSessionPanel from './components/DoctorSessionPanel';
import LiveKitShell from './components/LiveKitShell';
import AuthCard from './components/shared/AuthCard';
import LoadingSpinner from './components/shared/LoadingSpinner';
import ErrorToast from './components/shared/ErrorToast';
import { useDoctorAuth } from './hooks/useDoctorAuth';
import { useDoctorToken } from './hooks/useDoctorToken';
import { useRoomLifecycle } from './hooks/useRoomLifecycle';
import { useSpeechCapture } from './hooks/useSpeechCapture';
import { useErrorHandler } from './hooks/useErrorHandler';
import { trackDoctorPresenceEvent } from '@/lib/consultations/doctor-presence-client';

function DoctorRoomClient({ roomName }: { roomName: string }) {
  const [speechLanguage, setSpeechLanguage] = useState('fil-PH');
  const {
    user,
    isAuthenticated,
    doctorName,
    setDoctorName,
    signIn,
    signOutDoctor,
    authError,
    clearAuthError,
  } = useDoctorAuth(roomName);

  const {
    token,
    isJoining,
    tokenError,
    generateDoctorToken,
    clearToken,
    clearTokenError,
  } = useDoctorToken({ roomName, doctorName, user });

  const { speechStatus, captureError, startCapture, stopCapture } = useSpeechCapture({
    roomName,
    token,
    language: speechLanguage,
  });
  const { consultationSessionId } = useRoomLifecycle({ token, user, roomName, doctorName });

  const { pageError, setPageError } = useErrorHandler(authError, tokenError, captureError);

  useEffect(
    () => () => {
      clearAuthError();
      clearTokenError();
    },
    [clearAuthError, clearTokenError]
  );

  useEffect(() => {
    if (isAuthenticated && user && doctorName.trim() && !token && !isJoining) {
      generateDoctorToken();
    }
  }, [isAuthenticated, user, doctorName, token, isJoining, generateDoctorToken]);

  const handleLeave = () => {
    stopCapture();
    if (user?.uid) {
      void trackDoctorPresenceEvent(
        {
          roomName,
          action: 'leave',
          doctorUserId: user.uid,
          doctorName: doctorName || user.displayName || user.email,
          doctorEmail: user.email || null,
          consultationSessionId,
        },
        { keepalive: true }
      ).catch((presenceError) => {
        console.error('Error tracking doctor leave:', presenceError);
      });
    }

    clearToken();

    if (db && roomName) {
      const callRef = doc(db, 'calls', roomName);
      void setDoc(
        callRef,
        {
          status: 'completed',
          endedAt: new Date(),
        },
        { merge: true }
      ).catch((error) => {
        console.error('Error updating call status:', error);
      });
    }

    window.location.href = '/doctor/invitations';
  };

  if (!isAuthenticated) {
    return (
      <AuthCard
        icon="Doctor"
        title="Doctor Access"
        description="Sign in to join the consultation as a doctor"
        error={pageError}
        footerLink={{ href: '/doctor/invitations', text: 'Back to Invitations' }}
      >
        <button
          onClick={signIn}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '1rem',
            marginBottom: '1rem',
            width: '100%',
          }}
        >
          Sign in with Google
        </button>
      </AuthCard>
    );
  }

  if (isAuthenticated && !doctorName.trim() && !token) {
    return (
      <AuthCard
        icon="Doctor"
        title={`Welcome, Dr. ${user?.displayName || user?.email || 'Anonymous'}`}
        description="Enter your name to join the consultation"
        error={pageError}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            value={doctorName}
            onChange={(event) => setDoctorName(event.target.value)}
            placeholder="Dr. Your Name"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              textAlign: 'center',
            }}
            onKeyPress={(event) => {
              if (event.key === 'Enter') {
                generateDoctorToken();
              }
            }}
          />
        </div>

        <button
          onClick={generateDoctorToken}
          disabled={isJoining}
          style={{
            backgroundColor: isJoining ? '#9ca3af' : '#059669',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: '600',
            cursor: isJoining ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            marginBottom: '1rem',
            width: '100%',
          }}
        >
          {isJoining ? 'Joining...' : 'Join Consultation'}
        </button>

        <button
          onClick={signOutDoctor}
          style={{
            backgroundColor: 'transparent',
            color: '#6b7280',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #d1d5db',
            fontWeight: '500',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Sign Out
        </button>
      </AuthCard>
    );
  }

  if (token) {
    return (
      <>
        <DoctorSessionPanel
          roomName={roomName}
          user={user!}
          doctorName={doctorName}
          speechLanguage={speechLanguage}
          speechStatus={speechStatus}
          speechCaptureError={captureError}
          onSpeechLanguageChange={setSpeechLanguage}
          onStartSpeechCapture={startCapture}
          onStopSpeechCapture={stopCapture}
          onLeave={handleLeave}
        />

        <LiveKitShell
          token={token}
          consultationSessionId={consultationSessionId}
          onDisconnected={handleLeave}
          onError={(error) => {
            console.error('LiveKit error:', error);
            setPageError('Connection error. Please try again.');
          }}
        />

        <ErrorToast error={pageError} onDismiss={() => setPageError(null)} />
      </>
    );
  }

  return <LoadingSpinner />;
}

export default function DoctorRoomPage({ params }: { params: Promise<{ room: string }> }) {
  return (
    <div>
      <DoctorRoomClientWrapper params={params} />
    </div>
  );
}

function DoctorRoomClientWrapper({ params }: { params: Promise<{ room: string }> }) {
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    params.then((resolvedParams) => {
      setRoomName(resolvedParams.room);
    });
  }, [params]);

  if (!roomName) {
    return <LoadingSpinner />;
  }

  return <DoctorRoomClient roomName={roomName} />;
}
