'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { doc, setDoc } from 'firebase/firestore';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { db, storage } from '@/lib/firebase';
import NotesPanel from './components/NotesPanel';
import DoctorControlsPanel from './components/DoctorControlsPanel';
import LiveKitShell from './components/LiveKitShell';
import { useDoctorAuth } from './hooks/useDoctorAuth';
import { useDoctorToken } from './hooks/useDoctorToken';
import { useRoomLifecycle } from './hooks/useRoomLifecycle';
import { useSpeechCapture } from './hooks/useSpeechCapture';

function DoctorRoomClient({ roomName }: { roomName: string }) {
  const [pageError, setPageError] = useState<string | null>(null);

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

  useEffect(() => {
    if (authError) setPageError(authError);
  }, [authError]);

  useEffect(() => {
    if (tokenError) setPageError(tokenError);
  }, [tokenError]);

  useEffect(() => {
    if (captureError) setPageError(captureError);
  }, [captureError]);

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
    window.location.href = '/invitations';
  };

  // Show authentication UI if not signed in
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '3rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '4rem',
              height: '4rem',
              backgroundColor: '#dbeafe',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem'
            }}
          >
            <span style={{ fontSize: '2rem' }}>🩺</span>
          </div>

          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: '#1e40af',
              marginBottom: '1rem'
            }}
          >
            Doctor Access
          </h1>

          <p
            style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}
          >
            Sign in to join the consultation as a doctor
          </p>

          {pageError && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem',
                color: '#dc2626'
              }}
            >
              {pageError}
            </div>
          )}

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

          <Link
            href="/invitations"
            style={{
              display: 'inline-block',
              color: '#6b7280',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}
          >
            ← Back to Invitations
          </Link>
        </div>
      </div>
    );
  }

  // Show name input if not set and user is authenticated
  if (isAuthenticated && !doctorName.trim() && !token) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '3rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '4rem',
              height: '4rem',
              backgroundColor: '#dbeafe',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem'
            }}
          >
            <span style={{ fontSize: '2rem' }}>👨‍⚕️</span>
          </div>

          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: '#1e40af',
              marginBottom: '1rem'
            }}
          >
            Welcome, Dr. {user?.displayName || user?.email || 'Anonymous'}
          </h1>

          <p
            style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}
          >
            Enter your name to join the consultation
          </p>

          {pageError && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem',
                color: '#dc2626'
              }}
            >
              {pageError}
            </div>
          )}

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
        </div>
      </div>
    );
  }

  // Show video interface with enhanced UI
  if (token) {
    return (
      <>
        {createPortal(
          <CollapsibleSidebar title="Manual Notes" icon="📝" position="left" defaultCollapsed={false} width={350} collapsedWidth={60}>
            <NotesPanel roomName={roomName} db={db ?? null} storage={storage ?? null} />
          </CollapsibleSidebar>,
          typeof window !== 'undefined' ? document.body : ({} as any)
        )}

        {createPortal(
          <CollapsibleSidebar
            title="Doctor Session Control"
            icon="🛠️"
            position="right"
            defaultCollapsed={false}
            width={300}
            collapsedWidth={60}
          >
            <DoctorControlsPanel doctorName={doctorName || user?.displayName || user?.email || 'Doctor'} roomName={roomName} onLeave={handleLeave} />
          </CollapsibleSidebar>,
          typeof window !== 'undefined' ? document.body : ({} as any)
        )}

        <LiveKitShell
          token={token}
          roomName={roomName}
          onDisconnected={handleLeave}
          onError={(error) => {
            console.error('LiveKit error:', error);
            setPageError('Connection error. Please try again.');
          }}
        />

        {token && (
          <style jsx global>{`
            .lk-chat-panel,
            [class*='chat-panel'],
            [class*='ChatPanel'],
            [data-lk='chat-panel'],
            .lk-chat,
            [class*='lk-chat'],
            div[role='dialog'][class*='chat'],
            aside[class*='chat'],
            section[class*='chat'] {
              background-color: #ffffff !important;
              background: #ffffff !important;
              color: #000000 !important;
              border: 1px solid #e5e7eb !important;
              border-radius: 12px !important;
            }

            .lk-chat-container,
            .lk-chat-wrapper,
            .lk-chat-entry {
              background-color: #ffffff !important;
              background: #ffffff !important;
              color: #000000 !important;
            }

            .lk-chat-message,
            [class*='chat-message'],
            [class*='message'],
            [class*='Message'],
            .lk-message {
              background-color: #f8f9fa !important;
              color: #000000 !important;
              border: 1px solid #e9ecef !important;
              border-radius: 8px !important;
              padding: 8px 12px !important;
              margin: 4px 0 !important;
            }

            .lk-chat-message p,
            .lk-chat-message span,
            .lk-chat-message div,
            .lk-chat-message *,
            [class*='chat-message'] p,
            [class*='chat-message'] span,
            [class*='chat-message'] div,
            [class*='chat-message'] *,
            [class*='message'] p,
            [class*='message'] span,
            [class*='message'] div,
            [class*='message'] * {
              color: #000000 !important;
            }

            .lk-chat-input,
            [class*='chat-input'],
            [class*='ChatInput'],
            input[type='text'][class*='chat'],
            textarea[class*='chat'] {
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 1px solid #ced4da !important;
              border-radius: 8px !important;
              padding: 8px 12px !important;
            }

            .lk-chat-input::placeholder,
            [class*='chat-input']::placeholder,
            input[class*='chat']::placeholder {
              color: #6c757d !important;
            }

            .lk-chat *,
            [class*='chat'] *,
            [class*='Chat'] *,
            [data-lk='chat'] * {
              color: #000000 !important;
            }

            [data-theme='dark'] .lk-chat,
            [data-theme='dark'] .lk-chat-message,
            [data-theme='dark'] .lk-chat-panel,
            [class*='dark'] [class*='chat'],
            [class*='dark'] [class*='Chat'] {
              background-color: #ffffff !important;
              color: #000000 !important;
            }

            div[class*='chat'] div,
            div[class*='Chat'] div,
            .lk-chat div,
            .lk-chat-panel div {
              background-color: #ffffff !important;
              background: #ffffff !important;
            }

            .lk-chat [class*='scroll'],
            .lk-chat-panel [class*='scroll'],
            [class*='chat'] [class*='scroll'] {
              background-color: #ffffff !important;
            }

            [class*='lk-chat'],
            [class*='Chat'],
            [id*='chat'],
            [id*='Chat'],
            [data-lk*='chat'],
            [data-lk*='Chat'],
            [role='dialog'][class*='chat'],
            [role='dialog'][class*='Chat'],
            aside[class*='chat'],
            aside[class*='Chat'],
            nav[class*='chat'],
            nav[class*='Chat'] {
              background-color: #ffffff !important;
              background: #ffffff !important;
              background-image: none !important;
            }

            [class*='chat'] *,
            [class*='Chat'] *,
            [id*='chat'] *,
            [id*='Chat'] * {
              background-color: #ffffff !important;
              background: #ffffff !important;
            }

            * {
              --lk-chat-bg: #ffffff !important;
              --chat-background: #ffffff !important;
            }
          `}</style>
        )}

        {pageError && (
          <div
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              color: '#dc2626',
              zIndex: 9999,
              maxWidth: '400px',
              textAlign: 'center'
            }}
          >
            {pageError}
            <button
              onClick={() => setPageError(null)}
              style={{
                marginLeft: '1rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
          </div>
        )}
      </>
    );
  }

  // Loading state
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '4rem',
            height: '4rem',
            border: '2px solid #dbeafe',
            borderTop: '2px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}
        ></div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af' }}>Loading...</h2>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
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
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              border: '2px solid #dbeafe',
              borderTop: '2px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem'
            }}
          ></div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af' }}>Loading...</h2>
        </div>

        <style jsx>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return <DoctorRoomClient roomName={roomName} />;
}
