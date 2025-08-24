"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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

  // Add debugging for room parameter
  useEffect(() => {
    console.log('Room page loaded');
    console.log('Room parameter:', room);
    console.log('Room name:', roomName);
    console.log('Current URL:', window.location.href);
  }, [room, roomName]);

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
    <>
      <style jsx global>{`
        /* Enhanced mobile-friendly LiveKit styling */
        
        /* Chat entry styling - fix for mobile send button */
        .lk-chat-entry {
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 1rem !important;
          padding: 0.75rem !important;
          margin: 0.5rem !important;
        }
        
        .lk-chat-entry input {
          color: #1e293b !important;
          background-color: transparent !important;
          border: none !important;
          outline: none !important;
          font-size: 1rem !important;
          padding: 0.5rem !important;
        }
        
        .lk-chat-entry input::placeholder {
          color: #64748b !important;
        }
        
        /* Make send button highly visible on mobile */
        .lk-chat-entry button[type="submit"] {
          background-color: #2563eb !important;
          color: white !important;
          border: none !important;
          border-radius: 0.75rem !important;
          padding: 0.75rem 1rem !important;
          font-weight: 600 !important;
          min-width: 60px !important;
          height: 44px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          transition: all 0.2s ease !important;
        }
        
        .lk-chat-entry button[type="submit"]:hover {
          background-color: #1d4ed8 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.15) !important;
        }
        
        .lk-chat-entry button[type="submit"]:active {
          transform: translateY(0) !important;
        }
        
        .lk-chat-entry button[type="submit"]:disabled {
          background-color: #94a3b8 !important;
          cursor: not-allowed !important;
          transform: none !important;
          box-shadow: none !important;
        }
        
        /* Ensure send icon is visible */
        .lk-chat-entry button[type="submit"] svg {
          color: white !important;
          width: 1.25rem !important;
          height: 1.25rem !important;
          fill: currentColor !important;
        }
        
        /* Chat messages styling */
        .lk-chat-message {
          background-color: #f1f5f9 !important;
          border-radius: 1rem !important;
          padding: 0.75rem 1rem !important;
          margin: 0.5rem 0 !important;
          border: 1px solid #e2e8f0 !important;
        }
        
        .lk-chat-message-own {
          background-color: #dbeafe !important;
          border-color: #bfdbfe !important;
        }
        
        /* Video conference layout improvements */
        .lk-focus-layout {
          background-color: #0f172a !important;
        }
        
        .lk-participant-tile {
          border-radius: 1rem !important;
          overflow: hidden !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
        }
        
        /* Control bar improvements - Enhanced visibility */
        .lk-control-bar {
          background-color: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-radius: 1rem !important;
          margin: 1rem !important;
          padding: 0.75rem !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1) !important;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
        }
        
        .lk-control-bar button {
          background-color: #2563eb !important;
          border: 1px solid #1d4ed8 !important;
          border-radius: 0.75rem !important;
          color: white !important;
          padding: 0.75rem 1rem !important;
          transition: all 0.2s ease !important;
          font-weight: 600 !important;
          min-width: 80px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.5rem !important;
        }
        
        .lk-control-bar button:hover {
          background-color: #1d4ed8 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3) !important;
        }
        
        .lk-control-bar button:active {
          transform: translateY(0) !important;
        }
        
        /* Specific styling for microphone and camera controls */
        .lk-control-bar button[data-lk-kind="microphone"],
        .lk-control-bar button[data-lk-kind="camera"] {
          background-color: #059669 !important;
          border-color: #047857 !important;
        }
        
        .lk-control-bar button[data-lk-kind="microphone"]:hover,
        .lk-control-bar button[data-lk-kind="camera"]:hover {
          background-color: #047857 !important;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3) !important;
        }
        
        /* Leave button styling */
        .lk-control-bar button[data-lk-kind="leave"] {
          background-color: #dc2626 !important;
          border-color: #b91c1c !important;
        }
        
        .lk-control-bar button[data-lk-kind="leave"]:hover {
          background-color: #b91c1c !important;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3) !important;
        }
        
        /* Share screen button styling */
        .lk-control-bar button[data-lk-kind="share-screen"] {
          background-color: #7c3aed !important;
          border-color: #6d28d9 !important;
        }
        
        .lk-control-bar button[data-lk-kind="share-screen"]:hover {
          background-color: #6d28d9 !important;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3) !important;
        }
        
        /* Chat button styling */
        .lk-control-bar button[data-lk-kind="chat"] {
          background-color: #ea580c !important;
          border-color: #c2410c !important;
        }
        
        .lk-control-bar button[data-lk-kind="chat"]:hover {
          background-color: #c2410c !important;
          box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3) !important;
        }
        
        /* Ensure all icons and text are white */
        .lk-control-bar button svg {
          color: white !important;
          fill: white !important;
          width: 1.25rem !important;
          height: 1.25rem !important;
        }
        
        .lk-control-bar button span {
          color: white !important;
          font-weight: 600 !important;
        }
        
        /* Dropdown styling for microphone/camera options */
        .lk-control-bar .lk-dropdown {
          background-color: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
        }
        
        .lk-control-bar .lk-dropdown button {
          background-color: transparent !important;
          border: none !important;
          color: #374151 !important;
          padding: 0.5rem 1rem !important;
          text-align: left !important;
          min-width: auto !important;
        }
        
        .lk-control-bar .lk-dropdown button:hover {
          background-color: #f3f4f6 !important;
          transform: none !important;
          box-shadow: none !important;
        }
        
        /* Mobile-specific improvements */
        @media (max-width: 768px) {
          .lk-chat-entry {
            padding: 0.5rem !important;
            margin: 0.25rem !important;
            border-radius: 0.75rem !important;
          }
          
          .lk-chat-entry button[type="submit"] {
            min-width: 50px !important;
            height: 40px !important;
            padding: 0.5rem !important;
            border-radius: 0.5rem !important;
          }
          
          .lk-control-bar {
            margin: 0.5rem !important;
            padding: 0.75rem !important;
            border-radius: 0.75rem !important;
            background-color: rgba(255, 255, 255, 0.98) !important;
          }
          
          .lk-control-bar button {
            padding: 0.75rem 0.5rem !important;
            border-radius: 0.5rem !important;
            min-width: 60px !important;
            font-size: 0.875rem !important;
          }
          
          .lk-control-bar button svg {
            width: 1rem !important;
            height: 1rem !important;
          }
          
          /* Ensure video tiles are properly sized on mobile */
          .lk-participant-tile {
            border-radius: 0.75rem !important;
          }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .lk-chat-entry {
            background-color: #1e293b !important;
            border-color: #334155 !important;
          }
          
          .lk-chat-entry input {
            color: #f1f5f9 !important;
          }
          
          .lk-chat-entry input::placeholder {
            color: #94a3b8 !important;
          }
          
          .lk-chat-message {
            background-color: #334155 !important;
            border-color: #475569 !important;
          }
          
          .lk-chat-message-own {
            background-color: #1e40af !important;
            border-color: #3b82f6 !important;
          }
        }
      `}</style>
      
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        video
        audio
        onDisconnected={() => {
          console.log('Disconnected from room');
          console.log('Room ended - webhook should be triggered for room:', roomName);
          
          // Log webhook URL for debugging
          const webhookUrl = `${window.location.origin}/api/webhook`;
          console.log('Expected webhook URL:', webhookUrl);
          
          // Trigger manual webhook for testing
          fetch('/api/manual-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName })
          }).then(response => {
            console.log('Manual webhook response:', response.status);
          }).catch(error => {
            console.error('Manual webhook error:', error);
          });
          
          setToken(null);
        }}
        onConnected={() => {
          console.log('Connected to room successfully');
          console.log('Room started - participants can join');
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
    </>
  );
}
