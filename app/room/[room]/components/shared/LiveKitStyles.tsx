'use client';

import React from 'react';

interface LiveKitStylesProps {
  controlBarColor?: 'blue' | 'default';
}

/**
 * Shared LiveKit styles component for consistent video conferencing UI
 * Use this in both patient and doctor room components
 */
export default function LiveKitStyles({ controlBarColor = 'blue' }: LiveKitStylesProps) {
  const controlBarStyles = controlBarColor === 'blue' ? `
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
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      /* Mobile-specific fixes for control bar visibility */
      @media (max-width: 768px) {
        .lk-control-bar {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: auto !important;
          max-width: 95vw !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
          flex-wrap: nowrap !important;
          gap: 0.25rem !important;
          padding: 0.75rem !important;
          bottom: 10px !important;
        }
        
        .lk-control-bar button {
          flex-shrink: 0 !important;
          min-width: 44px !important;
          padding: 0.5rem !important;
          font-size: 0.75rem !important;
        }
        
        /* Ensure microphone and camera controls are always visible on mobile */
        .lk-control-bar button[aria-label*="microphone"],
        .lk-control-bar button[aria-label*="Microphone"],
        .lk-control-bar button[aria-label*="camera"],
        .lk-control-bar button[aria-label*="Camera"],
        .lk-control-bar [data-lk-kind="toggle-mic"],
        .lk-control-bar [data-lk-kind="toggle-camera"],
        .lk-control-bar [data-lk-kind="toggle-video"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: auto !important;
          height: auto !important;
          min-width: 44px !important;
          min-height: 44px !important;
        }
      }
  ` : '';

  return (
    <style jsx global>{`
      ${controlBarStyles}

      /* Video Conference Container */
      .lk-video-conference {
        width: 100vw !important;
        height: 100vh !important;
        position: relative !important;
      }

      /* Participant Video */
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
      .lk-participant-tile:not(:has(video)),
      .lk-grid-item:not(:has(video)),
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

      /* Video tiles sizing and positioning */
      .lk-participant-tile,
      .lk-grid-item,
      .lk-focus-layout .lk-participant-tile,
      .lk-grid-layout .lk-participant-tile {
        width: 100% !important;
        height: 100% !important;
        min-width: 100% !important;
        min-height: 100% !important;
      }

      /* Video container spacing */
      .lk-video-conference .lk-participant-tile,
      .lk-video-conference .lk-grid-item {
        width: 100% !important;
        height: 100% !important;
      }

      /* Force horizontal split layout for 2 participants */
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

      /* Layout containers */
      .lk-grid-layout,
      .lk-focus-layout {
        height: 100% !important;
        width: 100% !important;
      }

      /* Hide Leave button in LiveKit control bar - redundant since:
         - Doctor room has "Leave Call" in Doctor Session Control panel
         - Patient room has "Leave Consultation" button in top left */
      .lk-control-bar button[aria-label*="leave"],
      .lk-control-bar button[aria-label*="Leave"],
      .lk-control-bar [data-lk-kind="leave"],
      .lk-control-bar [data-lk-kind="Leave"],
      button[aria-label*="leave"][class*="lk-"],
      button[aria-label*="Leave"][class*="lk-"],
      .lk-control-bar button[title*="Leave"],
      .lk-control-bar button[title*="leave"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        width: 0 !important;
        height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
      }

      /* Hide Start Video button - video starts automatically, user can toggle via Camera button */
      .lk-control-bar button[aria-label*="Start Video"],
      .lk-control-bar button[aria-label*="start video"],
      .lk-control-bar button[aria-label*="Start video"],
      .lk-control-bar [data-lk-kind="toggle-video"],
      button[aria-label*="Start Video"][class*="lk-"],
      button[aria-label*="start video"][class*="lk-"],
      .lk-control-bar button[title*="Start Video"],
      .lk-control-bar button[title*="start video"],
      .lk-control-bar button:has(svg[class*="play"]):not([aria-label*="screen"]),
      .lk-control-bar button[class*="start-video"],
      .lk-control-bar button[class*="StartVideo"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        width: 0 !important;
        height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
      }

      /* Chat panel styling */
      .lk-chat-panel,
      [class*="chat-panel"],
      [class*="ChatPanel"],
      [data-lk="chat-panel"],
      .lk-chat,
      [class*="lk-chat"],
      div[role="dialog"][class*="chat"],
      aside[class*="chat"],
      section[class*="chat"] {
        background-color: #ffffff !important;
        background: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 12px !important;
      }

      /* Hide chat header/title and close button - users control chat via control bar only */
      .lk-chat-header,
      [class*="chat-header"],
      [class*="ChatHeader"],
      .lk-chat-title,
      [class*="chat-title"],
      .lk-chat-close,
      [class*="chat-close"],
      [class*="ChatClose"],
      button[aria-label*="close"][class*="chat"],
      button[aria-label*="Close"][class*="chat"],
      .lk-chat-header *,
      [class*="chat-header"] *,
      [class*="ChatHeader"] *,
      /* Hide any header elements that might contain title or close button */
      .lk-chat > header,
      [class*="chat-panel"] > header,
      [class*="ChatPanel"] > header,
      .lk-chat [role="heading"],
      [class*="chat-panel"] [role="heading"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 0 !important;
        line-height: 0 !important;
      }

      .lk-chat-container,
      .lk-chat-wrapper,
      .lk-chat-entry {
        background-color: #ffffff !important;
        background: #ffffff !important;
        color: #000000 !important;
      }

      .lk-chat-message,
      [class*="chat-message"],
      [class*="message"],
      [class*="Message"],
      .lk-message {
        background-color: #f8f9fa !important;
        color: #000000 !important;
        border: 1px solid #e9ecef !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        margin: 4px 0 !important;
      }

      .lk-chat-message p,
      .lk-chat-message span,
      .lk-chat-message div,
      .lk-chat-message *,
      [class*="chat-message"] p,
      [class*="chat-message"] span,
      [class*="chat-message"] div,
      [class*="chat-message"] *,
      [class*="message"] p,
      [class*="message"] span,
      [class*="message"] div,
      [class*="message"] * {
        color: #000000 !important;
      }

      .lk-chat-input,
      [class*="chat-input"],
      [class*="ChatInput"],
      input[type="text"][class*="chat"],
      textarea[class*="chat"] {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #ced4da !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
      }

      .lk-chat-input::placeholder,
      [class*="chat-input"]::placeholder,
      input[class*="chat"]::placeholder {
        color: #6c757d !important;
      }

      .lk-chat *,
      [class*="chat"] *,
      [class*="Chat"] *,
      [data-lk="chat"] * {
        color: #000000 !important;
      }

      [data-theme="dark"] .lk-chat,
      [data-theme="dark"] .lk-chat-message,
      [data-theme="dark"] .lk-chat-panel,
      [class*="dark"] [class*="chat"],
      [class*="dark"] [class*="Chat"] {
        background-color: #ffffff !important;
        color: #000000 !important;
      }

      div[class*="chat"] div,
      div[class*="Chat"] div,
      .lk-chat div,
      .lk-chat-panel div {
        background-color: #ffffff !important;
        background: #ffffff !important;
      }

      .lk-chat [class*="scroll"],
      .lk-chat-panel [class*="scroll"],
      [class*="chat"] [class*="scroll"] {
        background-color: #ffffff !important;
      }

      [class*="lk-chat"],
      [class*="Chat"],
      [id*="chat"],
      [id*="Chat"],
      [data-lk*="chat"],
      [data-lk*="Chat"],
      [role="dialog"][class*="chat"],
      [role="dialog"][class*="Chat"],
      aside[class*="chat"],
      aside[class*="Chat"],
      nav[class*="chat"],
      nav[class*="Chat"] {
        background-color: #ffffff !important;
        background: #ffffff !important;
        background-image: none !important;
      }

      [class*="chat"] *,
      [class*="Chat"] *,
      [id*="chat"] *,
      [id*="Chat"] * {
        background-color: #ffffff !important;
        background: #ffffff !important;
      }

      * {
        --lk-chat-bg: #ffffff !important;
        --chat-background: #ffffff !important;
      }
    `}</style>
  );
}

