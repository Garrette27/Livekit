'use client';

import React from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import LiveKitStyles from '../../components/shared/LiveKitStyles';

interface LiveKitShellProps {
  token: string;
  roomName: string;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

export default function LiveKitShell({ token, roomName, onDisconnected, onError }: LiveKitShellProps) {
  return (
    <>
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        audio
        video
        style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
        onDisconnected={onDisconnected}
        onError={(error) => {
          // Log all camera/video errors for debugging - don't suppress them
          const isCameraPermissionError = 
            error.message?.includes('NotReadableError') || 
            error.message?.includes('video source') ||
            error.message?.includes('Could not start video source') ||
            error.name === 'NotReadableError';
          
          if (isCameraPermissionError) {
            console.error('⚠️ Camera/video track error in doctor room:', {
              error: error.message || error,
              name: error.name,
              stack: error.stack,
              suggestion: 'Check browser permissions and ensure camera is not in use by another application'
            });
            // Don't call onError for permission issues - user can enable manually via controls
            // But log it so we can debug video track publishing failures
            return;
          }
          
          // Show other errors (connection issues, etc.)
          console.error('LiveKit error in doctor room:', error);
          onError(error);
        }}
      >
        <VideoConference />
      </LiveKitRoom>

      {/* Shared LiveKit styles with blue control bar - all styles are now modular */}
      <LiveKitStyles controlBarColor="blue" />
    </>
  );
}
