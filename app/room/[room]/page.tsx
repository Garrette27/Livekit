'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom, useRoomContext } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, updateDoc, getFirestore } from 'firebase/firestore';

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

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        setUser(user);
      });
    }
  }, []);
  const db = getFirestore();

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
            room: roomName,
            participant: user.displayName || user.uid,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Token received:', data);
        setToken(data.token);

        // Store call data in Firestore
        if (db) {
          const callRef = doc(db, 'calls', roomName);
          await setDoc(callRef, {
            roomName,
            createdBy: user.uid,
            createdAt: new Date(),
            status: 'active',
            metadata: { createdBy: user.uid }
          }, { merge: true });
          console.log('Call data stored in Firestore');
        }
      } catch (error) {
        console.error('Error getting token:', error);
      }
    };

    getToken();
  }, [roomName, user, db]);

  // Transcription capture component
  const TranscriptionCapture = () => {
    useEffect(() => {
      if (!token || !roomName) return;

      console.log('Setting up transcription for room:', roomName);
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        return;
      }

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
                const callRef = doc(db, 'calls', roomName);
                updateDoc(callRef, {
                  transcription: newTranscription,
                  lastTranscriptionUpdate: new Date()
                }).catch(error => {
                  console.error('Error storing transcription:', error);
                });
              }
              
              return newTranscription;
            });
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Speech recognition error:', event.error);
        setSpeechRecognitionStatus('error');
        
        // Restart recognition after error
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.error('Failed to restart speech recognition:', error);
          }
        }, 1000);
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setSpeechRecognitionStatus('stopped');
        
        // Restart recognition
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.error('Failed to restart speech recognition:', error);
          }
        }, 1000);
      };

      try {
        recognition.start();
        console.log('✅ Speech recognition started successfully');
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }

      return () => {
        try {
          recognition.stop();
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
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#6b7280'
      }}>
        Loading room...
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
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={`https://livekit-frontend-tau.vercel.app/room/${roomName}`}
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
                  navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}`);
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
