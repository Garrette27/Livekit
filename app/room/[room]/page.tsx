'use client';

import { useEffect, useState } from 'react';
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
  const [isInfoPanelCollapsed, setIsInfoPanelCollapsed] = useState<boolean>(false);

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

  // Transcription capture component
  const TranscriptionCapture = () => {
    const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
    const [userInteracted, setUserInteracted] = useState<boolean>(false);
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    
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
      if (recognitionInstance || hasStarted) {
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
      if (recognitionInstance || hasStarted) {
        return;
      }
    }, [recognitionInstance, hasStarted]);

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
        zIndex: 999
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
        zIndex: 1000,
        boxShadow: '0 8px 25px rgba(37, 99, 235, 0.3)',
        border: '2px solid #1d4ed8'
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

  // Force blue controls - only once
  useEffect(() => {
    if (!token) return;
    
    // Check if CSS is already injected
    if (document.getElementById('livekit-force-blue-controls')) {
      return;
    }

    const forceBlueControls = () => {
      // Check if already injected
      if (document.getElementById('livekit-force-blue-controls')) {
        return;
      }
      
      // Inject CSS to force blue controls - More aggressive approach
      const style = document.createElement('style');
      style.id = 'livekit-force-blue-controls';
      style.textContent = `
            /* Force ALL LiveKit controls to be blue */
            .lk-control-bar button,
            .lk-control-bar [data-lk-kind],
            .lk-button,
            .lk-button-group button,
            .lk-focus-toggle,
            .lk-device-menu,
            .lk-device-menu button,
            .lk-device-menu-item,
            .lk-device-menu-item button,
            [class*="lk-"] button,
            button[class*="lk-"],
            button[aria-label*="microphone"],
            button[aria-label*="camera"],
            button[aria-label*="chat"],
            button[aria-label*="leave"],
            button[aria-label*="share"],
            .lk-control-bar *,
            .lk-button *,
            [class*="lk-"] *,
            button[aria-label*="microphone"] *,
            button[aria-label*="camera"] *,
            button[aria-label*="chat"] *,
            button[aria-label*="leave"] *,
            button[aria-label*="share"] * {
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
              z-index: 1000 !important;
              position: relative !important;
            }
            
            /* Force ALL LiveKit icons to be white */
            .lk-control-bar svg,
            .lk-button svg,
            [class*="lk-"] svg,
            button[aria-label*="microphone"] svg,
            button[aria-label*="camera"] svg,
            button[aria-label*="chat"] svg,
            button[aria-label*="leave"] svg,
            button[aria-label*="share"] svg,
            .lk-control-bar * svg,
            .lk-button * svg,
            [class*="lk-"] * svg {
              color: white !important;
              fill: white !important;
              stroke: white !important;
            }
            
            /* Force ALL LiveKit text to be white */
            .lk-control-bar span,
            .lk-button span,
            [class*="lk-"] span,
            button[aria-label*="microphone"] span,
            button[aria-label*="camera"] span,
            button[aria-label*="chat"] span,
            button[aria-label*="leave"] span,
            button[aria-label*="share"] span,
            .lk-control-bar * span,
            .lk-button * span,
            [class*="lk-"] * span {
              color: white !important;
              font-weight: 600 !important;
            }
            
            /* Override any dark themes */
            .lk-control-bar,
            .lk-button,
            [class*="lk-"] {
              background-color: transparent !important;
            }
            
            /* Force dropdown menus to be blue */
            .lk-device-menu,
            .lk-device-menu-item,
            .lk-device-menu-item button,
            .lk-device-menu *,
            .lk-device-menu-item * {
              background-color: #2563eb !important;
              color: white !important;
              border-color: #1d4ed8 !important;
            }
            
            /* Prevent animation bugs */
            .lk-focus-toggle,
            .lk-focus-toggle *,
            [class*="lk-"] {
              transition: none !important;
              animation: none !important;
            }
            
            /* Fix expand window animation */
            .lk-focus-toggle {
              transform: none !important;
              transition: none !important;
            }
            
            /* Ensure control bar is visible */
            .lk-control-bar {
              position: fixed !important;
              bottom: 20px !important;
              left: 50% !important;
              transform: translateX(-50%) !important;
              z-index: 1000 !important;
              background-color: rgba(0, 0, 0, 0.8) !important;
              border-radius: 1rem !important;
              padding: 1rem !important;
              display: flex !important;
              gap: 0.5rem !important;
              align-items: center !important;
            }
            
            /* Ensure video elements are properly sized */
            .lk-video-conference {
              width: 100vw !important;
              height: 100vh !important;
              position: relative !important;
            }
            
            /* Ensure participant video is visible */
            .lk-participant-video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
          `;
          document.head.appendChild(style);

      const selectors = [
        '.lk-control-bar',
        '[data-lk-kind]',
        '.lk-control-bar button',
        'button[data-lk-kind]',
        'button[aria-label*="microphone"]',
        'button[aria-label*="camera"]',
        'button[aria-label*="chat"]',
        'button[aria-label*="leave"]',
            'button[aria-label*="share"]',
            '.lk-button',
            '.lk-button-group button',
            '.lk-focus-toggle',
            '.lk-device-menu',
            '.lk-device-menu button',
            '.lk-device-menu-item',
            '.lk-device-menu-item button',
            '.lk-device-menu-item[role="menuitem"]',
            '.lk-device-menu-item[role="menuitem"] button'
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
            element.style.setProperty('z-index', '1000', 'important');
            element.style.setProperty('position', 'relative', 'important');
          }
        });
      });

      // Force all icons and text to be white
      const icons = document.querySelectorAll('.lk-control-bar svg, [data-lk-kind] svg, .lk-button svg, .lk-device-menu svg, .lk-device-menu-item svg');
      icons.forEach(icon => {
        if (icon instanceof SVGElement) {
          icon.style.setProperty('color', 'white', 'important');
          icon.style.setProperty('fill', 'white', 'important');
          icon.style.setProperty('stroke', 'white', 'important');
        }
      });

      const spans = document.querySelectorAll('.lk-control-bar span, [data-lk-kind] span, .lk-button span, .lk-device-menu span, .lk-device-menu-item span');
      spans.forEach(span => {
        if (span instanceof HTMLElement) {
          span.style.setProperty('color', 'white', 'important');
          span.style.setProperty('font-weight', '600', 'important');
        }
      });

      // Force dropdown menus to be blue
      const dropdowns = document.querySelectorAll('.lk-device-menu, .lk-device-menu-item, .lk-device-menu-item button');
      dropdowns.forEach(dropdown => {
        if (dropdown instanceof HTMLElement) {
          dropdown.style.setProperty('background-color', '#2563eb', 'important');
          dropdown.style.setProperty('color', 'white', 'important');
          dropdown.style.setProperty('border-color', '#1d4ed8', 'important');
        }
      });

      console.log('✅ Blue controls applied');
    };

    // Apply immediately
    forceBlueControls();

    // No need for interval - apply once and let CSS handle the rest
    return () => {
      // Cleanup if needed
    };
  }, [token]);

  // Inject global CSS override - only once
  useEffect(() => {
    if (!token) return;
    
    // Check if CSS is already injected
    if (document.getElementById('livekit-blue-controls-override')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'livekit-blue-controls-override';
    style.textContent = `
      /* Main control bar styling */
      .lk-control-bar {
        background-color: #2563eb !important;
        border-radius: 0.75rem !important;
        padding: 1rem !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 1rem !important;
        box-shadow: 0 8px 25px rgba(37, 99, 235, 0.3) !important;
        border: 2px solid #1d4ed8 !important;
      }

      /* Individual control buttons */
      .lk-control-bar button,
      [data-lk-kind],
      button[data-lk-kind],
      button[aria-label*="microphone"],
      button[aria-label*="camera"],
      button[aria-label*="chat"],
      button[aria-label*="leave"],
      button[aria-label*="share"] {
        background-color: #3b82f6 !important;
        color: white !important;
        border: 2px solid #1d4ed8 !important;
        border-radius: 0.75rem !important;
        padding: 0.75rem 1rem !important;
        font-weight: 600 !important;
        min-width: 90px !important;
        height: 48px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.5rem !important;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25) !important;
        transition: all 0.2s ease !important;
        position: relative !important;
      }

      /* Hover effects for buttons */
      .lk-control-bar button:hover,
      [data-lk-kind]:hover,
      button[data-lk-kind]:hover {
        background-color: #1d4ed8 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4) !important;
      }

      /* Active/pressed state */
      .lk-control-bar button:active,
      [data-lk-kind]:active,
      button[data-lk-kind]:active {
        transform: translateY(0) !important;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3) !important;
      }

      /* Icons styling */
      .lk-control-bar svg,
      [data-lk-kind] svg,
      button[data-lk-kind] svg {
        color: white !important;
        fill: white !important;
        stroke: white !important;
        width: 20px !important;
        height: 20px !important;
      }

      /* Text labels */
      .lk-control-bar span,
      [data-lk-kind] span,
      button[data-lk-kind] span {
        color: white !important;
        font-weight: 600 !important;
        font-size: 0.875rem !important;
        white-space: nowrap !important;
      }

      /* Hide the "Start Video" control as it's not standard LiveKit */
      button[aria-label*="Start Video"],
      button[aria-label*="start video"],
      button[aria-label*="StartVideo"] {
        display: none !important;
      }

      /* Ensure proper order: Microphone → Camera → Share → Chat → Leave */
      .lk-control-bar {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 1rem !important;
      }

      /* Specific button positioning and styling */
      button[aria-label*="microphone"],
      button[data-lk-kind="microphone"] {
        order: 1 !important;
      }

      button[aria-label*="camera"],
      button[data-lk-kind="camera"] {
        order: 2 !important;
      }

      button[aria-label*="share"],
      button[aria-label*="Share screen"],
      button[data-lk-kind="share"] {
        order: 3 !important;
      }

      button[aria-label*="chat"],
      button[data-lk-kind="chat"] {
        order: 4 !important;
      }

      button[aria-label*="leave"],
      button[data-lk-kind="leave"] {
        order: 5 !important;
        background-color: #dc2626 !important;
        border-color: #b91c1c !important;
      }

      button[aria-label*="leave"]:hover,
      button[data-lk-kind="leave"]:hover {
        background-color: #b91c1c !important;
      }

      /* Remove any floating or misplaced elements */
      .lk-control-bar > *:not(button) {
        display: none !important;
      }

      /* Ensure consistent spacing */
      .lk-control-bar button + button {
        margin-left: 0.5rem !important;
      }

      /* Remove any floating document icons or misplaced elements */
      .lk-control-bar img,
      .lk-control-bar svg:not([data-lk-kind] svg),
      .lk-control-bar *:not(button):not(span) {
        display: none !important;
      }

      /* Hide any floating elements that might interfere with controls */
      div[style*="position: fixed"][style*="bottom: 120px"] {
        z-index: 999 !important;
      }

      /* Ensure clean control bar - remove any non-standard elements */
      .lk-control-bar > *:not(button[data-lk-kind]):not(button[aria-label*="microphone"]):not(button[aria-label*="camera"]):not(button[aria-label*="share"]):not(button[aria-label*="chat"]):not(button[aria-label*="leave"]) {
        display: none !important;
      }

      /* Remove any floating icons or misplaced elements in the main area */
      div[style*="position: fixed"]:not([data-lk-kind]):not(.lk-control-bar) {
        z-index: 998 !important;
      }

      /* Ensure the control bar is properly positioned */
      .lk-control-bar {
        position: fixed !important;
        bottom: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 1000 !important;
        min-width: 600px !important;
        max-width: 800px !important;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .lk-control-bar {
          min-width: 90vw !important;
          max-width: 95vw !important;
          gap: 0.5rem !important;
          padding: 0.75rem !important;
        }
        
        .lk-control-bar button {
          min-width: 70px !important;
          padding: 0.5rem 0.75rem !important;
          font-size: 0.75rem !important;
        }
      }

      /* CRITICAL: Ensure video interface takes full screen */
      .lk-video-conference,
      .lk-room-container,
      .lk-room,
      [data-lk-kind="room"] {
        width: 100vw !important;
        height: 100vh !important;
        position: relative !important;
        overflow: hidden !important;
        background-color: #000 !important;
      }

      /* Ensure participant video is visible and properly sized */
      .lk-participant-video,
      .lk-participant-video video,
      .lk-participant-video canvas,
      .lk-participant-video img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border-radius: 0 !important;
      }

      /* Remove any margins or padding that might cause layout issues */
      .lk-video-conference *,
      .lk-room-container *,
      .lk-room * {
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      /* Ensure the main video area is not hidden */
      .lk-focus-layout,
      .lk-grid-layout,
      .lk-participant-tile {
        width: 100% !important;
        height: 100% !important;
        min-height: 100vh !important;
        min-width: 100vw !important;
      }

      /* Fix any floating elements that might be covering the video */
      div[style*="position: fixed"]:not(.fix-control-panel):not(.back-to-home):not(.debug-info) {
        z-index: 999 !important;
      }

      /* Ensure our custom overlays don't interfere with video */
      .fix-control-panel {
        z-index: 10001 !important;
        pointer-events: auto !important;
      }

      .fix-control-panel *,
      .fix-control-panel button {
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      .back-to-home {
        z-index: 9999 !important;
      }

      .debug-info {
        z-index: 10000 !important;
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

  // Check if fix control panel should be shown
  const shouldShowFixControlPanel = () => {
    // Only show the control panel as an overlay, not as a replacement for the video interface
    return localStorage.getItem(`doctorGeneratedLink_${roomName}`) === 'true';
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

  // Function to force show video interface (for debugging)
  const forceShowVideoInterface = () => {
    // Clear the generated link flag to hide the control panel
    localStorage.removeItem(`doctorGeneratedLink_${roomName}`);
    // Force re-render
    window.location.reload();
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
    console.log('isInfoPanelCollapsed:', isInfoPanelCollapsed);
    console.log('shouldShowFixControlPanel:', shouldShowFixControlPanel());
    console.log('=== END DEBUG ===');
    window.debugLogged = true;
  }

  return (
    <>
      {/* Fix Control Panel - Only visible when doctor has generated a link - OVERLAY on top of video */}
      {shouldShowFixControlPanel() && (
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
            zIndex: 10001,
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.12)',
            maxWidth: isInfoPanelCollapsed ? '60px' : '300px',
            fontSize: '0.875rem',
            transition: 'all 0.3s ease',
            minHeight: '50px',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ 
                margin: '0', 
                color: '#1e40af', 
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                🛠️ Fix Control Panel
              </h3>
              <button
                onClick={() => setIsInfoPanelCollapsed(!isInfoPanelCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#3b82f6',
                  padding: '0.25rem'
                }}
              >
                {isInfoPanelCollapsed ? '▶' : '◀'}
              </button>
            </div>
            {!isInfoPanelCollapsed && (
              <>
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
              </>
            )}
          </div>
          
                      {!isInfoPanelCollapsed && (
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(5, 150, 105, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(5, 150, 105, 0.2)';
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.2)';
                }}
              >
                🚪 Leave Call
              </button>
              
              <button
                onClick={() => {
                  // Clear the generated link flag
                  localStorage.removeItem(`doctorGeneratedLink_${roomName}`);
                  alert('Fix control panel hidden. Refresh to see changes.');
                }}
                style={{
                  backgroundColor: '#6b7280',
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
                  boxShadow: '0 2px 4px rgba(107, 114, 128, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.2)';
                }}
              >
                🗑️ Hide Panel
              </button>

              {/* Debug button to force show video interface */}
              <button
                onClick={() => {
                  // Clear the generated link flag and force reload
                  localStorage.removeItem(`doctorGeneratedLink_${roomName}`);
                  window.location.reload();
                }}
                style={{
                  backgroundColor: '#f59e0b',
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
                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.2)';
                }}
              >
                🔧 Force Show Video
              </button>
            </div>
          )}
        </div>
      )}
      
      <TranscriptionCapture />
      
      {/* MAIN VIDEO INTERFACE - Always show when token exists */}
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        audio
        video
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
        
        {/* Custom LiveKit Controls */}
        <LiveKitControls />
        
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





        {/* Debug Info - Only visible in development */}
        {process.env.NODE_ENV === 'development' && token && (
          <div
            className="debug-info"
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              zIndex: 10000,
              fontFamily: 'monospace',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div style={{ marginBottom: '0.25rem' }}>
              <strong>Debug Info:</strong>
            </div>
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
