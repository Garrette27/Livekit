'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom, useRoomContext } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Client component for the room functionality
function RoomClient({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [manualNotes, setManualNotes] = useState<string[]>([]);
  const [speechRecognitionStatus, setSpeechRecognitionStatus] = useState<string>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        setUser(user);
      });
    } else {
      console.warn('Firebase auth not initialized');
    }
  }, []);
  // Use the imported db instance

  // Function to create a new room
  const handleCreateNewRoom = async () => {
    if (!newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    if (!db) {
      alert('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      setIsCreatingRoom(true);
      
      // Store room creation with user ID
      if (db) {
        try {
          const roomRef = doc(db, 'rooms', newRoomName);
          await setDoc(roomRef, {
            roomName: newRoomName,
            createdBy: user?.uid || 'anonymous',
            createdAt: new Date(),
            status: 'active',
            metadata: {
              createdBy: user?.uid || 'anonymous',
              userId: user?.uid || 'anonymous',
              userEmail: user?.email,
              userName: user?.displayName
            }
          });
        } catch (error) {
          console.error('Error storing room data:', error);
        }
      } else {
        console.warn('Firestore not initialized');
      }

      // Navigate to the new room
      window.location.href = `/room/${newRoomName}`;
      
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room. Please try again.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Function to join the current room
  const handleJoinRoom = async () => {
    if (!user || !roomName) {
      alert('Please ensure you are logged in and have a room name');
      return;
    }

    try {
      setIsJoining(true);
      setTokenError(null);

      const identity = user.displayName || user.email || user.uid;

      // Get LiveKit token from API route
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName: identity }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get token');
      }

      setToken(data.token);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join room';
      setTokenError(errorMessage);
      console.error('Room join error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  // Get token for the room
  useEffect(() => {
    if (!roomName || !user) return;

    const getToken = async () => {
      try {
        console.log('Getting token for room:', roomName, 'as:', user.displayName || user.uid);
        const response = await fetch('/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName: roomName,
            participantName: user.displayName || user.uid,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Token received:', data);
        setToken(data.token);
        setTokenError(null);

        // Store call data in Firestore
        if (db) {
          try {
            const callRef = doc(db, 'calls', roomName);
            await setDoc(callRef, {
              roomName,
              createdBy: user.uid,
              createdAt: new Date(),
              status: 'active',
              metadata: { 
                createdBy: user.uid,
                userId: user.uid,
                userEmail: user.email,
                userName: user.displayName
              }
            }, { merge: true });
            console.log('Call data stored in Firestore with user ID:', user.uid);
          } catch (error) {
            console.error('Error storing call data:', error);
          }
        } else {
          console.warn('Firestore not initialized');
        }
      } catch (error) {
        console.error('Error getting token:', error);
        setTokenError(error instanceof Error ? error.message : 'Failed to get token');
      }
    };

    getToken();
  }, [roomName, user, db]);

  // Transcription capture component
  const TranscriptionCapture = () => {
    const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
    const [userInteracted, setUserInteracted] = useState<boolean>(false);
    
    useEffect(() => {
      if (!token || !roomName) return;

      // Wait for user interaction before starting speech recognition
      const handleUserInteraction = () => {
        setUserInteracted(true);
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      };

      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('keydown', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);

      return () => {
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      };
    }, [token, roomName]);

    useEffect(() => {
      if (!token || !roomName || !userInteracted) return;

      console.log('Setting up transcription for room:', roomName);
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        return;
      }

      // Create a single recognition instance
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setSpeechRecognitionStatus('listening');
      };

      recognition.onresult = (event: any) => {
        console.log('🎤 Speech recognition result received:', event.results.length, 'results');
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript.trim();
          const isFinal = result.isFinal;
          
          console.log(`Result ${i}: "${transcript}" (confidence: ${result[0].confidence}, isFinal: ${isFinal})`);
          
          if (transcript && isFinal) {
            const timestamp = new Date().toISOString();
            const entry = `[${timestamp}] ${transcript}`;
            
            setTranscription(prev => {
              const newTranscription = [...prev, entry];
              
              // Store in Firestore
              if (db) {
                try {
                  const callRef = doc(db, 'calls', roomName);
                  updateDoc(callRef, {
                    transcription: newTranscription,
                    lastTranscriptionUpdate: new Date()
                  }).catch(error => {
                    console.error('Error storing transcription:', error);
                  });
                } catch (error) {
                  console.error('Error with Firestore operation:', error);
                }
              }
              
              return newTranscription;
            });
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Speech recognition error:', event.error);
        setSpeechRecognitionStatus('error');
        
        // Only restart if it's not an aborted error
        if (event.error !== 'aborted') {
          setTimeout(() => {
            try {
              if (recognition.state !== 'recording') {
                recognition.start();
              }
            } catch (error) {
              console.error('Failed to restart speech recognition:', error);
            }
          }, 2000);
        }
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setSpeechRecognitionStatus('stopped');
        
        // Only restart if component is still mounted and token is valid
        setTimeout(() => {
          try {
            if (recognition.state !== 'recording') {
              recognition.start();
            }
          } catch (error) {
            console.error('Failed to restart speech recognition:', error);
          }
        }, 2000);
      };

      // Store the recognition instance
      setRecognitionInstance(recognition);

      try {
        recognition.start();
        console.log('✅ Speech recognition started successfully');
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }

      return () => {
        try {
          if (recognition && recognition.state === 'recording') {
            recognition.stop();
          }
        } catch (error) {
          console.error('Error stopping speech recognition:', error);
        }
      };
    }, [token, roomName, db]);

    return null;
  };

  // Manual transcription input component
  const ManualTranscriptionInput = () => {
    const [note, setNote] = useState('');

    const addNote = () => {
      if (note.trim()) {
        const timestamp = new Date().toISOString();
        const entry = `[Manual Note] (${timestamp}): ${note}`;
        
        setManualNotes(prev => [...prev, entry]);
        setTranscription(prev => {
          const newTranscription = [...prev, entry];
          
          // Store in Firestore
          if (db) {
            const callRef = doc(db, 'calls', roomName);
            updateDoc(callRef, {
              transcription: newTranscription,
              lastTranscriptionUpdate: new Date()
            }).catch(error => {
              console.error('Error storing manual note:', error);
            });
          }
          
          return newTranscription;
        });
        
        setNote('');
      }
    };

    return (
      <div style={{
        position: 'fixed',
        bottom: '120px',
        right: '20px',
        zIndex: 9999
      }}>
        <button
          onClick={() => {
            const note = prompt('Add a conversation note:');
            if (note && note.trim()) {
              const timestamp = new Date().toISOString();
              const entry = `[Manual Note] (${timestamp}): ${note}`;
              
              setTranscription(prev => {
                const newTranscription = [...prev, entry];
                
                // Store in Firestore
                if (db) {
                  try {
                    const callRef = doc(db, 'calls', roomName);
                    updateDoc(callRef, {
                      transcription: newTranscription,
                      lastTranscriptionUpdate: new Date()
                    }).catch(error => {
                      console.error('Error storing manual note:', error);
                    });
                  } catch (error) {
                    console.error('Error with Firestore operation:', error);
                  }
                }
                
                return newTranscription;
              });
            }
          }}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '70px',
            height: '70px',
            fontSize: '28px',
            cursor: 'pointer',
            boxShadow: '0 8px 25px rgba(37, 99, 235, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Add conversation note"
        >
          📝
        </button>
      </div>
    );
  };

  // Force blue controls
  useEffect(() => {
    if (!token) return;

    const forceBlueControls = () => {
      const selectors = [
        '.lk-control-bar',
        '[data-lk-kind]',
        '.lk-control-bar button',
        'button[data-lk-kind]',
        'button[aria-label*="microphone"]',
        'button[aria-label*="camera"]',
        'button[aria-label*="chat"]',
        'button[aria-label*="leave"]',
        'button[aria-label*="share"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (element instanceof HTMLElement) {
            element.style.setProperty('background-color', '#2563eb', 'important');
            element.style.setProperty('color', 'white', 'important');
            element.style.setProperty('border-color', '#1d4ed8', 'important');
            element.style.setProperty('border-radius', '0.75rem', 'important');
            element.style.setProperty('padding', '0.75rem 1rem', 'important');
            element.style.setProperty('font-weight', '600', 'important');
            element.style.setProperty('min-width', '80px', 'important');
            element.style.setProperty('display', 'flex', 'important');
            element.style.setProperty('align-items', 'center', 'important');
            element.style.setProperty('justify-content', 'center', 'important');
            element.style.setProperty('gap', '0.5rem', 'important');
            element.style.setProperty('box-shadow', '0 4px 6px -1px rgba(37, 99, 235, 0.2)', 'important');
          }
        });
      });

      // Force all icons and text to be white
      const icons = document.querySelectorAll('.lk-control-bar svg, [data-lk-kind] svg');
      icons.forEach(icon => {
        if (icon instanceof SVGElement) {
          icon.style.setProperty('color', 'white', 'important');
          icon.style.setProperty('fill', 'white', 'important');
          icon.style.setProperty('stroke', 'white', 'important');
        }
      });

      const spans = document.querySelectorAll('.lk-control-bar span, [data-lk-kind] span');
      spans.forEach(span => {
        if (span instanceof HTMLElement) {
          span.style.setProperty('color', 'white', 'important');
          span.style.setProperty('font-weight', '600', 'important');
        }
      });

      console.log('✅ Blue controls applied');
    };

    // Apply immediately
    forceBlueControls();

    // Set up interval to apply every 2 seconds
    const interval = setInterval(forceBlueControls, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [token]);

  // Inject global CSS override
  useEffect(() => {
    if (!token) return;

    const style = document.createElement('style');
    style.id = 'livekit-blue-controls-override';
    style.textContent = `
      .lk-control-bar,
      .lk-control-bar *,
      [data-lk-kind],
      button[data-lk-kind],
      button[aria-label*="microphone"],
      button[aria-label*="camera"],
      button[aria-label*="chat"],
      button[aria-label*="leave"],
      button[aria-label*="share"] {
        background-color: #2563eb !important;
        color: white !important;
        border-color: #1d4ed8 !important;
        border-radius: 0.75rem !important;
        padding: 0.75rem 1rem !important;
        font-weight: 600 !important;
        min-width: 80px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.5rem !important;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2) !important;
      }

      .lk-control-bar svg,
      [data-lk-kind] svg,
      button[data-lk-kind] svg {
        color: white !important;
        fill: white !important;
        stroke: white !important;
      }

      .lk-control-bar span,
      [data-lk-kind] span,
      button[data-lk-kind] span {
        color: white !important;
        font-weight: 600 !important;
      }
    `;

    // Remove existing style if present
    const existingStyle = document.getElementById('livekit-blue-controls-override');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Inject new style
    document.head.appendChild(style);
    console.log('✅ Global CSS override injected');

    return () => {
      const styleToRemove = document.getElementById('livekit-blue-controls-override');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [token]);

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F9FAFB',
        padding: '2rem'
      }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: 'white', 
          borderBottom: '1px solid #E5E7EB', 
          padding: '1rem 2rem',
          marginBottom: '2rem',
          borderRadius: '0.75rem'
        }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Telehealth Console</h1>
              <p style={{ color: '#4B5563' }}>Room: {roomName}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Link href="/dashboard" style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
                View History
              </Link>
              <Link href="/" style={{ color: '#059669', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
                Home
              </Link>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Consultation Room</h2>
            <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '2rem' }}>Room "{roomName}" is ready. Share the link below with your patient or join the call.</p>
            
            {/* Room URL Display */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.75rem' }}>🔗 Room Link</h3>
              <p style={{ fontSize: '1rem', color: '#6B7280', marginBottom: '1rem' }}>Share this link with your patient:</p>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                  <input
                    value={`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`}
                    readOnly
                  style={{ 
                    flex: '1', 
                    border: '1px solid #D1D5DB', 
                    borderRadius: '0.5rem', 
                    padding: '0.75rem 1rem', 
                    backgroundColor: '#F9FAFB', 
                    fontSize: '1rem',
                    color: '#374151'
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`);
                    alert('Room link copied to clipboard!');
                  }}
                  style={{ 
                    backgroundColor: '#059669', 
                    color: 'white', 
                    padding: '0.75rem 1.5rem', 
                    borderRadius: '0.5rem', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    border: 'none', 
                    cursor: 'pointer'
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Error Display */}
            {tokenError && (
              <div style={{ 
                padding: '1.25rem', 
                backgroundColor: '#FEF2F2', 
                border: '1px solid #FECACA', 
                borderRadius: '0.5rem', 
                color: '#DC2626', 
                fontSize: '1rem',
                marginBottom: '2rem'
              }}>
                <strong>Error:</strong> {tokenError}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button
                onClick={handleJoinRoom}
                disabled={isJoining}
                style={{ 
                  backgroundColor: isJoining ? '#9CA3AF' : '#2563EB', 
                  color: 'white', 
                  padding: '1rem 2rem', 
                  borderRadius: '0.5rem', 
                  fontWeight: '600', 
                  fontSize: '1.125rem', 
                  border: 'none', 
                  cursor: isJoining ? 'not-allowed' : 'pointer'
                }}
              >
                {isJoining ? 'Joining...' : 'Join Call'}
              </button>
            </div>

            {/* Create New Room Section */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>Create New Room</h3>
              <p style={{ fontSize: '1rem', color: '#6B7280', marginBottom: '1.5rem' }}>Need to create a different consultation room?</p>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '1' }}>
                  <label style={{ display: 'block', fontSize: '1rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    New Room Name
                  </label>
                  <input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g., dr-smith-aug16"
                    style={{ 
                      width: '100%', 
                      border: '1px solid #D1D5DB', 
                      borderRadius: '0.5rem', 
                      padding: '0.75rem 1rem', 
                      fontSize: '1rem'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateNewRoom()}
                  />
                </div>
                <button 
                  onClick={handleCreateNewRoom} 
                  disabled={isCreatingRoom || !newRoomName.trim()}
                  style={{ 
                    backgroundColor: isCreatingRoom || !newRoomName.trim() ? '#9CA3AF' : '#059669', 
                    color: 'white', 
                    padding: '0.75rem 1.5rem', 
                    borderRadius: '0.5rem', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    border: 'none', 
                    cursor: isCreatingRoom || !newRoomName.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCreatingRoom ? 'Creating...' : 'Create New Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <TranscriptionCapture />
      
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        onDisconnected={() => {
          console.log('Disconnected from room');
          setToken(null);
        }}
        onError={(error) => {
          console.error('LiveKit error:', error);
        }}
      >
        <ManualTranscriptionInput />
        
        {/* Room Link Display */}
        {token && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '2px solid #2563eb',
              borderRadius: '1rem',
              padding: '1rem',
              zIndex: 9999,
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
              maxWidth: '400px'
            }}
          >
            {/* Back to Home Button */}
            <div style={{ marginBottom: '0.75rem' }}>
              <Link href="/" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#6b7280',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                ← Back to Home
              </Link>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ 
                margin: '0 0 0.5rem 0', 
                color: '#1e40af', 
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                🔗 Room Link
              </h3>
              <p style={{ 
                margin: '0', 
                color: '#6b7280', 
                fontSize: '0.875rem',
                marginBottom: '0.75rem'
              }}>
                Share this link with your patient:
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginBottom: '0.75rem'
            }}>
              <input
                type="text"
                value={`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`}
                readOnly
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#f9fafb',
                  color: '#374151'
                }}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`);
                  alert('Room link copied to clipboard!');
                }}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Copy
              </button>
            </div>
            
            {/* Create New Room Button */}
            <div style={{
              display: 'flex',
              gap: '0.5rem'
            }}>
              <button
                onClick={() => {
                  const newRoomName = prompt('Enter new room name:');
                  if (newRoomName && newRoomName.trim()) {
                    window.location.href = `/room/${newRoomName.trim()}`;
                  }
                }}
                style={{
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flex: 1
                }}
              >
                Create New Room
              </button>
            </div>
          </div>
        )}

        {/* Debug Info */}
        {token && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              zIndex: 10000,
              fontFamily: 'monospace'
            }}
          >
            Token: {token ? '✅' : '❌'}<br/>
            Room: {roomName}<br/>
            User: {user?.uid || 'none'}
          </div>
        )}
      </LiveKitRoom>
    </>
  );
}

// Server component that handles the params
export default async function RoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomName } = await params;
  
  return <RoomClient roomName={roomName} />;
}
