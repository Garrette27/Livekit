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
// Fix chat button and screen share on mobile - ensure they're clickable and work
  useEffect(() => {
    if (!token) return;

    const handledButtons = new WeakSet<HTMLElement>();
    let chatPanelVisible = false;

    const fixChatButton = () => {
      // Enhanced chat button selectors for better detection
      const chatButtonSelectors = [
        'button[aria-label*="chat"]',
        'button[aria-label*="Chat"]',
        '[data-lk-kind="chat"]',
        '[data-lk-kind="toggle-chat"]',
        'button[class*="chat"]',
        '[data-lk="chat-toggle"]',
        'button[title*="chat"]',
        'button[title*="Chat"]',
        // More specific LiveKit selectors
        '.lk-button[data-lk-kind="chat"]',
        '.lk-button[data-lk-kind="toggle-chat"]',
        'button.lk-button[aria-label*="chat"]',
        'button.lk-button[aria-label*="Chat"]',
        // Additional selectors for LiveKit components
        '.lk-control-bar button[data-lk-kind="chat"]',
        '.lk-control-bar button[data-lk-kind="toggle-chat"]',
        'div.lk-control-bar button[aria-label*="chat"]',
        'div.lk-control-bar button[aria-label*="Chat"]',
        // Icon-based detection
        'button svg[class*="chat"]',
        'button svg[class*="message"]',
        'button[aria-label*="message"]',
        'button[aria-label*="Message"]'
      ];

      // Enhanced screen share button selectors for better detection
      const screenShareButtonSelectors = [
        'button[aria-label*="share"]',
        'button[aria-label*="Share"]',
        'button[aria-label*="screen"]',
        'button[aria-label*="Screen"]',
        '[data-lk-kind="toggle-screen-share"]',
        '[data-lk-kind="share-screen"]',
        '[data-lk-kind="screen-share"]',
        'button[data-lk-kind="screen-share"]',
        '.lk-button[data-lk-kind="screen-share"]',
        '.lk-button[data-lk-kind="toggle-screen-share"]',
        'button.lk-button[aria-label*="share"]',
        'button.lk-button[aria-label*="Share"]',
        'button.lk-button[aria-label*="screen"]',
        'button.lk-button[aria-label*="Screen"]',
        'button[title*="share"]',
        'button[title*="Share"]',
        'button[title*="screen"]',
        'button[title*="Screen"]',
        // Icon-based detection
        'button svg[class*="share"]',
        'button svg[class*="screen"]',
        'button[aria-label*="presentation"]',
        'button[aria-label*="Presentation"]'
      ];

      // Handle both chat and screen share buttons
      const allButtonSelectors = [...chatButtonSelectors, ...screenShareButtonSelectors];
      
      allButtonSelectors.forEach(selector => {
        try {
          const buttons = document.querySelectorAll(selector);
          buttons.forEach(button => {
            const btn = button as HTMLElement;
            
            // Skip if already handled
            if (handledButtons.has(btn)) return;
            
            // Ensure button is visible and clickable
            btn.style.pointerEvents = 'auto';
            btn.style.touchAction = 'manipulation';
            btn.style.cursor = 'pointer';
            btn.style.setProperty('-webkit-tap-highlight-color', 'rgba(37, 99, 235, 0.3)');
            btn.style.setProperty('user-select', 'none');
            
            // Remove any existing touch handlers to avoid duplicates
            const originalOnTouchEnd = (btn as any).__originalOnTouchEnd;
            if (originalOnTouchEnd) {
              btn.removeEventListener('touchend', originalOnTouchEnd);
              btn.removeEventListener('click', originalOnTouchEnd);
            }
            
            // Determine if this is a chat or screen share button
            const isChatButton = chatButtonSelectors.some(selector => {
              try {
                return btn.matches(selector) || btn.closest(selector);
              } catch (e) {
                return false;
              }
            });
            
            const isScreenShareButton = screenShareButtonSelectors.some(selector => {
              try {
                return btn.matches(selector) || btn.closest(selector);
              } catch (e) {
                return false;
              }
            });
            
            // Enhanced touch event handlers with better detection
            const handleTouchStart = (e: TouchEvent) => {
              e.stopPropagation();
              btn.style.backgroundColor = 'rgba(37, 99, 235, 0.2)';
            };
            
            const handleTouchEnd = (e: TouchEvent) => {
              e.stopPropagation();
              e.preventDefault();
              btn.style.backgroundColor = '';
              
              // Method 1: Direct click simulation
              try {
                btn.click();
              } catch (e) {
                // Continue to next method
              }
              
              // Method 2: Dispatch synthetic click event
              try {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  detail: 1,
                  buttons: 1
                });
                btn.dispatchEvent(clickEvent);
              } catch (e) {
                // Continue to next method
              }
              
              // Method 3: Enhanced functionality based on button type
              setTimeout(() => {
                if (isChatButton) {
                  // Enhanced chat panel detection and toggle
                  const chatPanelSelectors = [
                    '.lk-chat-panel',
                    '[class*="chat-panel"]',
                    '[class*="ChatPanel"]',
                    '[data-lk="chat-panel"]',
                    '.lk-chat',
                    '[class*="lk-chat"]',
                    'div[role="dialog"][class*="chat"]',
                    'aside[class*="chat"]',
                    'section[class*="chat"]',
                    '.lk-chat-container',
                    '[class*="chat-container"]'
                  ];
                  
                  let chatPanel: HTMLElement | null = null;
                  for (const selector of chatPanelSelectors) {
                    chatPanel = document.querySelector(selector) as HTMLElement;
                    if (chatPanel) break;
                  }
                  
                  if (chatPanel) {
                    // Check current visibility state
                    const computedStyle = window.getComputedStyle(chatPanel);
                    const isVisible = computedStyle.display !== 'none' && 
                                     computedStyle.visibility !== 'hidden' && 
                                     computedStyle.opacity !== '0';
                    
                    if (!isVisible || !chatPanelVisible) {
                      // Show chat panel
                      chatPanel.style.display = 'block';
                      chatPanel.style.visibility = 'visible';
                      chatPanel.style.opacity = '1';
                      chatPanel.removeAttribute('aria-hidden');
                      chatPanel.style.setProperty('transform', 'translateY(0)', 'important');
                      chatPanel.style.setProperty('position', 'fixed', 'important');
                      chatPanel.style.setProperty('z-index', '1000', 'important');
                      chatPanelVisible = true;
                      
                      // Also try to trigger LiveKit's internal chat state
                      const chatEvent = new CustomEvent('lk-chat-show', { bubbles: true });
                      document.dispatchEvent(chatEvent);
                    } else {
                      // Hide chat panel
                      chatPanel.style.display = 'none';
                      chatPanel.style.visibility = 'hidden';
                      chatPanel.style.opacity = '0';
                      chatPanel.setAttribute('aria-hidden', 'true');
                      chatPanel.style.setProperty('transform', 'translateY(100%)', 'important');
                      chatPanelVisible = false;
                      
                      // Also try to trigger LiveKit's internal chat state
                      const chatEvent = new CustomEvent('lk-chat-hide', { bubbles: true });
                      document.dispatchEvent(chatEvent);
                    }
                  }
                } else if (isScreenShareButton) {
                  // Enhanced screen share functionality
                  console.log('Screen share button clicked - ensuring proper functionality');
                  
                  // Try to trigger LiveKit's native screen share
                  const screenShareEvent = new CustomEvent('lk-screen-share-toggle', { bubbles: true });
                  document.dispatchEvent(screenShareEvent);
                  
                  // Also try to find and trigger any screen share related elements
                  const screenShareElements = document.querySelectorAll([
                    '[data-lk-kind="screen-share"]',
                    '[data-lk-kind="toggle-screen-share"]',
                    '.lk-screen-share-button',
                    '[class*="screen-share"]'
                  ].join(', '));
                  
                  screenShareElements.forEach(element => {
                    try {
                      (element as HTMLElement).click();
                    } catch (e) {
                      // Continue
                    }
                  });
                }
              }, 100);
            };
            
            // Add both touch and click handlers for maximum compatibility
            btn.addEventListener('touchstart', handleTouchStart, { passive: true });
            btn.addEventListener('touchend', handleTouchEnd, { passive: false });
            
            // Create a separate click handler for proper typing
            const handleClick = (e: Event) => {
              e.stopPropagation();
              e.preventDefault();
              handleTouchEnd(e as any);
            };
            btn.addEventListener('click', handleClick, { passive: false });
            
            (btn as any).__originalOnTouchEnd = handleTouchEnd;
            handledButtons.add(btn);
          });
        } catch (e) {
          // Silently fail for invalid selectors
        }
      });
    };

    // Initial fix
    setTimeout(fixChatButton, 500);
    
    // Watch for chat buttons being added dynamically
    const observer = new MutationObserver(() => {
      setTimeout(fixChatButton, 100);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label', 'title', 'data-lk-kind', 'style']
    });

    // Check periodically with longer interval
    const interval = setInterval(fixChatButton, 1000);

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
