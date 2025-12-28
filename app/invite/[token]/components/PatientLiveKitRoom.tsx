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
          // Filter out camera permission errors - these may occur but user can enable manually
          const isCameraPermissionError = 
            error.message?.includes('NotReadableError') || 
            error.message?.includes('video source') ||
            error.message?.includes('Could not start video source') ||
            error.name === 'NotReadableError';
          
          if (isCameraPermissionError) {
            console.warn('Camera/microphone permission issue - user can enable via VideoConference controls');
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

