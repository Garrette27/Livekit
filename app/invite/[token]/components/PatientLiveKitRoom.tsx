'use client';

import RoomShell from '../../../room/[room]/components/shared/RoomShell';
import { PATIENT_ROOM_CONTROLS } from '../../../room/[room]/components/shared/room-controls-policy';
import { PATIENT_ROOM_CHAT } from '../../../room/[room]/components/shared/room-chat-policy';

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
  onLeaveClick,
}: PatientLiveKitRoomProps) {
  return (
    <>
      <RoomShell
        token={token}
        onDisconnected={onDisconnected}
        onError={(error) => {
          const isCameraPermissionError =
            error.message?.includes('NotReadableError') ||
            error.message?.includes('video source') ||
            error.message?.includes('Could not start video source') ||
            error.name === 'NotReadableError';

          if (isCameraPermissionError) {
            console.error('Camera/video track error in patient room:', {
              error: error.message || error,
              name: error.name,
              stack: error.stack,
              suggestion:
                'Check browser permissions and ensure camera is not in use by another application.',
            });
            return;
          }

          console.error('LiveKit error in patient room:', error);
          onError(error);
        }}
        controlBarColor="blue"
        controlsPolicy={PATIENT_ROOM_CONTROLS}
        chatPolicy={PATIENT_ROOM_CHAT}
      />

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
            zIndex: 10060,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
              cursor: 'pointer',
            }}
          >
            {'<- Leave Consultation'}
          </button>
        </div>
      )}
    </>
  );
}
