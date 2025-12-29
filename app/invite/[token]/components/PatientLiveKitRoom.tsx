'use client';

import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import LiveKitStyles from '../../../room/[room]/components/shared/LiveKitStyles';

interface PatientLiveKitRoomProps {
  token: string;
  onDisconnected: () => void;
  onError: (error: Error) => void;
  onLeaveClick?: () => void;
}

export default function PatientLiveKitRoom({ 
  token, 
  onDisconnected, 
  onError,
  onLeaveClick 
}: PatientLiveKitRoomProps) {
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
            console.error('⚠️ Camera/video track error in patient room:', {
              error: error.message || error,
              name: error.name,
              stack: error.stack,
              suggestion: 'Check browser permissions and ensure camera is not in use by another application'
            });
            // Don't call onError for permission issues - user can enable manually via controls
            // But log it so we can debug video track publishing failures
            return;
          }
          
          console.error('LiveKit error in patient room:', error);
          onError(error);
        }}
      >
        <VideoConference />
        
        {/* Leave Consultation Button */}
        {onLeaveClick && (
          <div
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
            <button
              onClick={onLeaveClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#2563eb',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ← Leave Consultation
            </button>
          </div>
        )}
      </LiveKitRoom>

      {/* Shared LiveKit styles with blue control bar - all styles are now modular */}
      <LiveKitStyles controlBarColor="blue" />
    </>
  );
}

