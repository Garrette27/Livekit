'use client';

import React from 'react';
import { LiveKitRoom, VideoConference, useRoom } from '@livekit/components-react';

interface LiveKitShellProps {
  token: string;
  roomName: string;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

// Component to enable camera/mic after room connects
function EnableMediaTracks() {
  const room = useRoom();

  React.useEffect(() => {
    if (!room || !room.localParticipant) {
      return;
    }

    // Enable camera and microphone after connection
    // This happens after user interaction (joining room), so browser allows permissions
    const enableMedia = async () => {
      try {
        // Enable microphone
        await room.localParticipant.setMicrophoneEnabled(true);
        console.log('✅ Microphone enabled');

        // Enable camera
        await room.localParticipant.setCameraEnabled(true);
        console.log('✅ Camera enabled');
      } catch (error: any) {
        console.warn('Could not enable camera/microphone automatically:', error);
        // User can still enable manually via VideoConference controls
      }
    };

    // Listen for room connection event
    const handleConnected = () => {
      // Small delay to ensure room is fully connected
      setTimeout(() => {
        enableMedia();
      }, 500);
    };

    // Wait for connection event
    if (typeof room.on === 'function') {
      room.on('connected', handleConnected);
    }

    return () => {
      if (typeof room.off === 'function') {
        room.off('connected', handleConnected);
      }
    };
  }, [room]);

  return null;
}

export default function LiveKitShell({ token, roomName, onDisconnected, onError }: LiveKitShellProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
      connect={true}
      // Don't auto-enable on connect to avoid permission errors
      // We'll enable after connection in EnableMediaTracks component
      style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
      onDisconnected={onDisconnected}
      onError={(error) => {
        // Filter out camera permission errors - these are expected when
        // camera/mic aren't auto-enabled. User can enable them via controls.
        const isCameraPermissionError = 
          error.message?.includes('NotReadableError') || 
          error.message?.includes('video source') ||
          error.message?.includes('Could not start video source') ||
          error.name === 'NotReadableError';
        
        if (isCameraPermissionError) {
          console.warn('Camera/microphone permission issue - user can enable via VideoConference controls');
          // Don't show this as a critical error to the user
          return;
        }
        
        // Show other errors (connection issues, etc.)
        console.error('LiveKit error in doctor room:', error);
        onError(error);
      }}
    >
      <EnableMediaTracks />
      <VideoConference />
    </LiveKitRoom>
  );
}


