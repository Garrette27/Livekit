'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { Room } from 'livekit-client';
import Link from 'next/link';
import { auth, provider, db, storage } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    debugLogged?: boolean;
    speechRecognitionActive?: boolean;
  }
}

// Client component for the doctor room functionality
function DoctorRoomClient({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [manualNotes, setManualNotes] = useState<Array<{text: string; timestamp: string; attachments?: Array<{url: string; name: string; type: string; size: number}>}>>([]);
  const [speechRecognitionStatus, setSpeechRecognitionStatus] = useState<string>('idle');

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        setUser(user);
        setIsAuthenticated(!!user);
        console.log('Doctor auth state changed:', user ? 'Doctor signed in' : 'Doctor signed out');
        
        // Auto-fill doctor name from authenticated user
        if (user && !doctorName) {
          const displayName = user.displayName || user.email || 'Dr. Anonymous';
          setDoctorName(displayName);
          localStorage.setItem(`doctorName_${roomName}`, displayName);
        }
      });
    }
  }, [roomName]);

  // Load doctor name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(`doctorName_${roomName}`);
    if (savedName) {
      setDoctorName(savedName);
    }
  }, [roomName]);

  const generateDoctorToken = async () => {
    if (!doctorName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/doctor-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          doctorName,
          doctorEmail: user?.email || 'anonymous@example.com',
        }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        setToken(data.token);
        localStorage.setItem(`doctorToken_${roomName}`, data.token);
        localStorage.setItem(`doctorName_${roomName}`, doctorName);
      } else {
        setError(data.error || 'Failed to generate doctor access token');
      }
    } catch (err) {
      console.error('Doctor token generation error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  // Auto-join when user is authenticated and has a name
  useEffect(() => {
    if (isAuthenticated && user && doctorName.trim() && !token && !isJoining) {
      console.log('Auto-joining as doctor:', doctorName);
      generateDoctorToken();
    }
  }, [isAuthenticated, user, doctorName, token, isJoining, roomName]);

  // Create room record when joining as doctor
  useEffect(() => {
    if (token && user && roomName && db) {
      const createRoomRecord = async () => {
        try {
          if (!db) {
            console.error('Firebase db not available');
            return;
          }

          const roomRef = doc(db, 'rooms', roomName);
          await setDoc(roomRef, {
            roomName,
            createdBy: user.uid,
            createdAt: new Date(),
            status: 'active',
            metadata: {
              createdBy: user.uid,
              userId: user.uid,
              userEmail: user.email,
              userName: doctorName || user.displayName || user.email,
              participantType: 'doctor',
              joinedVia: 'doctor-direct-access',
              timestamp: new Date().toISOString()
            }
          }, { merge: true });

          // Create call record for AI summarization
          const callRef = doc(db, 'calls', roomName);
          await setDoc(callRef, {
            roomName,
            createdBy: user.uid,
            createdAt: new Date(),
            status: 'active',
            transcription: [],
            manualNotes: [],
            lastUpdated: new Date()
          }, { merge: true });

          console.log('✅ Room and call records created for AI summarization');

          // Track consultation start for AI summarization
          try {
            const response = await fetch('/api/track-consultation', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                roomName,
                action: 'join',
                patientName: 'Doctor',
                duration: 0,
                userId: user.uid,
              }),
            });

            if (response.ok) {
              console.log('✅ Consultation tracking started for AI summarization');
            } else {
              console.error('Failed to track consultation:', await response.text());
            }
          } catch (error) {
            console.error('Error tracking consultation:', error);
          }
        } catch (error) {
          console.error('Error creating room/call records:', error);
        }
      };

      createRoomRecord();
    }
  }, [token, user, roomName, db, doctorName]);

  const handleSignIn = async () => {
    if (!auth || !provider) {
      setError('Authentication not available');
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      setUser(user);
      setIsAuthenticated(true);
      setDoctorName(user.displayName || user.email || 'Dr. Anonymous');
      localStorage.setItem(`doctorName_${roomName}`, user.displayName || user.email || 'Dr. Anonymous');
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      if (auth) {
        await signOut(auth);
        setUser(null);
        setIsAuthenticated(false);
        setDoctorName('');
        localStorage.removeItem(`doctorName_${roomName}`);
        localStorage.removeItem(`doctorToken_${roomName}`);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleDisconnect = () => {
    setToken(null);
    localStorage.removeItem(`doctorToken_${roomName}`);
  };

  // Transcription capture component - ENABLED with improved error handling
  const TranscriptionCapture = () => {
    // Re-enabled speech recognition with better error handling
    
    const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
    const [userInteracted, setUserInteracted] = useState<boolean>(false);
    const [hasStarted, setHasStarted] = useState<boolean>(false);

    // Initialize speech recognition
    useEffect(() => {
      if (!token || !roomName) return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setSpeechRecognitionStatus('listening');
        setHasStarted(true);
      };

      recognition.onresult = (event: any) => {
        console.log('🎤 Speech recognition result received:', event.results.length, 'results');
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          console.log(`Result ${i}: "${result[0].transcript}" (confidence: ${result[0].confidence}, isFinal: ${result.isFinal})`);
          
          if (result.isFinal) {
            const transcript = result[0].transcript.trim();
            if (transcript) {
              const timestamp = new Date().toISOString();
              const newTranscription = [...transcription, `${timestamp}: ${transcript}`];
              setTranscription(newTranscription);
              
              // Store in Firestore
              if (db && roomName) {
                const callRef = doc(db, 'calls', roomName);
                setDoc(callRef, {
                  roomName,
                  transcription: newTranscription,
                  lastUpdated: new Date(),
                  status: 'active'
                }, { merge: true }).catch(error => {
                  console.error('Error storing transcription:', error);
                });
              }
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.log('🎤 Speech recognition error:', event.error);
        
        // Handle different error types
        if (event.error === 'aborted') {
          console.log('🎤 Speech recognition aborted - this is normal');
          setSpeechRecognitionStatus('idle');
          return;
        }
        
        if (event.error === 'not-allowed') {
          console.warn('🎤 Speech recognition not allowed - user needs to interact first');
          setSpeechRecognitionStatus('permission-required');
          return;
        }
        
        if (event.error === 'no-speech') {
          console.log('🎤 No speech detected - restarting');
          setTimeout(() => {
            if (hasStarted && recognitionInstance) {
              try {
                recognitionInstance.start();
              } catch (e) {
                console.log('Error restarting recognition:', e);
              }
            }
          }, 1000);
          return;
        }
        
        console.error('🎤 Speech recognition error:', event.error);
        setSpeechRecognitionStatus('error');
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setSpeechRecognitionStatus('idle');
        
        // Auto-restart if we're still in the room
        if (token && hasStarted) {
          console.log('🔄 Restarting speech recognition...');
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              console.log('Error restarting recognition:', e);
            }
          }, 500);
        }
      };

      setRecognitionInstance(recognition);

      return () => {
        if (recognition) {
          recognition.stop();
        }
      };
    }, [token, roomName, transcription, hasStarted]);

    // Start recognition when user interacts
    const startRecognition = () => {
      if (recognitionInstance && !userInteracted) {
        setUserInteracted(true);
        try {
          recognitionInstance.start();
        } catch (error) {
          console.error('Error starting speech recognition:', error);
        }
      }
    };

    // Handle user interaction to start recognition
    useEffect(() => {
      const handleUserInteraction = () => {
        if (!userInteracted && recognitionInstance) {
          startRecognition();
        }
      };

      // Add event listeners for user interaction
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('keydown', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);

      return () => {
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      };
    }, [userInteracted, recognitionInstance]);

    return null; // This component doesn't render anything visible
  };

  // Manual transcription input component
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
        // Check file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          errors.push(`${file.name}: Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed.`);
          return;
        }

        // Check file size
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

      // Reset input
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

      // Upload files if any
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

      // Create note object
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

      // Store in Firestore
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

        {/* File Upload Section */}
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

        {/* Selected Files Preview */}
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

  // Show authentication UI if not signed in
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
            <span style={{ fontSize: '2rem' }}>🩺</span>
          </div>

          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '1rem'
          }}>
            Doctor Access
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            Sign in to join the consultation as a doctor
          </p>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSignIn}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              marginBottom: '1rem',
              width: '100%'
            }}
          >
            Sign in with Google
          </button>

          <Link
            href="/invitations"
            style={{
              display: 'inline-block',
              color: '#6b7280',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}
          >
            ← Back to Invitations
          </Link>
        </div>
      </div>
    );
  }

  // Show name input if not set and user is authenticated
  if (isAuthenticated && !doctorName.trim() && !token) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
            <span style={{ fontSize: '2rem' }}>👨‍⚕️</span>
          </div>

          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '1rem'
          }}>
            Welcome, Dr. {user?.displayName || user?.email || 'Anonymous'}
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            Enter your name to join the consultation
          </p>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Your Name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                textAlign: 'center'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  generateDoctorToken();
                }
              }}
            />
          </div>

          <button
            onClick={generateDoctorToken}
            disabled={isJoining}
            style={{
              backgroundColor: isJoining ? '#9ca3af' : '#059669',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: isJoining ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              marginBottom: '1rem',
              width: '100%'
            }}
          >
            {isJoining ? 'Joining...' : 'Join Consultation'}
          </button>

          <button
            onClick={handleSignOut}
            style={{
              backgroundColor: 'transparent',
              color: '#6b7280',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Show video interface with enhanced UI
  if (token) {
    return (
      <>
        {/* Manual Notes Sidebar - Replaced Secure Patient Invitations */}
        {createPortal(
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

        {/* Doctor Session Control Panel - Rendered in a portal so it never gets hidden by LiveKit */}
        {createPortal(
          <CollapsibleSidebar
            title="Doctor Session Control"
            icon="🛠️"
            position="right"
            defaultCollapsed={false}
            width={300}
            collapsedWidth={60}
          >
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ 
                margin: '0', 
                color: '#6b7280', 
                fontSize: '0.875rem',
                marginBottom: '0.5rem'
              }}>
                Connected as: {doctorName || user?.displayName || user?.email || 'Doctor'}
              </p>
              <p style={{ 
                margin: '0', 
                color: '#6b7280', 
                fontSize: '0.875rem',
                marginBottom: '0.75rem'
              }}>
                Room: {roomName}
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              flexDirection: 'column'
            }}>
              {/* Device Controls */}
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #0ea5e9',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginBottom: '0.75rem'
              }}>
                <h4 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#0c4a6e'
                }}>
                  Device Controls
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  <button
                    onClick={() => {
                      // Trigger device selection
                      const micButton = document.querySelector('[data-lk="microphone"]') as HTMLButtonElement;
                      if (micButton) micButton.click();
                    }}
                    style={{
                      backgroundColor: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    🎤 Select Microphone
                  </button>
                  <button
                    onClick={() => {
                      // Trigger device selection
                      const camButton = document.querySelector('[data-lk="camera"]') as HTMLButtonElement;
                      if (camButton) camButton.click();
                    }}
                    style={{
                      backgroundColor: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    📹 Select Camera
                  </button>
                </div>
              </div>

              {/* Patient Link */}
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #22c55e',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginBottom: '0.75rem'
              }}>
                <h4 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#15803d'
                }}>
                  Patient Link:
                </h4>
                <p style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.7rem',
                  color: '#6b7280',
                  wordBreak: 'break-all'
                }}>
                  https://livekit-frontend-tau.vercel.app/room/{roomName}/patient
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`);
                    alert('Patient link copied to clipboard!');
                  }}
                  style={{
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    width: '100%',
                    marginBottom: '0.5rem'
                  }}
                >
                  📋 Copy Patient Link
                </button>
                
                <button
                  onClick={() => {
                    window.open(`/room/${roomName}/patient`, '_blank');
                  }}
                  style={{
                    backgroundColor: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    display: 'inline-block',
                    textAlign: 'center',
                    width: '100%',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                  }}
                >
                  👥 Join as Patient
                </button>
                
                <button
                  onClick={() => {
                    handleDisconnect();
                    window.location.href = '/invitations';
                  }}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    display: 'inline-block',
                    textAlign: 'center',
                    width: '100%',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                    marginTop: '0.5rem'
                  }}
                >
                  🚪 Leave Call
                </button>
              </div>
            </div>
          </CollapsibleSidebar>,
          typeof window !== 'undefined' ? document.body : ({} as any)
        )}
        
        <TranscriptionCapture />
        
        {/* MAIN VIDEO INTERFACE - Always show when token exists */}
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
          connect={true}
          audio
          video
          style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
          onDisconnected={() => {
            console.log('Disconnected from room');
            setToken(null);
            
            // Clear stored token
            localStorage.removeItem(`doctorToken_${roomName}`);
            
            // Update call status in Firestore
            if (db && roomName) {
              try {
                const callRef = doc(db, 'calls', roomName);
                setDoc(callRef, {
                  status: 'completed',
                  endedAt: new Date()
                }, { merge: true }).catch(error => {
                  console.error('Error updating call status:', error);
                });
              } catch (error) {
                console.error('Error updating call status:', error);
              }
            }
            
            // Redirect to invitations page after disconnection
            window.location.href = '/invitations';
          }}
          onError={(error) => {
            console.error('LiveKit error:', error);
            setError('Connection error. Please try again.');
          }}
        >
          {/* Video Conference Component - This provides the actual video controls */}
          <VideoConference />
        </LiveKitRoom>

        {error && (
          <div
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              color: '#dc2626',
              zIndex: 9999,
              maxWidth: '400px',
              textAlign: 'center'
            }}
          >
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '1rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
          </div>
        )}
      </>
    );
  }

  // Loading state
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '4rem',
          height: '4rem',
          border: '2px solid #dbeafe',
          borderTop: '2px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1.5rem'
        }}></div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af' }}>
          Loading...
        </h2>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function DoctorRoomPage({ params }: { params: Promise<{ room: string }> }) {
  return (
    <div>
      <DoctorRoomClientWrapper params={params} />
    </div>
  );
}

function DoctorRoomClientWrapper({ params }: { params: Promise<{ room: string }> }) {
  const [roomName, setRoomName] = useState<string>('');

  useEffect(() => {
    params.then((resolvedParams) => {
      setRoomName(resolvedParams.room);
    });
  }, [params]);

  if (!roomName) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            border: '2px solid #dbeafe',
            borderTop: '2px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af' }}>
            Loading...
          </h2>
        </div>
        
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <DoctorRoomClient roomName={roomName} />
  );
}
