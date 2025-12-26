'use client';

import React from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';

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
          // Filter out camera permission errors - these may occur but user can enable manually
          const isCameraPermissionError = 
            error.message?.includes('NotReadableError') || 
            error.message?.includes('video source') ||
            error.message?.includes('Could not start video source') ||
            error.name === 'NotReadableError';
          
          if (isCameraPermissionError) {
            console.warn('Camera/microphone permission issue - user can enable via VideoConference controls');
            // Don't show this as a critical error to the user - they can enable manually
            return;
          }
          
          // Show other errors (connection issues, etc.)
          console.error('LiveKit error in doctor room:', error);
          onError(error);
        }}
      >
        <VideoConference />
      </LiveKitRoom>

      {/* Doctor room video styling - match patient room tile sizes */}
      <style jsx global>{`
        /* Ensure video elements are properly sized */
        .lk-video-conference {
          width: 100vw !important;
          height: 100vh !important;
          position: relative !important;
        }

        /* Ensure participant video tiles are properly sized - match patient room */
        .lk-participant-video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          min-width: 100% !important;
          min-height: 100% !important;
        }

        /* Only hide truly empty tiles - be less aggressive to show all participants */
        .lk-participant-tile:empty,
        .lk-grid-item:empty {
          display: none !important;
        }
        
        /* Ensure all participant tiles are visible (including patient) */
        .lk-participant-tile,
        .lk-grid-item {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* Ensure video tiles are properly sized and positioned - match patient room */
        .lk-participant-tile,
        .lk-grid-item,
        .lk-focus-layout .lk-participant-tile,
        .lk-grid-layout .lk-participant-tile {
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          box-sizing: border-box !important;
        }

        /* Ensure video container takes full available space */
        .lk-video-conference .lk-participant-tile,
        .lk-video-conference .lk-grid-item {
          width: 100% !important;
          height: 100% !important;
          flex: 1 1 auto !important;
        }

        /* Ensure grid and focus layouts properly size tiles */
        .lk-grid-layout,
        .lk-focus-layout {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: row !important;
          box-sizing: border-box !important;
        }

        /* Force horizontal split layout for 2 participants (prevent vertical switching) */
        .lk-grid-layout[data-participants="2"],
        .lk-focus-layout[data-participants="2"],
        .lk-grid-layout[data-lk-layout="grid"][data-participants="2"],
        .lk-focus-layout[data-lk-layout="grid"][data-participants="2"] {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
        }

        /* Fix two-participant layout to ensure equal sizing and horizontal split */
        .lk-focus-layout[data-lk-layout="grid"] .lk-participant-tile,
        .lk-grid-layout[data-participants="2"] .lk-participant-tile,
        .lk-focus-layout[data-participants="2"] .lk-participant-tile,
        /* Ensure all participant tiles in two-participant layout are visible */
        [data-participants="2"] .lk-participant-tile,
        [data-participants="2"] .lk-grid-item {
          width: 50% !important;
          height: 100% !important;
          min-width: 50% !important;
          min-height: 100% !important;
          flex: 1 1 50% !important;
          max-width: 50% !important;
          display: flex !important;
          visibility: visible !important;
        }

        /* Force video tracks to fill their containers */
        .lk-participant-tile video,
        .lk-grid-item video,
        .lk-participant-tile .lk-video-track,
        .lk-grid-item .lk-video-track {
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          object-fit: cover !important;
        }

        /* Ensure participant tile containers fill properly */
        .lk-participant-tile > div,
        .lk-grid-item > div {
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </>
  );
}


