'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import Link from 'next/link';
import { auth, provider, db, storage } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import LiveKitStyles from '../components/shared/LiveKitStyles';

// Client component for the patient room functionality
function PatientRoomClient({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInfoPanelCollapsed, setIsInfoPanelCollapsed] = useState<boolean>(false);
  const [manualNotes, setManualNotes] = useState<Array<{text: string; timestamp: string; attachments?: Array<{url: string; name: string; type: string; size: number}>}>>([]);

  // Check if fix control panel should be shown (when doctor has generated a link)
  const shouldShowFixControlPanel = () => {
    return localStorage.getItem(`doctorGeneratedLink_${roomName}`) === 'true';
  };

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, async (user) => {
        const wasAuthenticated = !!user;
        setUser(user);
        setIsAuthenticated(wasAuthenticated);
        console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
        
        // If user just signed in, link their consultations and update current room consultation
        if (user && roomName) {
          // First, link all consultations that match this patient's email
          if (user.email) {
            try {
              await fetch('/api/link-patient-consultations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: user.uid,
                  userEmail: user.email
                }),
              });
              console.log('Linked patient consultations after sign-in');
            } catch (error) {
              console.error('Error linking consultations after sign-in:', error);
            }
          }
          
          // Also update the current room consultation if patient was in call
          const wasInCall = localStorage.getItem(`patientInCall_${roomName}`);
          if (wasInCall === 'true') {
            try {
              // Update consultation to link patient user ID
              await fetch('/api/track-consultation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomName,
                  action: 'join',
                  patientName: patientName || localStorage.getItem(`patientName_${roomName}`) || 'Patient',
                  userId: user.uid,
                  patientEmail: user.email || null
                }),
              });
              console.log('Updated consultation with patient user ID after sign-in');
            } catch (error) {
              console.error('Error updating consultation after sign-in:', error);
            }
          }
        }
      });
    }
  }, [roomName, patientName]);

  // Load patient name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(`patientName_${roomName}`);
    if (savedName) {
      setPatientName(savedName);
    }
  }, [roomName]);

  // Check if patient was already in call
  useEffect(() => {
    const wasInCall = localStorage.getItem(`patientInCall_${roomName}`);
    const savedToken = localStorage.getItem(`patientToken_${roomName}`);
    if (wasInCall === 'true' && patientName && savedToken) {
      // Auto-rejoin if patient was previously in call
      setToken(savedToken);
    }
  }, [patientName, roomName]);

  // Load manual notes from Firestore
  useEffect(() => {
    if (!db || !roomName || !token) return;

    const callRef = doc(db, 'calls', roomName);
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.manualNotes && Array.isArray(data.manualNotes)) {
          setManualNotes(data.manualNotes);
        }
      }
    }, (error) => {
      console.error('Error loading manual notes:', error);
    });

    return () => unsubscribe();
  }, [db, roomName, token]);

  // Aggressively fix chat panel background - directly manipulate DOM
  useEffect(() => {
    if (!token) return;

    const fixChatPanel = () => {
      // Find all possible chat panel selectors
      const chatSelectors = [
        '.lk-chat-panel',
        '[class*="chat-panel"]',
        '[class*="ChatPanel"]',
        '[data-lk="chat-panel"]',
        '.lk-chat',
        '[class*="lk-chat"]',
        'div[role="dialog"][class*="chat"]',
        'aside[class*="chat"]',
        'section[class*="chat"]'
      ];

      chatSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el: Element) => {
            const htmlEl = el as HTMLElement;
            // Force white background with inline styles (highest priority)
            htmlEl.style.setProperty('background-color', '#ffffff', 'important');
            htmlEl.style.setProperty('background', '#ffffff', 'important');
            htmlEl.style.setProperty('color', '#000000', 'important');
            
            // Fix all children
            const allChildren = htmlEl.querySelectorAll('*');
            allChildren.forEach((child: Element) => {
              const childEl = child as HTMLElement;
              // Only fix background/color, not all styles
              if (childEl.classList.toString().includes('chat') || 
                  childEl.classList.toString().includes('message') ||
                  childEl.tagName === 'INPUT' ||
                  childEl.tagName === 'TEXTAREA') {
                childEl.style.setProperty('background-color', '#ffffff', 'important');
                childEl.style.setProperty('color', '#000000', 'important');
              }
            });

            // Fix input fields specifically
            const inputs = htmlEl.querySelectorAll('input, textarea');
            inputs.forEach((input: Element) => {
              const inputEl = input as HTMLInputElement | HTMLTextAreaElement;
              inputEl.style.setProperty('background-color', '#ffffff', 'important');
              inputEl.style.setProperty('color', '#000000', 'important');
            });

            // Fix messages
            const messages = htmlEl.querySelectorAll('[class*="message"], [class*="Message"]');
            messages.forEach((msg: Element) => {
              const msgEl = msg as HTMLElement;
              msgEl.style.setProperty('background-color', '#f8f9fa', 'important');
              msgEl.style.setProperty('color', '#000000', 'important');
            });
          });
        } catch (e) {
          // Silently fail for invalid selectors
        }
      });
    };

    // Run immediately
    fixChatPanel();

    // Watch for new chat panels being created
    const observer = new MutationObserver(() => {
      fixChatPanel();
    });

    // Observe the entire document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Also run periodically to catch any missed changes
    const interval = setInterval(fixChatPanel, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [token]);

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
        'button[title*="Chat"]',
        // More specific LiveKit selectors
        '.lk-button[data-lk-kind="chat"]',
        '.lk-button[data-lk-kind="toggle-chat"]',
        'button.lk-button[aria-label*="chat"]',
        'button.lk-button[aria-label*="Chat"]'
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
            
            // Remove any existing touch handlers to avoid duplicates
            const originalOnTouchEnd = (btn as any).__originalOnTouchEnd;
            if (originalOnTouchEnd) {
              btn.removeEventListener('touchend', originalOnTouchEnd);
            }
            
            // Add explicit touch event handlers
            const handleTouchStart = (e: TouchEvent) => {
              e.stopPropagation();
            };
            
            const handleTouchEnd = (e: TouchEvent) => {
              e.stopPropagation();
              
              // Method 1: Dispatch synthetic click event (more reliable)
              try {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  detail: 1,
                  buttons: 1
                });
                btn.dispatchEvent(clickEvent);
              } catch (err) {
                console.warn('Error dispatching click event:', err);
              }
              
              // Method 2: Direct click simulation (fallback)
              try {
                if (typeof btn.click === 'function') {
                  btn.click();
                }
              } catch (err) {
                console.warn('Error triggering click:', err);
              }
              
              // Method 3: Try to find and trigger LiveKit's chat toggle
              setTimeout(() => {
                // Enhanced chat panel detection
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
                  try {
                    chatPanel = document.querySelector(selector) as HTMLElement;
                    if (chatPanel) break;
                  } catch (e) {
                    continue;
                  }
                }
                
                if (chatPanel) {
                  // Check current visibility state using multiple methods
                  const computedStyle = window.getComputedStyle(chatPanel);
                  const rect = chatPanel.getBoundingClientRect();
                  const isHidden = computedStyle.display === 'none' || 
                                 chatPanel.hasAttribute('aria-hidden') ||
                                 computedStyle.visibility === 'hidden' ||
                                 parseFloat(computedStyle.opacity) === 0 ||
                                 rect.height === 0 ||
                                 rect.width === 0;
                  
                  if (isHidden) {
                    // Show chat panel with stronger styles
                    chatPanel.style.setProperty('display', 'block', 'important');
                    chatPanel.style.setProperty('visibility', 'visible', 'important');
                    chatPanel.style.setProperty('opacity', '1', 'important');
                    chatPanel.removeAttribute('aria-hidden');
                    chatPanel.style.setProperty('transform', 'translateY(0)', 'important');
                    chatPanel.style.setProperty('position', 'fixed', 'important');
                    chatPanel.style.setProperty('z-index', '1000', 'important');
                    chatPanel.style.setProperty('bottom', '80px', 'important');
                    chatPanel.style.setProperty('left', '0', 'important');
                    chatPanel.style.setProperty('right', '0', 'important');
                    chatPanel.style.setProperty('width', '100vw', 'important');
                  } else {
                    chatPanel.style.setProperty('display', 'none', 'important');
                    chatPanel.style.setProperty('visibility', 'hidden', 'important');
                    chatPanel.style.setProperty('opacity', '0', 'important');
                    chatPanel.setAttribute('aria-hidden', 'true');
                    chatPanel.style.setProperty('transform', 'translateY(100%)', 'important');
                  }
                }
              }, 150);
            };
            
            btn.addEventListener('touchstart', handleTouchStart, { passive: true });
            btn.addEventListener('touchend', handleTouchEnd, { passive: false });
            (btn as any).__originalOnTouchEnd = handleTouchEnd;
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
      attributeFilter: ['class', 'aria-label', 'title', 'data-lk-kind', 'style']
    });

    // Also check periodically
    const interval = setInterval(fixChatButton, 300);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [token]);

  // Handle page unload to track patient leaving
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (token) {
        console.log('Patient page unload detected, tracking leave for room:', roomName);
        // Use sendBeacon for reliable tracking on page unload
        const data = JSON.stringify({
          roomName,
          action: 'leave',
          patientName,
          userId: user?.uid || 'anonymous',
          patientEmail: user?.email || null
        });
        
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track-consultation', data);
        } else {
          // Fallback for browsers that don't support sendBeacon
          fetch('/api/track-consultation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true
          }).catch(error => {
            console.error('Error tracking consultation leave on unload:', error);
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [token, roomName, patientName, user?.uid]);

  // Handle visibility change to track when patient switches tabs or minimizes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && token) {
        console.log('Patient tab hidden, tracking leave for room:', roomName);
        // Track patient leaving when tab becomes hidden
        fetch('/api/track-consultation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            action: 'leave',
            patientName,
            userId: user?.uid || 'anonymous'
          }),
        }).then(response => {
          console.log('Patient leave tracking response (visibility change):', response.status);
          return response.json();
        }).then(data => {
          console.log('Patient leave tracking result (visibility change):', data);
        }).catch(error => {
          console.error('Error tracking consultation leave (visibility change):', error);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token, roomName, patientName, user?.uid]);

  // Function to handle Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      if (auth && provider) {
        console.log('Attempting Google sign-in...');
        const result = await signInWithPopup(auth, provider);
        console.log('Google sign-in successful:', result.user.displayName);
      } else {
        console.error('Firebase auth or provider not initialized');
        alert('Authentication service not available. Please refresh the page.');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      alert('Sign-in failed. Please try again.');
    }
  };

  // Function to join the room as a patient
  const handleJoinAsPatient = async () => {
    if (!patientName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      setIsJoining(true);
      setError(null);

      // Save patient name to localStorage
      localStorage.setItem(`patientName_${roomName}`, patientName);
      localStorage.setItem(`patientInCall_${roomName}`, 'true');

      // Get LiveKit token from API route for patient
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName, 
          participantName: `Patient: ${patientName}` 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get token');
      }

      // Save token to localStorage for persistence
      localStorage.setItem(`patientToken_${roomName}`, data.token);
      setToken(data.token);

      // Track patient joining consultation
      try {
        await fetch('/api/track-consultation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            action: 'join',
            patientName,
            userId: user?.uid || 'anonymous', // Pass user ID for tracking
            patientEmail: user?.email || null // Pass email to look up patient if not authenticated
          }),
        });
      } catch (error) {
        console.error('Error tracking consultation join:', error);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join room';
      setError(errorMessage);
      console.error('Patient room join error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F9FAFB',
        padding: '2rem'
      }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: 'white', 
          borderBottom: '1px solid #E5E7EB', 
          padding: '1rem 2rem',
          marginBottom: '2rem',
          borderRadius: '0.75rem'
        }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Telehealth Consultation</h1>
              <p style={{ color: '#4B5563' }}>Room: {roomName}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Link href="/" style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
                Home
              </Link>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Join Consultation</h2>
            <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '2rem' }}>Welcome to your telehealth consultation. Please enter your name to join the call.</p>
            
            {/* Patient Name Input */}
            <div style={{ marginBottom: '2rem' }}>
              <label htmlFor="patientName" style={{ display: 'block', fontSize: '1.125rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>
                Your Name
              </label>
              <input
                id="patientName"
                name="patientName"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter your full name"
                style={{ 
                  width: '100%', 
                  border: '1px solid #D1D5DB', 
                  borderRadius: '0.5rem', 
                  padding: '1rem 1.25rem', 
                  fontSize: '1.125rem',
                  marginBottom: '1rem'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinAsPatient()}
              />
            </div>

            {/* Error Display */}
            {error && (
              <div style={{ 
                padding: '1.25rem', 
                backgroundColor: '#FEF2F2', 
                border: '1px solid #FECACA', 
                borderRadius: '0.5rem', 
                color: '#DC2626', 
                fontSize: '1rem',
                marginBottom: '2rem'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Authentication Section */}
            {!isAuthenticated ? (
              <div style={{ 
                marginBottom: '2rem', 
                padding: '1.5rem', 
                backgroundColor: '#F0F9FF', 
                borderRadius: '0.5rem',
                border: '1px solid #BAE6FD'
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0369A1', marginBottom: '0.75rem' }}>
                  🔐 Sign in with Google (Optional)
                </h3>
                <p style={{ color: '#0369A1', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Sign in to save your consultation history and preferences.
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  style={{ 
                    backgroundColor: '#4285F4', 
                    color: 'white', 
                    padding: '0.75rem 1.5rem', 
                    borderRadius: '0.5rem', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    border: 'none', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 4px rgba(66, 133, 244, 0.3)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ fill: 'currentColor' }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div style={{ 
                marginBottom: '2rem', 
                padding: '1.5rem', 
                backgroundColor: '#F0FDF4', 
                borderRadius: '0.5rem',
                border: '1px solid #BBF7D0'
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#166534', marginBottom: '0.75rem' }}>
                  ✅ Signed in as {user?.displayName || user?.email}
                </h3>
                <p style={{ color: '#166534', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Your consultation history will be saved.
                </p>
                <button
                  onClick={() => auth && signOut(auth)}
                  style={{ 
                    backgroundColor: '#DC2626', 
                    color: 'white', 
                    padding: '0.5rem 1rem', 
                    borderRadius: '0.375rem', 
                    fontWeight: '500', 
                    fontSize: '0.875rem', 
                    border: 'none', 
                    cursor: 'pointer'
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}

            {/* Join Button */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={handleJoinAsPatient}
                disabled={isJoining || !patientName.trim()}
                style={{ 
                  backgroundColor: isJoining || !patientName.trim() ? '#9CA3AF' : '#2563EB', 
                  color: 'white', 
                  padding: '1rem 2rem', 
                  borderRadius: '0.5rem', 
                  fontWeight: '600', 
                  fontSize: '1.125rem', 
                  border: 'none', 
                  cursor: isJoining || !patientName.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {isJoining ? 'Joining...' : 'Join as Patient'}
              </button>
            </div>

            {/* Instructions */}
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.5rem', 
              backgroundColor: '#F0F9FF', 
              borderRadius: '0.5rem',
              border: '1px solid #BAE6FD'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0369A1', marginBottom: '0.75rem' }}>
                📋 Before joining, please ensure:
              </h3>
              <ul style={{ color: '#0369A1', lineHeight: '1.6' }}>
                <li>You have a stable internet connection</li>
                <li>Your microphone and camera are working</li>
                <li>You're in a quiet, private location</li>
                <li>You have your medical information ready if needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Manual transcription input component (same as doctor page)
  const ManualTranscriptionInput = () => {
    const [note, setNote] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
    const [isUploading, setIsUploading] = useState(false);

    // File size limits: 10MB for images, 5MB for PDFs
    const MAX_FILE_SIZE_IMAGE = 10 * 1024 * 1024; // 10MB
    const MAX_FILE_SIZE_PDF = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const validFiles: File[] = [];
      const errors: string[] = [];

      files.forEach(file => {
        if (!ALLOWED_TYPES.includes(file.type)) {
          errors.push(`${file.name}: Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed.`);
          return;
        }

        const isImage = file.type.startsWith('image/');
        const maxSize = isImage ? MAX_FILE_SIZE_IMAGE : MAX_FILE_SIZE_PDF;
        if (file.size > maxSize) {
          const maxSizeMB = maxSize / (1024 * 1024);
          errors.push(`${file.name}: File too large. Maximum size is ${maxSizeMB}MB.`);
          return;
        }

        validFiles.push(file);
      });

      if (errors.length > 0) {
        alert('File selection errors:\n' + errors.join('\n'));
      }

      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
      }

      e.target.value = '';
    };

    const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[index];
        return newProgress;
      });
    };

    const uploadFile = async (file: File, index: number): Promise<{url: string; name: string; type: string; size: number}> => {
      if (!storage || !roomName) {
        throw new Error('Storage not available');
      }

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const storageRef = ref(storage, `notes/${roomName}/${fileName}`);

      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(prev => ({ ...prev, [index]: progress }));
          },
          (error) => {
            console.error('File upload error:', error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({
                url: downloadURL,
                name: file.name,
                type: file.type,
                size: file.size
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    };

    const addNote = async () => {
      if (!note.trim() && selectedFiles.length === 0) {
        return;
      }

      setIsUploading(true);
      const timestamp = new Date().toISOString();
      const attachments: Array<{url: string; name: string; type: string; size: number}> = [];

      if (selectedFiles.length > 0 && storage) {
        try {
          const uploadPromises = selectedFiles.map((file, index) => uploadFile(file, index));
          const uploadedFiles = await Promise.all(uploadPromises);
          attachments.push(...uploadedFiles);
        } catch (error) {
          console.error('Error uploading files:', error);
          alert('Error uploading files. Please try again.');
          setIsUploading(false);
          return;
        }
      }

      const newNote = {
        text: note.trim() || '(No text)',
        timestamp,
        ...(attachments.length > 0 && { attachments })
      };

      const updatedNotes = [...manualNotes, newNote];
      setManualNotes(updatedNotes);
      setNote('');
      setSelectedFiles([]);
      setUploadProgress({});
      setIsUploading(false);

      if (db && roomName) {
        const callRef = doc(db, 'calls', roomName);
        setDoc(callRef, {
          roomName,
          manualNotes: updatedNotes,
          lastUpdated: new Date(),
          status: 'active'
        }, { merge: true }).catch(error => {
          console.error('Error storing manual notes:', error);
        });
      }
    };

    return (
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '0.875rem', 
          fontWeight: '600', 
          color: '#374151' 
        }}>
          Add Manual Note:
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter your note..."
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              pointerEvents: 'auto'
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              e.currentTarget.focus();
            }}
            onFocus={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !isUploading) {
                e.preventDefault();
                addNote();
              }
            }}
            onKeyPress={(e) => {
              e.stopPropagation();
            }}
            disabled={isUploading}
            autoFocus={false}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              addNote();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
            }}
            disabled={isUploading || (!note.trim() && selectedFiles.length === 0)}
            style={{
              backgroundColor: (note.trim() || selectedFiles.length > 0) && !isUploading ? '#2563eb' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              cursor: (note.trim() || selectedFiles.length > 0) && !isUploading ? 'pointer' : 'not-allowed',
              pointerEvents: 'auto'
            }}
          >
            {isUploading ? 'Uploading...' : 'Add'}
          </button>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label
            style={{
              display: 'inline-block',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              color: isUploading ? '#9ca3af' : '#374151',
              pointerEvents: isUploading ? 'none' : 'auto'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            📎 Attach File
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
          </label>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', marginLeft: '0.5rem' }}>
            (Images: max 10MB, PDFs: max 5MB)
          </span>
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  marginBottom: '0.25rem',
                  fontSize: '0.7rem'
                }}
              >
                <span style={{ flex: 1, color: '#374151', wordBreak: 'break-word' }}>
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
                {uploadProgress[index] !== undefined && (
                  <div style={{ width: '60px', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${uploadProgress[index]}%`,
                        height: '100%',
                        backgroundColor: '#2563eb',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    padding: '0.25rem'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Fix Control Panel - Only visible when doctor has generated a link */}
      {shouldShowFixControlPanel() && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#ffffff',
            border: '2px solid #059669',
            borderRadius: '0.75rem',
            padding: '1rem',
            zIndex: 10001,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            maxWidth: isInfoPanelCollapsed ? '60px' : '320px',
            fontSize: '0.875rem',
            transition: 'max-width 0.3s ease',
            minHeight: '50px'
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ 
                margin: '0', 
                color: '#059669', 
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                🛠️ Fix Control Panel
              </h3>
              <button
                onClick={() => setIsInfoPanelCollapsed(!isInfoPanelCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#059669',
                  padding: '0.25rem'
                }}
              >
                {isInfoPanelCollapsed ? '▶' : '◀'}
              </button>
            </div>
            {!isInfoPanelCollapsed && (
              <>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Connected as: {patientName || 'Patient'}
                </p>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.75rem'
                }}>
                  Room: {roomName}
                </p>
              </>
            )}
          </div>
          
          {!isInfoPanelCollapsed && (
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexDirection: 'column'
            }}>
              <div style={{
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                fontSize: '0.75rem',
                color: '#374151',
                wordBreak: 'break-all',
                marginBottom: '0.5rem'
              }}>
                <strong>Patient Link:</strong><br />
                {`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`}
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`);
                  alert('Patient link copied to clipboard!');
                }}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center'
                }}
              >
                📋 Copy Patient Link
              </button>
              
              <button
                onClick={() => {
                  // Clear the generated link flag
                  localStorage.removeItem(`doctorGeneratedLink_${roomName}`);
                  alert('Fix control panel hidden. Refresh to see changes.');
                }}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center'
                }}
              >
                🗑️ Hide Panel
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Manual Notes Sidebar - Available for patients */}
      {token && createPortal(
        <CollapsibleSidebar
          title="Manual Notes"
          icon="📝"
          position="left"
          defaultCollapsed={false}
          width={350}
          collapsedWidth={60}
        >
          <ManualTranscriptionInput />
          {manualNotes.length > 0 && (
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '0.75rem' }}>
              <h4 style={{ 
                margin: '0 0 0.5rem 0', 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                color: '#374151' 
              }}>
                Recent Notes:
              </h4>
              {manualNotes.map((note, index) => (
                <div key={index} style={{
                  padding: '0.5rem',
                  backgroundColor: '#fef9c3',
                  border: '1px solid #fde047',
                  borderRadius: '0.375rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#78350f',
                  wordBreak: 'break-word'
                }}>
                  <div style={{ marginBottom: note.attachments && note.attachments.length > 0 ? '0.5rem' : '0' }}>
                    <strong>{new Date(note.timestamp).toLocaleString()}:</strong> {note.text}
                  </div>
                  {note.attachments && note.attachments.length > 0 && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #fde047' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.25rem', color: '#92400e' }}>
                        Attachments:
                      </div>
                      {note.attachments.map((attachment, attIndex) => (
                        <div key={attIndex} style={{ marginBottom: '0.25rem' }}>
                          {attachment.type.startsWith('image/') ? (
                            <div>
                              <img
                                src={attachment.url}
                                alt={attachment.name}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '150px',
                                  borderRadius: '0.25rem',
                                  marginBottom: '0.25rem',
                                  cursor: 'pointer'
                                }}
                                onClick={() => window.open(attachment.url, '_blank')}
                              />
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.65rem',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  display: 'block'
                                }}
                              >
                                {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                              </a>
                            </div>
                          ) : (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '0.65rem',
                                color: '#2563eb',
                                textDecoration: 'underline',
                                display: 'block'
                              }}
                            >
                              📄 {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSidebar>,
        typeof window !== 'undefined' ? document.body : ({} as any)
      )}

      {/* Manual Leave Button removed - using only the working leave button in Room Info panel */}
      
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        audio
        video
        onDisconnected={(reason) => {
          console.log('Patient disconnected from room:', roomName, 'reason:', reason);
          setToken(null);
          // Clear the in-call flag when disconnected
          localStorage.removeItem(`patientInCall_${roomName}`);
          localStorage.removeItem(`patientToken_${roomName}`);
          
          // Track patient leaving consultation
          console.log('Tracking patient leave for room:', roomName, 'patient:', patientName, 'user:', user?.uid);
          fetch('/api/track-consultation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomName,
              action: 'leave',
              patientName,
              userId: user?.uid || 'anonymous' // Pass user ID for tracking
            }),
          }).then(response => {
            console.log('Patient leave tracking response:', response.status);
            return response.json();
          }).then(data => {
            console.log('Patient leave tracking result:', data);
          }).catch(error => {
            console.error('Error tracking consultation leave:', error);
          });
          
          // Redirect to patient-specific page
          // Check if user is authenticated - if yes, go to patient dashboard, otherwise patient login
          // Use both user state and isAuthenticated state to ensure we catch all authenticated cases
          if (user?.uid || isAuthenticated) {
            window.location.href = '/patient/dashboard';
          } else {
            // Check if patient just registered
            const registeredEmail = localStorage.getItem('patientRegisteredEmail');
            if (registeredEmail) {
              window.location.href = '/patient/login?registered=true&email=' + encodeURIComponent(registeredEmail);
            } else {
              window.location.href = '/patient/login';
            }
          }
        }}
        onError={(error) => {
          // Log detailed error information for debugging video track issues
          const isCameraPermissionError = 
            error.message?.includes('NotReadableError') || 
            error.message?.includes('video source') ||
            error.message?.includes('Could not start video source') ||
            error.name === 'NotReadableError';
          
          if (isCameraPermissionError) {
            console.error('⚠️ Camera/video track error in patient room:', {
              error: error.message || error,
              name: error.name,
              stack: error.stack,
              suggestion: 'Check browser permissions and ensure camera is not in use by another application. You can enable video manually via the Camera button in the control bar.'
            });
            // Don't show error to user for permission issues - they can enable manually
            return;
          }
          
          console.error('LiveKit error:', error);
          setError('Connection error. Please try again.');
        }}
      >
        {/* Video Conference Component - This provides the actual video controls */}
        <VideoConference />
      </LiveKitRoom>

      {/* Shared LiveKit styles with blue control bar - all styles are now modular */}
      {token && <LiveKitStyles controlBarColor="blue" />}

        {/* Room Information Panel - Collapsible */}
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #059669',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            zIndex: 9999,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            maxWidth: isInfoPanelCollapsed ? '60px' : '280px',
            fontSize: '0.875rem',
            transition: 'max-width 0.3s ease'
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ 
                margin: '0', 
                color: '#047857', 
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                🔗 Room Info
              </h3>
              <button
                onClick={() => setIsInfoPanelCollapsed(!isInfoPanelCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#047857',
                  padding: '0.25rem'
                }}
              >
                {isInfoPanelCollapsed ? '▶' : '◀'}
              </button>
            </div>
            {!isInfoPanelCollapsed && (
              <>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Connected as: {patientName}
                </p>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.75rem'
                }}>
                  Room: {roomName}
                </p>
              </>
            )}
          </div>
          
          {!isInfoPanelCollapsed && (
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexDirection: 'column'
            }}>
            <div style={{
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              padding: '0.375rem',
              fontSize: '0.7rem',
              color: '#374151',
              wordBreak: 'break-all',
              marginBottom: '0.5rem'
            }}>
              {`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`}
            </div>
            <button
              onClick={async () => {
                // Track patient leaving consultation
                try {
                  await fetch('/api/track-consultation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      roomName,
                      action: 'leave',
                      patientName,
                      userId: user?.uid || 'anonymous',
                      patientEmail: user?.email || null // Pass email to look up patient if not authenticated
                    })
                  });
                  console.log('✅ Patient leave tracked for room:', roomName);
                } catch (error) {
                  console.error('Error tracking patient leave:', error);
                }
                
                // Clear current token and redirect to patient-specific page
                // Route to patient dashboard if logged in, otherwise patient login
                localStorage.removeItem(`patientToken_${roomName}`);
                localStorage.removeItem(`patientInCall_${roomName}`);
                setToken(null);
                
                // Check if user is authenticated - if yes, go to patient dashboard, otherwise patient login
                // Use both user state and isAuthenticated state to ensure we catch all authenticated cases
                if (user?.uid || isAuthenticated) {
                  window.location.href = '/patient/dashboard';
                } else {
                  // Check if patient just registered
                  const registeredEmail = localStorage.getItem('patientRegisteredEmail');
                  if (registeredEmail) {
                    window.location.href = '/patient/login?registered=true&email=' + encodeURIComponent(registeredEmail);
                  } else {
                    window.location.href = '/patient/login';
                  }
                }
              }}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-block',
                textAlign: 'center'
              }}
            >
              Leave Call
            </button>
            

            
            {/* Join as Doctor Button */}
            <Link href={`/room/${roomName}`} style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
              textAlign: 'center',
              marginTop: '0.5rem'
            }}>
              Join as Doctor
            </Link>
            </div>
          )}
        </div>
    </div>
  );
}

// Server component that handles the params
export default async function PatientRoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomName } = await params;
  
  return <PatientRoomClient roomName={roomName} />;
}
