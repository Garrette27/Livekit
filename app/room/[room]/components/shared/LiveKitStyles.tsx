'use client';

import React from 'react';
import { RoomControlsPolicy } from './room-controls-policy';

interface LiveKitStylesProps {
  controlBarColor?: 'blue' | 'default';
  controlsPolicy?: RoomControlsPolicy;
  chatEnabled?: boolean;
}

const DEFAULT_CONTROLS_POLICY: RoomControlsPolicy = {
  hideLeaveControl: true,
  hideStartVideoControl: true,
  hideSettingsControl: true,
};

export default function LiveKitStyles({
  controlBarColor = 'blue',
  controlsPolicy = DEFAULT_CONTROLS_POLICY,
  chatEnabled = true,
}: LiveKitStylesProps) {
  const controlButtonStyles =
    controlBarColor === 'blue'
      ? `
        .lk-control-bar button,
        .lk-control-bar [data-lk-kind],
        .lk-control-bar .lk-button {
          background-color: #2563eb !important;
          color: #ffffff !important;
          border: 1px solid #1d4ed8 !important;
          border-radius: 0.75rem !important;
          min-height: 40px !important;
          min-width: 44px !important;
          padding: 0.5rem 0.75rem !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.375rem !important;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25) !important;
        }

        .lk-control-bar button svg,
        .lk-control-bar [data-lk-kind] svg,
        .lk-control-bar .lk-button svg,
        .lk-control-bar button span,
        .lk-control-bar [data-lk-kind] span,
        .lk-control-bar .lk-button span {
          color: #ffffff !important;
          fill: #ffffff !important;
        }
      `
      : '';

  const hideLeaveControlStyles = controlsPolicy.hideLeaveControl
    ? `
      .lk-control-bar button[aria-label*='leave' i],
      .lk-control-bar button[title*='leave' i],
      .lk-control-bar [data-lk-kind='leave'] {
        display: none !important;
      }
    `
    : '';

  const hideStartVideoControlStyles = controlsPolicy.hideStartVideoControl
    ? `
      .lk-control-bar button[aria-label*='start video' i],
      .lk-control-bar button[title*='start video' i] {
        display: none !important;
      }
    `
    : '';

  const hideSettingsControlStyles = controlsPolicy.hideSettingsControl
    ? `
      .lk-control-bar .lk-settings-toggle,
      .lk-control-bar button[aria-label*='settings' i],
      .lk-control-bar button[title*='settings' i] {
        display: none !important;
      }
    `
    : '';

  const hideChatControlStyles = !chatEnabled
    ? `
      .lk-control-bar .lk-chat-toggle,
      .lk-control-bar button[aria-label*='chat' i],
      .lk-control-bar button[title*='chat' i] {
        display: none !important;
      }

      .lk-chat,
      .lk-chat-panel,
      .lk-chat-container {
        display: none !important;
      }
    `
    : '';

  return (
    <style jsx global>{`
      ${controlButtonStyles}
      ${hideLeaveControlStyles}
      ${hideStartVideoControlStyles}
      ${hideSettingsControlStyles}
      ${hideChatControlStyles}

      .lk-video-conference,
      .lk-stage,
      .lk-grid-layout,
      .lk-focus-layout {
        width: 100vw !important;
        height: 100vh !important;
        background-color: #000000 !important;
      }

      .lk-grid-layout,
      .lk-focus-layout {
        padding-bottom: 92px !important;
      }

      .lk-participant-tile,
      .lk-participant-media,
      .lk-participant-media video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }

      .lk-participant-name,
      .lk-participant-metadata,
      .lk-participant-placeholder {
        display: none !important;
      }

      .lk-control-bar {
        position: fixed !important;
        left: 50% !important;
        bottom: 20px !important;
        transform: translateX(-50%) !important;
        z-index: 10000 !important;
        background: rgba(17, 24, 39, 0.85) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 16px !important;
        padding: 0.5rem !important;
        display: flex !important;
        align-items: center !important;
        gap: 0.5rem !important;
      }

      .lk-chat,
      .lk-chat-panel,
      .lk-chat-container {
        z-index: 10050 !important;
      }

      @media (max-width: 768px) {
        .lk-grid-layout,
        .lk-focus-layout {
          padding-bottom: 84px !important;
        }

        .lk-control-bar {
          width: min(96vw, 720px) !important;
          overflow-x: auto !important;
          gap: 0.375rem !important;
          padding: 0.5rem !important;
          bottom: 10px !important;
        }

        .lk-control-bar button,
        .lk-control-bar [data-lk-kind],
        .lk-control-bar .lk-button {
          flex-shrink: 0 !important;
          min-width: 44px !important;
          min-height: 44px !important;
          padding: 0.5rem !important;
        }
      }
    `}</style>
  );
}
