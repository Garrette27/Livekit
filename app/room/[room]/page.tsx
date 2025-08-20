"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import React from "react";

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic';

export default function RoomPage() {
  const { room } = useParams();
  const roomName = room as string;
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('Joining room:', roomName, 'as:', name);
      
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, participantName: name }),
      });
      
      console.log('Token response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Token error response:', errorData);
        throw new Error(errorData.error || `Failed to get token: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Token received:', data);
      
      if (!data.token) {
        throw new Error('No token received from server');
      }
      
      // Debug the token and ensure it's a string
      console.log('Token type:', typeof data.token);
      console.log('Token value:', data.token);
      
      if (typeof data.token !== 'string') {
        console.error('Token is not a string:', data.token);
        throw new Error('Invalid token format received from server');
      }
      
      console.log('Token length:', data.token.length);
      console.log('Token preview:', data.token.substring(0, 50) + '...');
      
      setToken(data.token);
    } catch (err) {
      console.error('Join error:', err);
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  }

  // If no token, show the join interface
  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #EBF8FF 0%, #E0F2FE 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '2rem',
          width: '100%',
          maxWidth: '28rem'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '5rem',
              height: '5rem',
              backgroundColor: '#DBEAFE',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto'
            }}>
              <svg style={{ width: '2.5rem', height: '2.5rem', color: '#2563EB' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>Join Consultation</h1>
            <p style={{ color: '#6B7280' }}>Enter your name to join the secure video call</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              backgroundColor: '#EFF6FF',
              borderRadius: '0.75rem',
              padding: '1rem',
              border: '1px solid #BFDBFE'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#1E40AF' }}>
                <span style={{ fontWeight: '500' }}>Room:</span> 
                <span style={{ fontFamily: 'monospace', color: '#1E3A8A', marginLeft: '0.5rem' }}>{roomName}</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>
                Your Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: '100%',
                  border: '1px solid #D1D5DB',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem',
                  fontSize: '1.125rem',
                  outline: 'none'
                }}
                onKeyPress={(e) => e.key === 'Enter' && join()}
                autoFocus
              />
            </div>
            
            {error && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '0.75rem',
                color: '#DC2626',
                fontSize: '0.875rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              </div>
            )}
            
            <button
              onClick={join}
              disabled={loading || !name.trim()}
              style={{
                width: '100%',
                backgroundColor: loading || !name.trim() ? '#9CA3AF' : '#2563EB',
                color: 'white',
                padding: '1rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: '600',
                fontSize: '1.125rem',
                border: 'none',
                cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '0.75rem'
                  }}></div>
                  Joining...
                </div>
              ) : (
                'Join Call'
              )}
            </button>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                🔒 Secure • HIPAA Compliant • Professional
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If token exists, show the video interface
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  console.log('LiveKit URL:', livekitUrl);
  console.log('Token being used:', token ? token.substring(0, 50) + '...' : 'null');
  
  if (!livekitUrl) {
    console.error('NEXT_PUBLIC_LIVEKIT_URL is not set');
    setError('LiveKit server URL not configured');
    setToken(null);
    return null;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      video
      audio
      onDisconnected={() => {
        console.log('Disconnected from room');
        setToken(null);
      }}
      onConnected={() => {
        console.log('Connected to room successfully');
      }}
      onError={(error) => {
        console.error('LiveKit error:', error);
        setError('Failed to connect to video call');
        setToken(null);
      }}
      className="h-screen"
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
