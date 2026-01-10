'use client';

import React, { useEffect } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import LiveKitStyles from '../../components/shared/LiveKitStyles';

interface LiveKitShellProps {
  token: string;
  roomName: string;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

export default function LiveKitShell({ token, roomName, onDisconnected, onError }: LiveKitShellProps) {
  // Fix chat button on mobile - ensure it's clickable and works
  useEffect(() => {
    if (!token) return;

    const handledButtons = new WeakSet<HTMLElement>();

    const fixChatButton = () => {
      const chatButtonSelectors = [
        'button[aria-label*="chat"]',
        'button[aria-label*="Chat"]',
        '[data-lk-kind="chat"]',
        '[data-lk-kind="toggle-chat"]',
        'button[class*="chat"]',
        '[data-lk="chat-toggle"]',
        'button[title*="chat"]',
        'button[title*="Chat"]'
      ];

      chatButtonSelectors.forEach(selector => {
        try {
          const buttons = document.querySelectorAll(selector);
          buttons.forEach(button => {
            const btn = button as HTMLElement;
            
            // Skip if already handled
            if (handledButtons.has(btn)) return;
            
            // Ensure button is clickable
            btn.style.pointerEvents = 'auto';
            btn.style.touchAction = 'manipulation';
            btn.style.cursor = 'pointer';
            btn.style.setProperty('-webkit-tap-highlight-color', 'rgba(37, 99, 235, 0.3)');
            
            // Add explicit touch event handlers (don't clone to preserve LiveKit handlers)
            const handleTouchEnd = (e: TouchEvent) => {
              e.stopPropagation();
              // Trigger click immediately - LiveKit will handle the toggle
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1
              });
              btn.dispatchEvent(clickEvent);
            };
            
            btn.addEventListener('touchend', handleTouchEnd, { passive: false });
            handledButtons.add(btn);
          });
        } catch (e) {
          // Silently fail for invalid selectors
        }
      });
    };

    fixChatButton();
    
    // Watch for chat buttons being added dynamically
    const observer = new MutationObserver(fixChatButton);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label', 'title', 'data-lk-kind']
    });

    // Also check periodically
    const interval = setInterval(fixChatButton, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [token]);

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
