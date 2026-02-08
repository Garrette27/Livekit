import { useState, useCallback, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { Room, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { db } from '../lib/firebase';

// Custom hook for video call functionality
export function useVideoCall(roomName: string) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Generate LiveKit token
  const generateToken = useCallback(async (user: User | null) => {
    if (!user || !roomName) {
      setTokenError('User and room name are required');
      return null;
    }

    setIsJoining(true);
    setTokenError(null);

    try {
      const identity = user.displayName || user.email || user.uid;
      
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName, 
          participantName: identity 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get token');
      }

      const data = await response.json();
      setToken(data.token);
      
      // Store token in localStorage for persistence
      localStorage.setItem(`doctorToken_${roomName}`, data.token);
      
      return data.token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate token';
      setTokenError(errorMessage);
      console.error('Token generation error:', error);
      return null;
    } finally {
      setIsJoining(false);
    }
  }, [roomName]);

  // Join room with token
  const joinRoom = useCallback(async (user: User | null) => {
    const generatedToken = await generateToken(user);
    if (generatedToken) {
      setIsConnecting(true);
    }
    return generatedToken;
  }, [generateToken]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setParticipants([]);
      setLocalParticipant(null);
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [room]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localParticipant) {
      if (localParticipant.isMicrophoneEnabled) {
        localParticipant.setMicrophoneEnabled(false);
      } else {
        localParticipant.setMicrophoneEnabled(true);
      }
    }
  }, [localParticipant]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localParticipant) {
      if (localParticipant.isCameraEnabled) {
        localParticipant.setCameraEnabled(false);
      } else {
        localParticipant.setCameraEnabled(true);
      }
    }
  }, [localParticipant]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (localParticipant) {
      try {
        if (localParticipant.isScreenShareEnabled) {
          await localParticipant.setScreenShareEnabled(false);
        } else {
          await localParticipant.setScreenShareEnabled(true);
        }
      } catch (error) {
        console.error('Screen share error:', error);
      }
    }
  }, [localParticipant]);

  // Store call data in Firestore
  const storeCallData = useCallback(async (user: User) => {
    if (!roomName || !user) return;

    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

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
      
      console.log('Call data stored in Firestore');
    } catch (error) {
      console.error('Error storing call data:', error);
    }
  }, [roomName]);

  // Check for existing token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(`doctorToken_${roomName}`);
    if (savedToken) {
      setToken(savedToken);
    }
  }, [roomName]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    // State
    token,
    tokenError,
    isJoining,
    room,
    participants,
    localParticipant,
    isConnected,
    isConnecting,
    
    // Actions
    generateToken,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    storeCallData,
    
    // Setters (for LiveKit room callbacks)
    setRoom,
    setParticipants,
    setLocalParticipant,
    setIsConnected,
    setIsConnecting,
  };
}
