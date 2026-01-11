'use client';

import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import NotesPanel from './components/NotesPanel';
import DoctorControlsPanel from './components/DoctorControlsPanel';
import WaitingRoomPanel from './components/WaitingRoomPanel';
import InvitationManagementPanel from './components/InvitationManagementPanel';
import LiveKitShell from './components/LiveKitShell';
import AuthCard from './components/shared/AuthCard';
import LoadingSpinner from './components/shared/LoadingSpinner';
import ErrorToast from './components/shared/ErrorToast';
import SidebarPortal from './components/shared/SidebarPortal';
import { useDoctorAuth } from './hooks/useDoctorAuth';
import { useDoctorToken } from './hooks/useDoctorToken';
import { useRoomLifecycle } from './hooks/useRoomLifecycle';
import { useSpeechCapture } from './hooks/useSpeechCapture';
import { useErrorHandler } from './hooks/useErrorHandler';

function DoctorRoomClient({ roomName }: { roomName: string }) {
  const {
    user,
    isAuthenticated,
    doctorName,
    setDoctorName,
    signIn,
    signOutDoctor,
    authError,
    clearAuthError
  } = useDoctorAuth(roomName);

  const {
    token,
    isJoining,
    tokenError,
    generateDoctorToken,
    clearToken,
    clearTokenError
  } = useDoctorToken({ roomName, doctorName, user });

  const { captureError } = useSpeechCapture({ roomName, token });

  useRoomLifecycle({ token, user, roomName, doctorName });

  const { pageError, setPageError } = useErrorHandler(authError, tokenError, captureError);

  useEffect(
    () => () => {
      clearAuthError();
      clearTokenError();
    },
    [clearAuthError, clearTokenError]
  );

  // Auto-join when user is authenticated and has a name
  useEffect(() => {
    if (isAuthenticated && user && doctorName.trim() && !token && !isJoining) {
      generateDoctorToken();
    }
  }, [isAuthenticated, user, doctorName, token, isJoining, generateDoctorToken]);

  const handleLeave = async () => {
    clearToken();
    if (db && roomName) {
      try {
        const callRef = doc(db, 'calls', roomName);
        await setDoc(
          callRef,
          {
            status: 'completed',
            endedAt: new Date()
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }
    window.location.href = '/doctor/invitations';
  };

  // Show authentication UI if not signed in
  if (!isAuthenticated) {
    return (
      <AuthCard
        icon="🩺"
        title="Doctor Access"
        description="Sign in to join the consultation as a doctor"
        error={pageError}
        footerLink={{ href: '/doctor/invitations', text: '← Back to Invitations' }}
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
              width: '100%'
            }}
          >
            Sign in with Google
          </button>
      </AuthCard>
    );
  }

  // Show name input if not set and user is authenticated
  if (isAuthenticated && !doctorName.trim() && !token) {
    return (
      <AuthCard
        icon="👨‍⚕️"
        title={`Welcome, Dr. ${user?.displayName || user?.email || 'Anonymous'}`}
        description="Enter your name to join the consultation"
        error={pageError}
      >
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Your Name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                textAlign: 'center'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
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
              width: '100%'
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
              fontSize: '0.875rem'
            }}
          >
            Sign Out
          </button>
      </AuthCard>
    );
  }

  // Show video interface with enhanced UI
  if (token) {
    return (
      <>
        <SidebarPortal title="Waiting Room" icon="🚪" position="left" defaultCollapsed={true} width={350} collapsedWidth={60}>
          <WaitingRoomPanel roomName={roomName} />
        </SidebarPortal>

        <SidebarPortal title="Invitation Management" icon="📧" position="left" defaultCollapsed={true} width={400} collapsedWidth={60}>
          <InvitationManagementPanel user={user!} roomName={roomName} />
        </SidebarPortal>

        <SidebarPortal title="Manual Notes" icon="📝" position="left" defaultCollapsed={false} width={350} collapsedWidth={60}>
            <NotesPanel roomName={roomName} db={db ?? null} storage={storage ?? null} />
        </SidebarPortal>

        <SidebarPortal
            title="Doctor Session Control"
            icon="🛠️"
            position="right"
            defaultCollapsed={false}
            width={300}
            collapsedWidth={60}
          >
            <DoctorControlsPanel doctorName={doctorName || user?.displayName || user?.email || 'Doctor'} roomName={roomName} onLeave={handleLeave} />
        </SidebarPortal>

        <LiveKitShell
          token={token}
          roomName={roomName}
          onDisconnected={handleLeave}
          onError={(error) => {
            console.error('LiveKit error:', error);
            setPageError('Connection error. Please try again.');
          }}
        />

        {/* Chat styles are now handled by LiveKitStyles component in LiveKitShell */}

        <ErrorToast error={pageError} onDismiss={() => setPageError(null)} />
      </>
    );
  }

  // Loading state
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
  const [roomName, setRoomName] = useState<string>('');

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
