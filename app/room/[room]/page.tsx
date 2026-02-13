'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import InvitationManager from '@/components/InvitationManager';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { useLiveKitControlsFix } from '@/hooks/useLiveKitControlsFix';
import { useLiveKitSpeechUiGuard } from '@/hooks/useLiveKitSpeechUiGuard';

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

  // Shared cleanup function for orphaned menus
  const cleanupOrphanedMenus = useCallback(() => {
    // Only run cleanup if no button is currently expanded
    const anyExpanded = !!document.querySelector('.lk-control-bar [aria-expanded="true"]');
    if (!anyExpanded) {
      document.querySelectorAll('.lk-device-menu, .lk-dropdown, .lk-menu').forEach((menu) => {
        const el = menu as HTMLElement;
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        const hovered = el.matches(':hover');
        
        // Only remove if visible, not hovered, and no expanded button
        if (visible && !hovered) {
          el.remove();
        }
      });
    }
  }, []);

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
            
            // Load existing transcription data if available
            const callDoc = await getDoc(callRef);
            if (callDoc.exists()) {
              const callData = callDoc.data();
              if (callData.transcription && callData.transcription.length > 0) {
                setTranscription(callData.transcription);
                console.log('✅ Loaded existing transcription data:', callData.transcription.length, 'entries');
              }
            }
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

  // Transcription capture component - ENABLED with improved error handling
  const TranscriptionCapture = () => {
    // Re-enabled speech recognition with better error handling
    
    const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
    const [userInteracted, setUserInteracted] = useState<boolean>(false);
    const [hasStarted, setHasStarted] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [lastRestartTime, setLastRestartTime] = useState<number>(0);
    const [restartCount, setRestartCount] = useState<number>(0);
    const [isThrottled, setIsThrottled] = useState<boolean>(false);
    const { isUIActive, speechPaused } = useLiveKitSpeechUiGuard({
      enabled: Boolean(token),
      recognitionInstance,
      cleanupOrphanedMenus,
    });
    
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
      recognition.maxAlternatives = 1;
      
      // Make it more sensitive to speech
      if ('webkitSpeechRecognition' in window) {
        (recognition as any).continuous = true;
        (recognition as any).interimResults = true;
      }

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
          const confidence = result[0].confidence || 0;
          
          console.log(`Result ${i}: "${transcript}" (confidence: ${confidence}, isFinal: ${isFinal})`);
          
          // Accept both final results and interim results with lower confidence threshold
          if (transcript && (isFinal || confidence > 0.3)) {
            const timestamp = new Date().toISOString();
            const entry = `[${timestamp}] ${transcript}`;
            
            setTranscription(prev => {
              const newTranscription = [...prev, entry];
              
              // Store in Firestore immediately for short conversations
              if (db) {
                try {
                const callRef = doc(db, 'calls', roomName);
                updateDoc(callRef, {
                  transcription: newTranscription,
                  lastTranscriptionUpdate: new Date(),
                  transcriptionCount: newTranscription.length,
                  hasTranscriptionData: newTranscription.length > 0
                }).then(() => {
                  console.log('✅ Transcription stored successfully:', newTranscription.length, 'entries');
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
        
        // Improved error handling to prevent UI interference
        if (event.error === 'aborted') {
          console.log('🎤 Speech recognition aborted - this is normal');
          // Don't restart on abort to prevent interference with UI interactions
          return;
        } else if (event.error === 'no-speech') {
          console.log('🎤 No speech detected - continuing to listen');
          // Restart recognition after a longer delay to reduce interference
          setTimeout(() => {
            try {
              const now = Date.now();
              // Add throttle to prevent too many restarts and UI interference
              // Don't restart if UI is active or speech is paused
              if (now - lastRestartTime > 5000 && recognition && recognition.state !== 'recording' && !isThrottled && !isUIActive && !speechPaused) {
                setLastRestartTime(now);
                setRestartCount(prev => prev + 1);
                recognition.start();
              } else if (isUIActive || speechPaused) {
                console.log('🎤 Speech recognition restart skipped - UI interaction in progress');
              }
            } catch (error) {
              console.log('Failed to restart recognition after no-speech:', error);
            }
          }, 5000); // Increased to 5 seconds to reduce interference
        } else {
          // For other errors, wait much longer before restarting
          setTimeout(() => {
            try {
              const now = Date.now();
              // Add throttle to prevent too many restarts and UI interference
              // Don't restart if UI is active or speech is paused
              if (now - lastRestartTime > 10000 && recognition && recognition.state !== 'recording' && !isThrottled && !isUIActive && !speechPaused) {
                setLastRestartTime(now);
                setRestartCount(prev => prev + 1);
                recognition.start();
              } else if (isUIActive || speechPaused) {
                console.log('🎤 Speech recognition restart skipped - UI interaction in progress');
              }
            } catch (error) {
              console.log('Failed to restart recognition after error:', error);
            }
          }, 10000); // Wait 10 seconds for other errors to prevent UI interference
        }
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setSpeechRecognitionStatus('idle');
        
        // Auto-restart speech recognition with longer delay to reduce interference
        setTimeout(() => {
          try {
            const now = Date.now();
            // Add throttle to prevent interference with UI interactions
            // Don't restart if UI is active or speech is paused
            if (now - lastRestartTime > 5000 && recognition && recognition.state !== 'recording' && !isThrottled && !isUIActive && !speechPaused) {
              console.log('🔄 Restarting speech recognition...');
              setLastRestartTime(now);
              setRestartCount(prev => prev + 1);
              recognition.start();
            } else if (isUIActive || speechPaused) {
              console.log('🎤 Speech recognition restart skipped - UI interaction in progress');
            }
          } catch (error) {
            console.log('Failed to restart recognition:', error);
          }
        }, 3000); // Increased to 3 seconds to reduce interference with UI
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

    // Throttle mechanism to prevent too many restarts
    useEffect(() => {
      if (restartCount > 10) {
        console.log('🛑 Too many speech recognition restarts, throttling for 30 seconds');
        setIsThrottled(true);
        setTimeout(() => {
          setIsThrottled(false);
          setRestartCount(0);
          console.log('✅ Speech recognition throttle lifted');
        }, 30000); // Throttle for 30 seconds
      }
    }, [restartCount]);

    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '0.5rem',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        maxWidth: '200px'
      }}>
        <div>🎤 Status: {speechRecognitionStatus}</div>
        <div>📝 Entries: {transcription.length}</div>
        <div>🔄 Restarts: {restartCount}</div>
        {isThrottled && <div>🛑 Throttled</div>}
        {isUIActive && <div>🖱️ UI Active</div>}
        {speechPaused && <div>⏸️ Speech Paused</div>}
        {transcription.length > 0 && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.625rem' }}>
            Latest: {transcription[transcription.length - 1]?.substring(0, 50)}...
          </div>
        )}
        <button
          onClick={() => {
            console.log('Current transcription data:', transcription);
            console.log('Transcription length:', transcription.length);
            console.log('Speech recognition status:', speechRecognitionStatus);
            console.log('Recognition instance:', recognitionInstance);
          }}
          style={{
            marginTop: '0.25rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.625rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Debug
        </button>
        <button
          onClick={() => {
            // Test adding a manual transcription entry
            const testEntry = `[${new Date().toISOString()}] Test transcription entry - operating systems discussion`;
            setTranscription(prev => {
              const newTranscription = [...prev, testEntry];
              console.log('Added test transcription entry:', testEntry);
              
              // Also store in Firestore
              if (db) {
                const callRef = doc(db, 'calls', roomName);
                updateDoc(callRef, {
                  transcription: newTranscription,
                  lastTranscriptionUpdate: new Date(),
                  transcriptionCount: newTranscription.length,
                  hasTranscriptionData: newTranscription.length > 0
                }).then(() => {
                  console.log('✅ Test transcription stored in Firestore');
                }).catch(error => {
                  console.error('Error storing test transcription:', error);
                });
              }
              
              return newTranscription;
            });
          }}
          style={{
            marginTop: '0.25rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.625rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Test Add
        </button>
      </div>
    );
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
              lastTranscriptionUpdate: new Date(),
              transcriptionCount: newTranscription.length,
              hasTranscriptionData: newTranscription.length > 0
            }).then(() => {
              console.log('✅ Manual note stored successfully:', newTranscription.length, 'entries');
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
  const handleLeaveCall = async () => {
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
    
    // Proactively record consultation completion for the doctor side
    try {
      if (roomName && user?.uid) {
        await fetch('/api/track-consultation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName, action: 'leave', userId: user.uid })
        }).catch((e) => console.error('track-consultation leave failed:', e));
      }
    } catch (e) {
      console.error('Error calling track-consultation leave:', e);
    }
    
    // Redirect to home page
    window.location.href = '/';
  };

  // Ensure leave is tracked on tab/window close as a fallback
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (roomName && user?.uid) {
          navigator.sendBeacon?.(
            '/api/track-consultation',
            new Blob([
              JSON.stringify({ roomName, action: 'leave', userId: user.uid })
            ], { type: 'application/json' })
          );
        }
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [roomName, user?.uid]);
  useLiveKitControlsFix({ enabled: Boolean(token), cleanupOrphanedMenus });

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
            
            {/* Secure Invitation Manager */}
            {user && (
              <InvitationManager user={user} roomName={roomName} />
            )}

            {/* Legacy Room URL Display (for backward compatibility) */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.75rem' }}>🔗 Legacy Room Link (Unsecured)</h3>
              <p style={{ fontSize: '1rem', color: '#6B7280', marginBottom: '1rem' }}>⚠️ This is an unsecured link. Use the secure invitation system above for better security:</p>
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
      {/* Invitation Manager Sidebar - Always visible when user is authenticated */}
      {user && createPortal(
        <CollapsibleSidebar
          title="Secure Patient Invitations"
          icon="🔒"
          position="left"
          defaultCollapsed={false}
          width={350}
          collapsedWidth={60}
        >
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ 
              margin: '0', 
              color: '#6b7280', 
              fontSize: '0.8rem',
              marginBottom: '1rem'
            }}>
              Create secure, restricted access links for patients
            </p>
          </div>
          
          <InvitationManager user={user} roomName={roomName} />
          
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid #e5e7eb' 
          }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`);
                alert('Legacy patient link copied to clipboard!');
              }}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                width: '100%',
                marginBottom: '0.5rem'
              }}
            >
              📋 Copy Legacy Link
            </button>
          </div>
        </CollapsibleSidebar>,
        typeof window !== 'undefined' ? document.body : ({} as any)
      )}

      {/* Fix Control Panel - Rendered in a portal so it never gets hidden by LiveKit */}
      {createPortal(
        <CollapsibleSidebar
          title="Fix Control Panel"
          icon="🛠️"
          position="right"
          defaultCollapsed={false}
          width={300}
          collapsedWidth={60}
        >
          <div style={{ marginBottom: '0.75rem' }}>
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
            {/* Custom Device Selection - Bypass LiveKit dropdowns */}
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '0.75rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#0c4a6e' }}>
                🎛️ Device Controls
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <select
                  id="microphone-select"
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    backgroundColor: 'white'
                  }}
                  onChange={async (e) => {
                    const deviceId = e.target.value;
                    if (deviceId && navigator.mediaDevices) {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                          audio: { deviceId: { exact: deviceId } },
                          video: false 
                        });
                        // Apply to LiveKit audio tracks
                        document.querySelectorAll('audio').forEach(audio => {
                          if (audio.srcObject) {
                            (audio.srcObject as MediaStream).getAudioTracks().forEach(track => track.stop());
                          }
                          audio.srcObject = stream;
                        });
                        console.log('🎤 Microphone changed to:', deviceId);
                      } catch (error) {
                        console.error('Error changing microphone:', error);
                      }
                    }
                  }}
                >
                  <option value="">Select Microphone</option>
                </select>
                <select
                  id="camera-select"
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    backgroundColor: 'white'
                  }}
                  onChange={async (e) => {
                    const deviceId = e.target.value;
                    if (deviceId && navigator.mediaDevices) {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                          audio: false,
                          video: { deviceId: { exact: deviceId } }
                        });
                        // Apply to LiveKit video tracks
                        document.querySelectorAll('video').forEach(video => {
                          if (video.srcObject) {
                            (video.srcObject as MediaStream).getVideoTracks().forEach(track => track.stop());
                          }
                          video.srcObject = stream;
                        });
                        console.log('📹 Camera changed to:', deviceId);
                      } catch (error) {
                        console.error('Error changing camera:', error);
                      }
                    }
                  }}
                >
                  <option value="">Select Camera</option>
                </select>
              </div>
            </div>
            
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
        </CollapsibleSidebar>,
        typeof window !== 'undefined' ? document.body : ({} as any)
      )}

      {/* Manual Notes Sidebar */}
      {createPortal(
        <CollapsibleSidebar
          title="Manual Notes"
          icon="📝"
          position="right"
          defaultCollapsed={true}
          width={350}
          collapsedWidth={60}
          style={{ top: '100px' }} // Position below the Fix Control Panel
        >
          <ManualTranscriptionInput />
          {manualNotes.length > 0 && (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <h4 style={{ 
                margin: '0 0 0.5rem 0', 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                color: '#374151' 
              }}>
                Recent Notes:
              </h4>
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
        </CollapsibleSidebar>,
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


