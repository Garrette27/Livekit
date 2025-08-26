"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { LiveKitRoom, VideoConference, useRoomContext, useLocalParticipant } from "@livekit/components-react";
import "@livekit/components-styles";
import React from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic';

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Transcription component to capture conversation
function TranscriptionCapture({ roomName }: { roomName: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const transcriptionRef = useRef<string[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!room || !localParticipant) return;

    console.log('Setting up transcription for room:', roomName);
    console.log('Local participant:', localParticipant.identity);

    // Initialize Web Speech API for speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        console.log('✅ Speech recognition started successfully');
      };

      recognitionRef.current.onresult = (event: any) => {
        console.log('🎤 Speech recognition result received:', event.results.length, 'results');
        
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          console.log(`Result ${i}: "${transcript}" (confidence: ${confidence}, isFinal: ${event.results[i].isFinal})`);
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const timestamp = new Date().toISOString();
          const entry = `[${localParticipant.identity}] (${timestamp}): ${finalTranscript}`;
          transcriptionRef.current.push(entry);
          console.log('✅ Speech captured:', entry);
          
          // Update Firestore every 5 seconds to avoid too many writes
          const now = Date.now();
          if (now - lastUpdateRef.current > 5000) {
            updateTranscriptionInFirestore();
            lastUpdateRef.current = now;
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        console.error('Error details:', event);
        
        // Try to restart if it's a recoverable error
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          console.log('🔄 Attempting to restart speech recognition...');
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Failed to restart speech recognition:', error);
            }
          }, 1000);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🔄 Speech recognition ended, attempting to restart...');
        // Restart recognition if it ends unexpectedly
        if (room.state === 'connected') {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.error('Error restarting speech recognition:', error);
          }
        }
      };

      // Start speech recognition
      try {
        recognitionRef.current.start();
        console.log('🎤 Speech recognition started');
      } catch (error) {
        console.error('❌ Error starting speech recognition:', error);
      }
    } else {
      console.log('⚠️ Speech recognition not supported in this browser');
      console.log('Available APIs:', {
        SpeechRecognition: 'SpeechRecognition' in window,
        webkitSpeechRecognition: 'webkitSpeechRecognition' in window
      });
    }

    // Listen for data messages (chat messages)
    const handleDataReceived = (payload: any, participant: any) => {
      if (payload.topic === 'transcription') {
        const transcription = payload.value;
        const timestamp = new Date().toISOString();
        const entry = `[${participant.identity}] (${timestamp}): ${transcription}`;
        transcriptionRef.current.push(entry);
        console.log('📝 Chat transcription received:', entry);
        
        // Update Firestore every 5 seconds to avoid too many writes
        const now = Date.now();
        if (now - lastUpdateRef.current > 5000) {
          updateTranscriptionInFirestore();
          lastUpdateRef.current = now;
        }
      }
    };

    room.on('dataReceived', handleDataReceived);

    // Update transcription when component unmounts
    return () => {
      room.off('dataReceived', handleDataReceived);
      
      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          console.log('🛑 Speech recognition stopped');
        } catch (error) {
          console.error('Error stopping speech recognition:', error);
        }
      }
      
      updateTranscriptionInFirestore();
    };
  }, [room, localParticipant, roomName]);

  const updateTranscriptionInFirestore = async () => {
    if (!db || transcriptionRef.current.length === 0) return;

    try {
      const callRef = doc(db, 'calls', roomName);
      await updateDoc(callRef, {
        transcription: transcriptionRef.current,
        lastTranscriptionUpdate: new Date()
      });
      console.log('💾 Transcription updated in Firestore:', transcriptionRef.current.length, 'entries');
    } catch (error) {
      console.error('❌ Error updating transcription:', error);
    }
  };

  return null; // This component doesn't render anything visible
}

// Manual transcription input component
function ManualTranscriptionInput({ roomName }: { roomName: string }) {
  const [note, setNote] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const addNote = async () => {
    if (!note.trim() || !db) return;

    try {
      const timestamp = new Date().toISOString();
      const entry = `[Manual Note] (${timestamp}): ${note}`;
      
      const callRef = doc(db, 'calls', roomName);
      await updateDoc(callRef, {
        transcription: [entry], // This will be merged with existing transcription
        lastTranscriptionUpdate: new Date()
      });
      
      console.log('Manual note added:', entry);
      setNote('');
      setIsVisible(false);
    } catch (error) {
      console.error('Error adding manual note:', error);
    }
  };

  // Always show the button during calls
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
        title="Add conversation note"
      >
        📝
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      right: '20px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '0.75rem',
      padding: '1rem',
      width: '300px',
      zIndex: 1000,
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: '600',
          color: '#374151'
        }}>
          Add Conversation Note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter important points from the conversation..."
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            resize: 'vertical'
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              addNote();
            }
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={addNote}
          disabled={!note.trim()}
          style={{
            flex: 1,
            backgroundColor: note.trim() ? '#2563eb' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.5rem',
            fontSize: '0.875rem',
            cursor: note.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Add Note
        </button>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.5rem',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

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
    } catch (error) {
      console.error('Error joining room:', error);
      setError(error instanceof Error ? error.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  }

  // Pre-join view
  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#eff6ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '1rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ 
              fontSize: '1.875rem', 
              fontWeight: '700', 
              color: '#1e293b',
              marginBottom: '0.5rem'
            }}>
              Join Consultation
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Room: <strong>{roomName}</strong>
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#374151'
            }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  join();
                }
              }}
            />
          </div>

          <button
            onClick={join}
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? '#9CA3AF' : '#2563eb',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              fontSize: '1rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
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
        
        /* Specific styling for microphone and camera controls - Enhanced targeting */
        .lk-control-bar button[data-lk-kind="microphone"],
        .lk-control-bar button[data-lk-kind="camera"],
        .lk-control-bar button[aria-label*="microphone"],
        .lk-control-bar button[aria-label*="camera"],
        .lk-control-bar button[title*="microphone"],
        .lk-control-bar button[title*="camera"] {
          background-color: #059669 !important;
          border-color: #047857 !important;
          color: white !important;
        }
        
        .lk-control-bar button[data-lk-kind="microphone"]:hover,
        .lk-control-bar button[data-lk-kind="camera"]:hover,
        .lk-control-bar button[aria-label*="microphone"]:hover,
        .lk-control-bar button[aria-label*="camera"]:hover,
        .lk-control-bar button[title*="microphone"]:hover,
        .lk-control-bar button[title*="camera"]:hover {
          background-color: #047857 !important;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3) !important;
        }
        
        /* Force all control bar buttons to have proper styling */
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
        connect
        audio
        video
        onDisconnected={() => {
          console.log('🔌 Disconnected from room, redirecting to join page...');
          setToken(null);
        }}
        onError={(error) => {
          console.error('❌ LiveKit error:', error);
          setError('Failed to connect to video call');
          setToken(null);
        }}
        className="min-h-screen"
      >
        <TranscriptionCapture roomName={roomName} />
        <VideoConference />
        <ManualTranscriptionInput roomName={roomName} />
      </LiveKitRoom>
    </>
  );
}
