import React, { useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Import refactored components
import { ParticipantGrid } from '@/components/video-call/ParticipantGrid';
import { ControlBar } from '@/components/video-call/ControlBar';
import { TranscriptionOverlay } from '@/components/video-call/TranscriptionOverlay';

// Import store
import { selectAuth, selectVideoCall, selectTranscription, authActions, videoCallActions, transcriptionActions } from '@/store';

interface RoomClientProps {
  roomName: string;
}

export function RoomClient({ roomName }: RoomClientProps) {
  const dispatch = useDispatch();
  const authState = useSelector(selectAuth);
  const videoCallState = useSelector(selectVideoCall);
  const transcriptionState = useSelector(selectTranscription);

  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        dispatch(authActions.setUser(user));
      });
    } else {
      console.warn('Firebase auth not initialized');
    }
  }, []);

  // Check if this is a doctor trying to access their own room
  useEffect(() => {
    if (authState.user && roomName && db) {
      const checkRoomOwnership = async () => {
        if (!db) return;
        try {
          const roomRef = doc(db, 'rooms', roomName);
          const roomDoc = await getDoc(roomRef);
          if (roomDoc.exists()) {
            const roomData = roomDoc.data();
            if (roomData?.createdBy === authState.user?.uid) {
              console.log('Doctor detected, auto-joining room:', roomName);
              handleJoinRoom();
              localStorage.setItem(`doctorGeneratedLink_${roomName}`, 'true');
            }
          }
        } catch (error) {
          console.error('Error checking room ownership:', error);
        }
      };
      checkRoomOwnership();
    }
  }, [authState.user?.uid, roomName, db]);

  // Check for existing token on page load
  useEffect(() => {
    const savedToken = localStorage.getItem(`doctorToken_${roomName}`);
    if (savedToken) {
      dispatch(videoCallActions.setToken(savedToken));
    }
  }, [roomName]);

  // Function to join the current room
  const handleJoinRoom = async () => {
    if (!authState.user || !roomName) {
      alert('Please ensure you are logged in and have a room name');
      return;
    }

    setIsJoining(true);
    setTokenError(null);

    try {
      const identity = authState.user?.displayName || authState.user?.email || authState.user?.uid || 'Anonymous';

      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName: identity }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get token');
      }

      dispatch(videoCallActions.setToken(data.token));
      dispatch(videoCallActions.setRoomName(roomName));
      
      // Store call data in Firestore
      if (db) {
        try {
          const callRef = doc(db, 'calls', roomName);
          await setDoc(callRef, {
            roomName,
            createdBy: authState.user.uid,
            createdAt: new Date(),
            status: 'active',
            metadata: { 
              createdBy: authState.user.uid,
              userId: authState.user.uid,
              userEmail: authState.user.email,
              userName: authState.user.displayName
            }
          }, { merge: true });
          console.log('Call data stored in Firestore');
        } catch (error) {
          console.error('Error storing call data:', error);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join room';
      setTokenError(errorMessage);
      console.error('Room join error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  // Handle LiveKit room events
  const handleRoomConnected = () => {
    dispatch(videoCallActions.setIsConnected(true));
    dispatch(videoCallActions.setIsConnecting(false));
  };

  const handleRoomDisconnected = () => {
    dispatch(videoCallActions.resetCallState());
  };

  const handleParticipantConnected = (participant: any) => {
    console.log('Participant connected:', participant);
  };

  const handleParticipantDisconnected = (participant: any) => {
    console.log('Participant disconnected:', participant);
  };

  const handleLocalParticipant = (participant: any) => {
    dispatch(videoCallActions.setLocalParticipant(participant));
  };

  const handleParticipantsChanged = (participants: any[]) => {
    dispatch(videoCallActions.setParticipants(participants));
  };

  // Toggle audio
  const handleToggleAudio = (participant: any) => {
    if (participant) {
      if (participant.isMicrophoneEnabled) {
        participant.setMicrophoneEnabled(false);
      } else {
        participant.setMicrophoneEnabled(true);
      }
    }
  };

  // Toggle video
  const handleToggleVideo = (participant: any) => {
    if (participant) {
      if (participant.isCameraEnabled) {
        participant.setCameraEnabled(false);
      } else {
        participant.setCameraEnabled(true);
      }
    }
  };

  // Toggle screen share
  const handleToggleScreenShare = async () => {
    if (videoCallState.localParticipant) {
      try {
        if (videoCallState.localParticipant.isScreenShareEnabled) {
          await videoCallState.localParticipant.setScreenShareEnabled(false);
        } else {
          await videoCallState.localParticipant.setScreenShareEnabled(true);
        }
      } catch (error) {
        console.error('Screen share error:', error);
      }
    }
  };

  // Leave room
  const handleLeaveRoom = () => {
    if (videoCallState.room) {
      videoCallState.room.disconnect();
    }
  };

  // Add manual note
  const handleAddManualNote = (note: string) => {
    const timestamp = new Date().toISOString();
    const entry = `[Manual Note] (${timestamp}): ${note}`;
    
    dispatch(transcriptionActions.addManualNote(entry));
    
    // Store in Firestore
    if (db) {
      const callRef = doc(db, 'calls', roomName);
      const currentTranscription = [...transcriptionState.transcription, entry];
      
      import('firebase/firestore').then(({ updateDoc }) => {
        updateDoc(callRef, {
          transcription: currentTranscription,
          lastTranscriptionUpdate: new Date(),
          transcriptionCount: currentTranscription.length,
          hasTranscriptionData: currentTranscription.length > 0
        }).catch(error => {
          console.error('Error storing manual note:', error);
        });
      });
    }
  };

  // Show loading state
  if (!authState.isAuthenticated) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Authenticating...</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #0f172a;
            color: white;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #1e293b;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show token input form
  if (!videoCallState.token && authState.isAuthenticated) {
    return (
      <div className="join-room-container">
        <div className="join-room-card">
          <h2>🚀 Join Consultation Room</h2>
          <p>Room: <strong>{roomName}</strong></p>
          
          {tokenError && (
            <div className="error-message">
              ❌ {tokenError}
            </div>
          )}
          
          <button
            onClick={handleJoinRoom}
            disabled={isJoining}
            className="join-button"
          >
            {isJoining ? '🔄 Joining...' : '🎥 Join Room'}
          </button>
          
          <style jsx>{`
            .join-room-container {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background: #0f172a;
            }
            .join-room-card {
              background: white;
              border-radius: 12px;
              padding: 32px;
              text-align: center;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              max-width: 400px;
            }
            .join-room-card h2 {
              margin: 0 0 16px 0;
              color: #1e293b;
            }
            .join-room-card p {
              margin: 0 0 24px 0;
              color: #64748b;
            }
            .error-message {
              background: #dc2626;
              color: white;
              padding: 12px;
              border-radius: 6px;
              margin-bottom: 16px;
            }
            .join-button {
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 8px;
              padding: 12px 24px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }
            .join-button:hover:not(:disabled) {
              background: #2563eb;
            }
            .join-button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Show video call interface
  return (
    <div className="room-container">
      <LiveKitRoom
        token={videoCallState.token || ''}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        connect={true}
        onConnected={handleRoomConnected}
        onDisconnected={handleRoomDisconnected}
      />
      <ParticipantGrid
        participants={videoCallState.participants}
        localParticipant={videoCallState.localParticipant}
        onToggleAudio={(participant) => handleToggleAudio(participant)}
        onToggleVideo={(participant) => handleToggleVideo(participant)}
        onToggleScreenShare={handleToggleScreenShare}
      />
      <ControlBar
        onToggleAudio={() => videoCallState.localParticipant && handleToggleAudio(videoCallState.localParticipant)}
        onToggleVideo={() => videoCallState.localParticipant && handleToggleVideo(videoCallState.localParticipant)}
        onLeaveRoom={handleLeaveRoom}
      />
      <TranscriptionOverlay
        isVisible={true}
        onAddManualNote={handleAddManualNote}
      />

      <style jsx>{`
        .room-container {
          height: 100vh;
          background: #0f172a;
          position: relative;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
