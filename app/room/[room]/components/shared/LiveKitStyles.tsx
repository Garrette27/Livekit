'use client';

import React from 'react';
import { RoomControlsPolicy } from './room-controls-policy';
import { resolveGridColumns, resolveMobileGridColumns } from './participant-grid-policy';
import { RoomGridPolicy } from './room-grid-policy';

interface LiveKitStylesProps {
  controlBarColor?: 'blue' | 'default';
  controlsPolicy?: RoomControlsPolicy;
  chatEnabled?: boolean;
  gridPolicy?: RoomGridPolicy;
  participantCount?: number;
}

const DEFAULT_CONTROLS_POLICY: RoomControlsPolicy = {
  hideLeaveControl: true,
  hideStartVideoControl: true,
  hideSettingsControl: true,
};

const DEFAULT_GRID_POLICY: RoomGridPolicy = {
  enabled: true,
  maxParticipants: 40,
  mobileMaxColumns: 2,
};

export default function LiveKitStyles({
  controlBarColor = 'blue',
  controlsPolicy = DEFAULT_CONTROLS_POLICY,
  chatEnabled = true,
  gridPolicy = DEFAULT_GRID_POLICY,
  participantCount = 1,
}: LiveKitStylesProps) {
  const gridColumns = resolveGridColumns(participantCount, gridPolicy);
  const mobileGridColumns = resolveMobileGridColumns(gridColumns || 1, gridPolicy);

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
      .lk-control-bar .lk-disconnect-button,
      .lk-control-bar button[aria-label*='leave' i],
      .lk-control-bar button[title*='leave' i],
      .lk-control-bar [data-lk-kind='leave'] {
        display: none !important;
      }
    `
    : '';

  const hideStartVideoControlStyles = controlsPolicy.hideStartVideoControl
    ? `
      .lk-control-bar .lk-start-audio-button,
      .lk-control-bar .lk-start-video-button {
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

  const participantGridStyles = gridPolicy.enabled
    ? `
      .lk-grid-layout {
        display: grid !important;
        grid-template-columns: repeat(${gridColumns}, minmax(0, 1fr)) !important;
        grid-auto-rows: minmax(0, 1fr) !important;
      }

      .lk-grid-layout > * {
        min-width: 0 !important;
        min-height: 0 !important;
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
      ${participantGridStyles}

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

      .lk-participant-tile .lk-participant-name,
      .lk-participant-tile .lk-participant-metadata,
      .lk-participant-tile .lk-participant-placeholder {
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

      .lk-chat {
        position: fixed !important;
        right: 16px !important;
        bottom: 86px !important;
        top: auto !important;
        width: min(360px, calc(100vw - 24px)) !important;
        max-height: min(60vh, 520px) !important;
        background-color: #ffffff !important;
        color: #111827 !important;
        border: 1px solid #d1d5db !important;
        border-radius: 12px !important;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25) !important;
      }

      .lk-chat-header {
        color: #111827 !important;
        border-bottom: 1px solid #e5e7eb !important;
      }

      .lk-chat-messages {
        background-color: #ffffff !important;
      }

      .lk-chat-entry .lk-message-body {
        color: #111827 !important;
      }

      .lk-chat-entry .lk-participant-name,
      .lk-chat-entry .lk-message-sender,
      .lk-chat-entry .lk-message-header {
        display: block !important;
        font-size: 0.7rem !important;
        font-weight: 600 !important;
        color: #475569 !important;
      }

      .lk-chat-entry[data-lk-message-origin='local'] .lk-message-body {
        background-color: #e5e7eb !important;
      }

      .lk-chat-entry[data-lk-message-origin='remote'] .lk-message-body {
        background-color: #dbeafe !important;
      }

      .lk-chat-form {
        border-top: 1px solid #e5e7eb !important;
        background-color: #ffffff !important;
      }

      .lk-chat-form-input {
        background-color: #ffffff !important;
        color: #111827 !important;
        border: 1px solid #d1d5db !important;
      }

      .lk-chat-form-input::placeholder {
        color: #6b7280 !important;
      }

      @media (max-width: 768px) {
        .lk-grid-layout,
        .lk-focus-layout {
          padding-bottom: 84px !important;
        }

        .lk-grid-layout {
          grid-template-columns: repeat(${mobileGridColumns}, minmax(0, 1fr)) !important;
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

        .lk-chat {
          right: 8px !important;
          bottom: 76px !important;
          width: min(360px, calc(100vw - 16px)) !important;
          max-height: min(58vh, 420px) !important;
        }
      }
    `}</style>
  );
}
