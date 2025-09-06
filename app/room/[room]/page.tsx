'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import Link from 'next/link';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    debugLogged?: boolean;
    speechRecognitionActive?: boolean;
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

  // Check if this is a doctor trying to access their own room
  useEffect(() => {
    if (user && roomName && db) {
      // Check if this room was created by the current user
      const checkRoomOwnership = async () => {
        if (!db) return;
        try {
          const roomRef = doc(db, 'rooms', roomName);
          const roomDoc = await getDoc(roomRef);
          if (roomDoc.exists()) {
            const roomData = roomDoc.data();
            if (roomData?.createdBy === user.uid) {
              // This is the doctor who created the room, auto-join
              console.log('Doctor detected, auto-joining room:', roomName);
              handleJoinRoom();
              
              // Mark that this doctor has generated a link for this room
              localStorage.setItem(`doctorGeneratedLink_${roomName}`, 'true');
            }
          }
        } catch (error) {
          console.error('Error checking room ownership:', error);
        }
      };
      checkRoomOwnership();
    }
  }, [user, roomName, db]);

  // Check for existing token on page load
  useEffect(() => {
    const savedToken = localStorage.getItem(`doctorToken_${roomName}`);
    if (savedToken) {
      setToken(savedToken);
    }
  }, [roomName]);

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

      // Save token to localStorage for persistence
      localStorage.setItem(`doctorToken_${roomName}`, data.token);
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
        
        // Save token to localStorage for persistence
        localStorage.setItem(`doctorToken_${roomName}`, data.token);
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
  }, [roomName, user]);

  // Transcription capture component - DISABLED to prevent loops
  const TranscriptionCapture = () => {
    // Temporarily disable speech recognition to prevent loops
    return null;
    
    const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
    const [userInteracted, setUserInteracted] = useState<boolean>(false);
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    
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
      
      // Prevent multiple speech recognition instances
      if (recognitionInstance || hasStarted || isInitialized) {
        return;
      }

      console.log('Setting up transcription for room:', roomName);
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        return;
      }

      // Create a single recognition instance and store it
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // Store the instance to prevent recreation
      setRecognitionInstance(recognition);

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
        setSpeechRecognitionStatus('idle');
        
        // Don't auto-restart on errors to prevent infinite loops
        if (event.error === 'aborted') {
          console.log('🎤 Speech recognition aborted - this is normal');
        }
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setSpeechRecognitionStatus('idle');
        
        // Don't auto-restart to prevent excessive re-rendering
        // Let the user manually restart if needed
      };

      // Store the recognition instance
      setRecognitionInstance(recognition);

      try {
        recognition.start();
        setHasStarted(true);
        setIsInitialized(true);
        console.log('✅ Speech recognition started successfully');
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }

      return () => {
        try {
          if (recognition && recognition.state === 'recording') {
          recognition.stop();
            recognition.abort();
          }
        } catch (error) {
          console.error('Error stopping speech recognition:', error);
        }
      };
    }, [token, roomName, userInteracted]);

    // Cleanup on unmount and prevent multiple instances
    useEffect(() => {
      return () => {
        if (recognitionInstance) {
          try {
            recognitionInstance.stop();
            recognitionInstance.abort();
          } catch (error) {
            console.error('Error cleaning up speech recognition:', error);
          }
        }
        setHasStarted(false);
      };
    }, [recognitionInstance]);

    // Prevent multiple speech recognition setups
    useEffect(() => {
      if (recognitionInstance || hasStarted || isInitialized) {
        return;
      }
    }, [recognitionInstance, hasStarted, isInitialized]);

    // Global flag to prevent multiple instances across renders
    useEffect(() => {
      if (window.speechRecognitionActive) {
        return;
      }
      window.speechRecognitionActive = true;
      
      return () => {
        window.speechRecognitionActive = false;
      };
    }, []);

    // Reset hasStarted when component unmounts or token changes
    useEffect(() => {
      return () => {
        setHasStarted(false);
        setRecognitionInstance(null);
      };
    }, [token]);

    // Reset hasStarted when room changes
    useEffect(() => {
      setHasStarted(false);
      setRecognitionInstance(null);
    }, [roomName]);

    // Reset hasStarted when user changes
    useEffect(() => {
      setHasStarted(false);
      setRecognitionInstance(null);
    }, [user?.uid]);

    // Reset hasStarted when user changes
    useEffect(() => {
      setHasStarted(false);
      setRecognitionInstance(null);
    }, [user?.uid]);

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
        bottom: '100px',
        right: '20px',
        zIndex: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '2px solid #3b82f6',
        borderRadius: '0.75rem',
        padding: '1rem',
        minWidth: '300px',
        maxWidth: '400px'
      }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e40af', fontSize: '1rem', fontWeight: '600' }}>
          📝 Manual Notes
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter a note..."
            style={{
              flex: '1',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              minWidth: '0' // Prevent overflow
            }}
            onKeyPress={(e) => e.key === 'Enter' && addNote()}
          />
        <button
            onClick={addNote}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap' // Prevent text wrapping
            }}
          >
            Send
          </button>
        </div>
        {manualNotes.length > 0 && (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {manualNotes.map((note, index) => (
              <div key={index} style={{
                padding: '0.5rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                marginBottom: '0.5rem',
                fontSize: '0.75rem',
                color: '#475569',
                wordBreak: 'break-word' // Handle long text properly
              }}>
                {note}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Custom LiveKit Controls Component
  const LiveKitControls = () => {
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const toggleAudio = async () => {
      try {
        if (isAudioEnabled) {
          // Use browser APIs to mute audio
          const audioTracks = document.querySelectorAll('audio, video');
          audioTracks.forEach(track => {
            if (track instanceof HTMLMediaElement) {
              track.muted = true;
            }
          });
          setIsAudioEnabled(false);
        } else {
          // Use browser APIs to unmute audio
          const audioTracks = document.querySelectorAll('audio, video');
          audioTracks.forEach(track => {
            if (track instanceof HTMLMediaElement) {
              track.muted = false;
            }
          });
          setIsAudioEnabled(true);
        }
      } catch (error) {
        console.error('Error toggling audio:', error);
      }
    };

    const toggleVideo = async () => {
      try {
        if (isVideoEnabled) {
          // Use browser APIs to disable video
          const videoTracks = document.querySelectorAll('video');
          videoTracks.forEach(track => {
            if (track instanceof HTMLVideoElement) {
              track.style.display = 'none';
            }
          });
          setIsVideoEnabled(false);
        } else {
          // Use browser APIs to enable video
          const videoTracks = document.querySelectorAll('video');
          videoTracks.forEach(track => {
            if (track instanceof HTMLVideoElement) {
              track.style.display = 'block';
            }
          });
          setIsVideoEnabled(true);
        }
      } catch (error) {
        console.error('Error toggling video:', error);
      }
    };

    const toggleScreenShare = async () => {
      try {
        if (isScreenSharing) {
          // Stop screen sharing
          setIsScreenSharing(false);
        } else {
          // Start screen sharing using browser API
          if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            setIsScreenSharing(true);
            // The stream will be handled by LiveKit automatically
          }
        }
      } catch (error) {
        console.error('Error toggling screen share:', error);
      }
    };

    const leaveRoom = async () => {
      try {
        handleLeaveCall();
      } catch (error) {
        console.error('Error leaving room:', error);
        handleLeaveCall();
      }
    };

    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#2563eb',
        borderRadius: '0.75rem',
        padding: '1rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        zIndex: 10000,
        boxShadow: '0 8px 25px rgba(37, 99, 235, 0.3)',
        border: '2px solid #1d4ed8',
        minWidth: '600px'
      }}>
        <button
          onClick={toggleAudio}
          style={{
            backgroundColor: isAudioEnabled ? '#3b82f6' : '#dc2626',
            color: 'white',
            border: '2px solid #1d4ed8',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            fontWeight: '600',
            minWidth: '90px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {isAudioEnabled ? '🎤' : '🔇'} {isAudioEnabled ? 'Mute' : 'Unmute'}
        </button>

        <button
          onClick={toggleVideo}
          style={{
            backgroundColor: isVideoEnabled ? '#3b82f6' : '#dc2626',
            color: 'fix',
            border: '2px solid #1d4ed8',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            fontWeight: '600',
            minWidth: '90px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {isVideoEnabled ? '📹' : '🚫'} {isVideoEnabled ? 'Video' : 'No Video'}
        </button>

        <button
          onClick={toggleScreenShare}
          style={{
            backgroundColor: isScreenSharing ? '#f59e0b' : '#3b82f6',
            color: 'white',
            border: '2px solid #1d4ed8',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            fontWeight: '600',
            minWidth: '90px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {isScreenSharing ? '🖥️' : '🖥️'} {isScreenSharing ? 'Stop Share' : 'Share Screen'}
        </button>

        <button
          onClick={leaveRoom}
          style={{
            backgroundColor: '#dc2626',
            color: 'white',
            border: '2px solid #b91c1c',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            fontWeight: '600',
            minWidth: '90px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          🚪 Leave
        </button>
      </div>
    );
  };




  // Function to properly leave the call
  const handleLeaveCall = () => {
    // Clear stored token
    localStorage.removeItem(`doctorToken_${roomName}`);
    setToken(null);
    
    // Update call status in Firestore
    if (db && roomName) {
      try {
        const callRef = doc(db, 'calls', roomName);
        setDoc(callRef, {
          status: 'completed',
          endedAt: new Date()
        }, { merge: true }).catch(error => {
          console.error('Error updating call status:', error);
        });
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }
    
    // Redirect to home page
    window.location.href = '/';
  };

  // Ensure LiveKit controls are always visible and fix chat background
  useEffect(() => {
    if (!token) return;
    
    // Check if CSS is already injected
    if (document.getElementById('livekit-controls-fix')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'livekit-controls-fix';
    style.textContent = `
      /* Ensure LiveKit controls are always visible */
      .lk-control-bar {
        position: fixed !important;
        bottom: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 1000 !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        background-color: rgba(0, 0, 0, 0.8) !important;
        border-radius: 12px !important;
        padding: 12px !important;
        gap: 8px !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 400px !important;
        max-width: 90vw !important;
      }

      /* Ensure control buttons are visible */
      .lk-control-bar button {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        background-color: rgba(255, 255, 255, 0.1) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        color: white !important;
        font-size: 14px !important;
        min-width: 60px !important;
        height: 40px !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        transition: all 0.2s ease !important;
        position: relative !important;
      }

      .lk-control-bar button:hover {
        background-color: rgba(255, 255, 255, 0.2) !important;
        transform: translateY(-1px) !important;
      }

      /* Fix dropdown menus - ensure they can be closed */
      .lk-device-menu,
      .lk-device-menu-item,
      .lk-dropdown,
      .lk-menu {
        position: absolute !important;
        z-index: 1001 !important;
        background-color: rgba(0, 0, 0, 0.9) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 8px !important;
        padding: 8px 0 !important;
        min-width: 200px !important;
        max-width: 300px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        backdrop-filter: blur(10px) !important;
      }

      .lk-device-menu-item {
        padding: 8px 16px !important;
        color: white !important;
        cursor: pointer !important;
        border: none !important;
        background: transparent !important;
        width: 100% !important;
        text-align: left !important;
        font-size: 14px !important;
        transition: background-color 0.2s ease !important;
      }

      .lk-device-menu-item:hover {
        background-color: rgba(255, 255, 255, 0.1) !important;
      }

      /* Ensure dropdowns close when clicking outside */
      .lk-device-menu[aria-expanded="false"],
      .lk-dropdown[aria-expanded="false"] {
        display: none !important;
      }

      .lk-device-menu[aria-expanded="true"],
      .lk-dropdown[aria-expanded="true"] {
        display: block !important;
      }

      /* Fix overlapping text in dropdown items */
      .lk-device-menu-item span,
      .lk-device-menu-item div {
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        max-width: 100% !important;
        display: block !important;
      }

      /* Fix chat background to be white */
      .lk-chat {
        background-color: white !important;
        color: black !important;
      }

      .lk-chat-message {
        background-color: #f8f9fa !important;
        color: black !important;
        border: 1px solid #e9ecef !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        margin: 4px 0 !important;
      }

      .lk-chat-input {
        background-color: white !important;
        color: black !important;
        border: 1px solid #ced4da !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
      }

      .lk-chat-input::placeholder {
        color: #6c757d !important;
      }

      /* Ensure video conference takes full screen */
      .lk-video-conference {
        width: 100vw !important;
        height: 100vh !important;
        position: relative !important;
        background-color: #000 !important;
      }

      /* Ensure participant video is properly sized */
      .lk-participant-video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }

      /* Fix any layout issues */
      .lk-room-container {
        width: 100vw !important;
        height: 100vh !important;
        position: relative !important;
        overflow: hidden !important;
      }

      /* Ensure our custom panels don't interfere */
      .fix-control-panel {
        z-index: 10001 !important;
        pointer-events: auto !important;
      }

      .back-to-home,
      .back-to-dashboard {
        z-index: 9999 !important;
        pointer-events: auto !important;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .lk-control-bar {
          min-width: 90vw !important;
          padding: 8px !important;
          gap: 4px !important;
        }
        
        .lk-control-bar button {
          min-width: 50px !important;
          padding: 6px 8px !important;
          font-size: 12px !important;
          height: 36px !important;
        }
      }
    `;

    document.head.appendChild(style);
    console.log('✅ LiveKit controls fix applied');

    // Force show controls periodically to ensure they're always visible
    const forceShowControls = () => {
      const controlBar = document.querySelector('.lk-control-bar') as HTMLElement;
      if (controlBar) {
        controlBar.style.setProperty('display', 'flex', 'important');
        controlBar.style.setProperty('visibility', 'visible', 'important');
        controlBar.style.setProperty('opacity', '1', 'important');
        controlBar.style.setProperty('position', 'fixed', 'important');
        controlBar.style.setProperty('bottom', '20px', 'important');
        controlBar.style.setProperty('left', '50%', 'important');
        controlBar.style.setProperty('transform', 'translateX(-50%)', 'important');
        controlBar.style.setProperty('z-index', '1000', 'important');
      }

      // Fix dropdown positioning and ensure they can be closed
      const dropdowns = document.querySelectorAll('.lk-device-menu, .lk-dropdown, .lk-menu');
      dropdowns.forEach(dropdown => {
        const element = dropdown as HTMLElement;
        element.style.setProperty('position', 'absolute', 'important');
        element.style.setProperty('z-index', '1001', 'important');
        element.style.setProperty('background-color', 'rgba(0, 0, 0, 0.9)', 'important');
        element.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.2)', 'important');
        element.style.setProperty('border-radius', '8px', 'important');
        element.style.setProperty('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.3)', 'important');
        element.style.setProperty('backdrop-filter', 'blur(10px)', 'important');
      });

      // Fix dropdown items
      const dropdownItems = document.querySelectorAll('.lk-device-menu-item');
      dropdownItems.forEach(item => {
        const element = item as HTMLElement;
        element.style.setProperty('padding', '8px 16px', 'important');
        element.style.setProperty('color', 'white', 'important');
        element.style.setProperty('cursor', 'pointer', 'important');
        element.style.setProperty('border', 'none', 'important');
        element.style.setProperty('background', 'transparent', 'important');
        element.style.setProperty('width', '100%', 'important');
        element.style.setProperty('text-align', 'left', 'important');
        element.style.setProperty('font-size', '14px', 'important');
        element.style.setProperty('white-space', 'nowrap', 'important');
        element.style.setProperty('overflow', 'hidden', 'important');
        element.style.setProperty('text-overflow', 'ellipsis', 'important');
      });
    };

    // Apply immediately and then periodically
    forceShowControls();
    const interval = setInterval(forceShowControls, 1000);

    // Add click outside handler to close dropdowns
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isDropdown = target.closest('.lk-device-menu, .lk-dropdown, .lk-menu');
      const isControlButton = target.closest('.lk-control-bar button');
      
      if (!isDropdown && !isControlButton) {
        // Close all open dropdowns
        const openDropdowns = document.querySelectorAll('.lk-device-menu[aria-expanded="true"], .lk-dropdown[aria-expanded="true"]');
        openDropdowns.forEach(dropdown => {
          dropdown.setAttribute('aria-expanded', 'false');
          (dropdown as HTMLElement).style.display = 'none';
        });
      }
    };

    // Add escape key handler to close dropdowns
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const openDropdowns = document.querySelectorAll('.lk-device-menu[aria-expanded="true"], .lk-dropdown[aria-expanded="true"]');
        openDropdowns.forEach(dropdown => {
          dropdown.setAttribute('aria-expanded', 'false');
          (dropdown as HTMLElement).style.display = 'none';
        });
      }
    };

    // Add event listeners
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      clearInterval(interval);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      const styleToRemove = document.getElementById('livekit-controls-fix');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [token]);

  // Function to properly disconnect from LiveKit
  const handleDisconnect = () => {
    // Clear stored token
    localStorage.removeItem(`doctorToken_${roomName}`);
    setToken(null);
    
    // Update call status in Firestore
    if (db && roomName) {
      try {
        const callRef = doc(db, 'calls', roomName);
        setDoc(callRef, {
          status: 'completed',
          endedAt: new Date()
        }, { merge: true }).catch(error => {
          console.error('Error updating call status:', error);
        });
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }
    
    // Redirect to home page
    window.location.href = '/';
  };


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
                  id="roomUrl"
                  name="roomUrl"
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
                  <label htmlFor="newRoomName" style={{ display: 'block', fontSize: '1rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    New Room Name
                  </label>
                  <input
                    id="newRoomName"
                    name="newRoomName"
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

  // Debug logging - only in development and only once
  if (process.env.NODE_ENV === 'development' && !window.debugLogged) {
  console.log('=== DOCTOR ROOM DEBUG ===');
  console.log('Rendering video interface, token:', !!token, 'user:', !!user, 'roomName:', roomName);
  console.log('=== END DEBUG ===');
    window.debugLogged = true;
  }

  return (
    <>
      {/* Fix Control Panel - Rendered in a portal so it never gets hidden by LiveKit */}
      {createPortal(
        <div
          className="fix-control-panel"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#ffffff',
            border: '2px solid #3b82f6',
            borderRadius: '0.75rem',
            padding: '1rem',
            zIndex: 100000, // keep above LiveKit overlays
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.12)',
            maxWidth: '300px',
            fontSize: '0.875rem',
            transition: 'all 0.3s ease',
            minHeight: '50px',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ 
                margin: '0', 
                color: '#1e40af', 
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                🛠️ Fix Control Panel
              </h3>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Connected as: {user?.displayName || user?.email || 'Doctor'}
                </p>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.75rem'
                }}>
                  Room: {roomName}
                </p>
          </div>
          
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              flexDirection: 'column'
            }}>
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.75rem',
                color: '#475569',
                wordBreak: 'break-all',
                marginBottom: '0.75rem',
                borderLeft: '3px solid #3b82f6'
              }}>
                <strong>Patient Link:</strong><br />
                {`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`}
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`);
                  alert('Patient link copied to clipboard!');
                }}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center',
                  width: '100%',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                }}
              >
                📋 Copy Patient Link
              </button>
              
              <button
                onClick={() => {
                  window.open(`/room/${roomName}/patient`, '_blank');
                }}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center',
                  width: '100%',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                }}
              >
                👥 Join as Patient
              </button>
              
              <button
                onClick={handleLeaveCall}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center',
                  width: '100%',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                }}
              >
                🚪 Leave Call
              </button>
            </div>
        </div>,
        typeof window !== 'undefined' ? document.body : ({} as any)
      )}
      
      <TranscriptionCapture />
      
      {/* MAIN VIDEO INTERFACE - Always show when token exists */}
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        audio
        video
        style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
        onDisconnected={() => {
          console.log('Disconnected from room');
          setToken(null);
          
          // Clear stored token
          localStorage.removeItem(`doctorToken_${roomName}`);
          
          // Update call status in Firestore
          if (db && roomName) {
            try {
              const callRef = doc(db, 'calls', roomName);
              setDoc(callRef, {
                status: 'completed',
                endedAt: new Date()
              }, { merge: true }).catch(error => {
                console.error('Error updating call status:', error);
              });
            } catch (error) {
              console.error('Error updating call status:', error);
            }
          }
          
          // Redirect to home page after disconnection
          window.location.href = '/';
        }}
        onError={(error) => {
          console.error('LiveKit error:', error);
        }}
      >
        {/* Video Conference Component - This provides the actual video controls */}
        <VideoConference />
        <ManualTranscriptionInput />
        
        {/* Back to Home Button - Simple and Clean */}
        <div
          className="back-to-home"
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #2563eb',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#2563eb',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            ← Back to Home
          </Link>
        </div>
        
        {/* Back to Dashboard Button */}
        <div
          className="back-to-dashboard"
          style={{
            position: 'fixed',
            top: '20px',
            left: '200px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #059669',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Link href="/dashboard" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#059669',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            📊 Dashboard
          </Link>
        </div>
        





      </LiveKitRoom>
    </>
  );
}

// Server component that handles the params
export default async function RoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomName } = await params;
  
  return <RoomClient roomName={roomName} />;
}
