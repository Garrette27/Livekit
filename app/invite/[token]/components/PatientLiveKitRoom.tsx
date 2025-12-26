'use client';

import React from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';

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

      {/* Patient-specific LiveKit styling - ensures chat is visible */}
      <style jsx global>{`
        /* Force ALL LiveKit controls to be blue */
        .lk-control-bar button,
        .lk-control-bar [data-lk-kind],
        .lk-button,
        .lk-button-group button,
        .lk-focus-toggle,
        .lk-device-menu,
        .lk-device-menu button,
        .lk-device-menu-item,
        .lk-device-menu-item button,
        [class*="lk-"] button,
        button[class*="lk-"],
        button[aria-label*="microphone"],
        button[aria-label*="camera"],
        button[aria-label*="chat"],
        button[aria-label*="leave"],
        button[aria-label*="share"] {
          background-color: #2563eb !important;
          color: white !important;
          border-color: #1d4ed8 !important;
          border-radius: 0.75rem !important;
          padding: 0.75rem 1rem !important;
          font-weight: 600 !important;
          min-width: 80px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.5rem !important;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2) !important;
          z-index: 1000 !important;
          position: relative !important;
        }
        
        /* Force ALL LiveKit icons to be white */
        .lk-control-bar svg,
        .lk-button svg,
        [class*="lk-"] svg,
        button[aria-label*="microphone"] svg,
        button[aria-label*="camera"] svg,
        button[aria-label*="chat"] svg,
        button[aria-label*="leave"] svg,
        button[aria-label*="share"] svg {
          color: white !important;
          fill: white !important;
          stroke: white !important;
        }
        
        /* Force ALL LiveKit text to be white */
        .lk-control-bar span,
        .lk-button span,
        [class*="lk-"] span,
        button[aria-label*="microphone"] span,
        button[aria-label*="camera"] span,
        button[aria-label*="chat"] span,
        button[aria-label*="leave"] span,
        button[aria-label*="share"] span {
          color: white !important;
          font-weight: 600 !important;
        }
        
        /* Ensure control bar is visible */
        .lk-control-bar {
          position: fixed !important;
          bottom: 20px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 1000 !important;
          background-color: rgba(0, 0, 0, 0.8) !important;
          border-radius: 1rem !important;
          padding: 1rem !important;
          display: flex !important;
          gap: 0.5rem !important;
          align-items: center !important;
        }
        
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

        /* CRITICAL: Fix chat panel background - make it white/light with dark text */
        .lk-chat-panel,
        [class*="chat-panel"],
        [class*="ChatPanel"],
        [data-lk="chat-panel"],
        .lk-chat,
        [class*="lk-chat"],
        .lk-chat-container,
        [class*="chat-container"] {
          background-color: #ffffff !important;
          color: #1f2937 !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.75rem !important;
        }

        /* Chat messages container - ensure readable text */
        .lk-chat-messages,
        [class*="chat-messages"],
        [class*="ChatMessages"],
        .lk-message-list,
        [class*="message-list"] {
          background-color: #ffffff !important;
          color: #1f2937 !important;
        }

        /* Individual chat messages */
        .lk-chat-message,
        [class*="chat-message"],
        [class*="ChatMessage"],
        .lk-message,
        [class*="message"] {
          background-color: #f9fafb !important;
          color: #1f2937 !important;
          border: 1px solid #e5e7eb !important;
          padding: 0.75rem !important;
          margin-bottom: 0.5rem !important;
          border-radius: 0.5rem !important;
        }

        /* Chat message text */
        .lk-chat-message p,
        .lk-chat-message span,
        .lk-message p,
        .lk-message span,
        [class*="chat-message"] p,
        [class*="chat-message"] span {
          color: #1f2937 !important;
        }

        /* Chat input field */
        .lk-chat-input,
        [class*="chat-input"],
        [class*="ChatInput"],
        .lk-message-input,
        [class*="message-input"],
        input[placeholder*="message"],
        input[placeholder*="Message"] {
          background-color: #ffffff !important;
          color: #1f2937 !important;
          border: 2px solid #e5e7eb !important;
          border-radius: 0.5rem !important;
          padding: 0.75rem !important;
        }

        /* Chat input placeholder */
        .lk-chat-input::placeholder,
        input[placeholder*="message"]::placeholder,
        input[placeholder*="Message"]::placeholder {
          color: #9ca3af !important;
        }

        /* Chat send button */
        .lk-chat-send,
        [class*="chat-send"],
        [class*="ChatSend"],
        button[aria-label*="send"],
        button[aria-label*="Send"] {
          background-color: #2563eb !important;
          color: white !important;
          border: none !important;
          border-radius: 0.5rem !important;
          padding: 0.75rem 1rem !important;
        }

        /* Chat header/title */
        .lk-chat-header,
        [class*="chat-header"],
        [class*="ChatHeader"],
        .lk-chat-title,
        [class*="chat-title"] {
          background-color: #f9fafb !important;
          color: #1f2937 !important;
          border-bottom: 1px solid #e5e7eb !important;
          padding: 1rem !important;
          font-weight: 600 !important;
        }

        /* Chat close button */
        .lk-chat-close,
        [class*="chat-close"],
        button[aria-label*="close"][class*="chat"],
        button[aria-label*="Close"][class*="chat"] {
          background-color: transparent !important;
          color: #1f2937 !important;
          border: none !important;
        }

        /* Ensure all text in chat is readable */
        .lk-chat *,
        [class*="lk-chat"] *,
        [class*="chat-panel"] * {
          color: #1f2937 !important;
        }

        /* Override any dark backgrounds in chat */
        .lk-chat *[style*="background-color: rgb(0, 0, 0)"],
        .lk-chat *[style*="background-color:#000"],
        .lk-chat *[style*="background-color: black"],
        [class*="chat-panel"] *[style*="background-color: rgb(0, 0, 0)"],
        [class*="chat-panel"] *[style*="background-color:#000"],
        [class*="chat-panel"] *[style*="background-color: black"] {
          background-color: #ffffff !important;
        }

        /* Chat timestamp */
        .lk-chat-timestamp,
        [class*="chat-timestamp"],
        [class*="timestamp"] {
          color: #6b7280 !important;
          font-size: 0.75rem !important;
        }

        /* Chat sender name */
        .lk-chat-sender,
        [class*="chat-sender"],
        [class*="sender"] {
          color: #2563eb !important;
          font-weight: 600 !important;
        }
      `}</style>
    </>
  );
}

