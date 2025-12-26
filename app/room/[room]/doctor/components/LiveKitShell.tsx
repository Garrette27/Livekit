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

      {/* Doctor room video styling - copied from patient room for consistency */}
      <style jsx global>{`
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

        /* Hide participant name/identifier text under video tiles */
        .lk-participant-name,
        .lk-participant-metadata,
        .lk-participant-tile .lk-participant-name,
        .lk-participant-tile .lk-participant-metadata,
        [class*="participant-name"],
        [class*="participant-metadata"],
        [class*="participant-identity"],
        [data-lk="participant-name"],
        [data-lk="participant-metadata"],
        [data-lk="participant-identity"],
        .lk-participant-placeholder,
        .lk-participant-label,
        .lk-participant-tile [class*="name"]:not([class*="video"]):not([class*="track"]),
        .lk-participant-tile [class*="metadata"]:not([class*="video"]):not([class*="track"]),
        .lk-participant-tile [class*="identity"]:not([class*="video"]):not([class*="track"]),
        .lk-grid-item [class*="name"]:not([class*="video"]):not([class*="track"]),
        .lk-grid-item [class*="metadata"]:not([class*="video"]):not([class*="track"]),
        .lk-grid-item [class*="identity"]:not([class*="video"]):not([class*="track"]),
        /* Hide text spans/divs that contain participant identifiers */
        .lk-participant-tile span[class*="patient"],
        .lk-participant-tile span[class*="doctor"],
        .lk-participant-tile div[class*="patient"],
        .lk-participant-tile div[class*="doctor"],
        .lk-grid-item span[class*="patient"],
        .lk-grid-item span[class*="doctor"],
        .lk-grid-item div[class*="patient"],
        .lk-grid-item div[class*="doctor"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          font-size: 0 !important;
          line-height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        /* Hide any overlay text on video tiles */
        .lk-participant-tile::after,
        .lk-grid-item::after {
          content: none !important;
          display: none !important;
        }

        /* Hide empty/loading video tiles to prevent ghost flickering */
        .lk-participant-tile:empty,
        .lk-grid-item:empty,
        .lk-participant-tile[data-lk-participant-state="connecting"],
        .lk-participant-tile[data-lk-participant-state="disconnected"],
        .lk-participant-tile[aria-label*="connecting"],
        .lk-participant-tile[aria-label*="disconnected"],
        /* Hide tiles without video tracks */
        .lk-participant-tile:not(:has(video)),
        .lk-grid-item:not(:has(video)),
        /* Hide placeholder/loading states */
        .lk-participant-placeholder,
        .lk-participant-tile[class*="placeholder"],
        .lk-grid-item[class*="placeholder"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
        }

        /* Ensure video tiles are properly sized and positioned */
        .lk-participant-tile,
        .lk-grid-item,
        .lk-focus-layout .lk-participant-tile,
        .lk-grid-layout .lk-participant-tile {
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
        }

        /* Ensure video container takes full available space */
        .lk-video-conference .lk-participant-tile,
        .lk-video-conference .lk-grid-item {
          width: 100% !important;
          height: 100% !important;
        }

        /* Force horizontal split layout for 2 participants (prevent vertical switching) */
        .lk-grid-layout[data-participants="2"],
        .lk-focus-layout[data-participants="2"] {
          display: flex !important;
          flex-direction: row !important;
        }

        .lk-grid-layout[data-participants="2"] .lk-participant-tile,
        .lk-focus-layout[data-participants="2"] .lk-participant-tile {
          width: 50% !important;
          height: 100% !important;
          flex: 1 1 50% !important;
        }

        /* Ensure layout container uses full height */
        .lk-grid-layout,
        .lk-focus-layout {
          height: 100% !important;
          width: 100% !important;
        }
      `}</style>
    </>
  );
}


