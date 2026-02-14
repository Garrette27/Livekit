'use client';

import { useCallback, useEffect, useRef, useState, Suspense, Dispatch, SetStateAction } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PatientLiveKitRoom from './components/PatientLiveKitRoom';
import PatientRegistration from '@/components/PatientRegistration';
import { useAuthSession } from '@/hooks/useAuthSession';
import {
  trackConsultationEvent,
  trackConsultationEventWithBeacon,
} from '@/lib/consultations/consultation-event-client';
import { addPendingConsultationSessionId } from '@/lib/consultations/pending-session-client';
import { 
  ValidateInvitationRequest, 
  ValidateInvitationResponse, 
  DeviceFingerprint 
} from '@/lib/types';

// Component for waiting room with admission polling
function WaitingRoomView({ 
  validationResult, 
  invitationEmail,
  setValidationResult,
  setError
}: { 
  validationResult: ValidateInvitationResponse; 
  invitationEmail: string;
  setValidationResult: Dispatch<SetStateAction<ValidateInvitationResponse | null>>;
  setError: (error: string | null) => void;
}) {
  const waitingPatientIdRef = useRef<string | null>(null);

  useEffect(() => {
    waitingPatientIdRef.current = validationResult.waitingPatientId || waitingPatientIdRef.current;
  }, [validationResult.waitingPatientId]);

  useEffect(() => {
    if (!validationResult?.invitationId) return;
    
    // Don't poll if already admitted (waitingRoomEnabled is false)
    if (!validationResult.waitingRoomEnabled || !validationResult.waitingRoomToken) {
      return;
    }

    const checkAdmission = async () => {
      try {
        const response = await fetch('/api/waiting-room/check-admission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invitationId: validationResult.invitationId,
            patientEmail: validationResult.registeredEmail || invitationEmail || undefined,
            waitingPatientId: waitingPatientIdRef.current || undefined,
          }),
        });

        const result = await response.json();

        if (result.success && result.admitted && result.liveKitToken) {
          waitingPatientIdRef.current = result.waitingPatientId || waitingPatientIdRef.current;
          console.log('Patient admitted. Updating to main consultation room...');
          // Clear any previous errors
          setError(null);
          // Patient has been admitted - update to show consultation room
          const admittedState: ValidateInvitationResponse = {
            ...validationResult,
            success: true,
            liveKitToken: result.liveKitToken,
            roomName: result.roomName,
            waitingRoomEnabled: false,
            waitingRoomToken: false,
            waitingPatientId: result.waitingPatientId || waitingPatientIdRef.current || validationResult.waitingPatientId,
          };
          setValidationResult(admittedState);
          
        } else if (result.success && !result.admitted) {
          if (typeof result.waitingPatientId === 'string' && result.waitingPatientId.trim()) {
            waitingPatientIdRef.current = result.waitingPatientId.trim();
          }

          if (result.status === 'rejected') {
            setError(result.error || 'You were rejected by the doctor.');
            return;
          }

          if (result.status === 'left' && result.error) {
            setError(result.error);
            return;
          }

          if (result.error && result.error.includes('No active waiting entry')) {
            setError(result.error);
          }
        } else if (!result.success && result.error) {
          console.error('Error checking admission:', result.error);
          // Don't set error for waiting status - that's expected
          if (result.error !== 'Waiting patient not found' && !result.error.includes('waiting')) {
            setError(result.error);
          }
        }
      } catch (err: any) {
        console.error('Error checking admission:', err);
        // Don't set error for network issues during polling - just log it
        // setError('Network error while checking admission status.');
      }
    };

    // Check immediately, then poll every 3 seconds
    checkAdmission();
    const interval = setInterval(checkAdmission, 3000);

    return () => clearInterval(interval);
  }, [
    invitationEmail,
    setError,
    setValidationResult,
    validationResult?.invitationId,
    validationResult?.liveKitToken,
    validationResult?.registeredEmail,
    validationResult?.roomName,
    validationResult?.waitingRoomEnabled,
    validationResult?.waitingRoomToken,
    validationResult,
  ]);

  return null;
}

function InvitePageContent() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { user, isAuthenticated, isLoading: authLoading } = useAuthSession();
  const disableLiveKitForE2E = process.env.NEXT_PUBLIC_E2E_MODE === '1';
  
  const [isValidating, setIsValidating] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidateInvitationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprint | null>(null);
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState<string>('');
  const [allowLiveKitMount, setAllowLiveKitMount] = useState(false);
  const trackedJoinKeyRef = useRef<string | null>(null);
  const activeConsultationSessionIdRef = useRef<string | null>(null);
  const hasProcessedExitRef = useRef(false);
  const validationResultRef = useRef<ValidateInvitationResponse | null>(null);
  const finalizeConsultationExitRef = useRef<(redirectAfterExit: boolean) => void>(() => undefined);

  // Generate device fingerprint
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fingerprint: DeviceFingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || 'unspecified',
        hash: '', // Will be calculated on server
      };
      setDeviceFingerprint(fingerprint);
    }
  }, []);

  // Validate invitation
  useEffect(() => {
    if (!token || !deviceFingerprint || authLoading) return;

    const validateInvitation = async () => {
      try {
        setIsValidating(true);
        setError(null);

        const request: ValidateInvitationRequest = {
          token,
          deviceFingerprint,
          ...(user?.email ? { userEmail: user.email.toLowerCase() } : {}),
        };

        const response = await fetch('/api/invite/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        const result: ValidateInvitationResponse = await response.json();

        if (result.success) {
          if (user?.email) {
            setInvitationEmail(user.email.toLowerCase());
          }
          setValidationResult(result);
        } else if (result.requiresRegistration) {
          // User needs to register first
          setRequiresRegistration(true);
          setInvitationEmail(result.registeredEmail || '');
        } else {
          setError(result.error || 'Validation failed');
          if (result.violations && result.violations.length > 0) {
            console.error('Security violations:', result.violations);
          }
        }
      } catch (err) {
        setError('Network error. Please try again.');
        console.error('Error validating invitation:', err);
      } finally {
        setIsValidating(false);
      }
    };

    validateInvitation();
  }, [authLoading, deviceFingerprint, token, user?.email]);

  useEffect(() => {
    if (!validationResult?.roomName || validationResult.waitingRoomEnabled) {
      trackedJoinKeyRef.current = null;
      activeConsultationSessionIdRef.current = null;
      return;
    }

    const joinTrackingKey = `${validationResult.invitationId || 'invite'}:${validationResult.roomName}:${validationResult.liveKitToken || 'token'}`;
    if (trackedJoinKeyRef.current === joinTrackingKey) {
      return;
    }
    trackedJoinKeyRef.current = joinTrackingKey;
    activeConsultationSessionIdRef.current = null;

    void trackConsultationEvent({
      roomName: validationResult.roomName,
      action: 'join',
      patientName: 'Patient',
      userId: user?.uid,
      patientEmail: user?.email || validationResult.registeredEmail || invitationEmail || null,
    })
      .then((result) => {
        activeConsultationSessionIdRef.current = result.consultationSessionId || null;
        addPendingConsultationSessionId(result.consultationSessionId);
      })
      .catch((trackingError) => {
        if (trackedJoinKeyRef.current === joinTrackingKey) {
          trackedJoinKeyRef.current = null;
        }
        console.error('Error tracking patient join:', trackingError);
      });
  }, [
    invitationEmail,
    user?.email,
    user?.uid,
    validationResult?.invitationId,
    validationResult?.liveKitToken,
    validationResult?.registeredEmail,
    validationResult?.roomName,
    validationResult?.waitingRoomEnabled,
  ]);

  useEffect(() => {
    validationResultRef.current = validationResult;
  }, [validationResult]);

  useEffect(() => {
    hasProcessedExitRef.current = false;
  }, [validationResult?.liveKitToken, validationResult?.roomName, validationResult?.waitingPatientId]);

  const getPostCallRedirectPath = useCallback(() => {
    if (user?.uid || isAuthenticated) {
      return '/patient/dashboard';
    }

    const registeredEmail = localStorage.getItem('patientRegisteredEmail');
    if (registeredEmail) {
      return `/patient/login?registered=true&email=${encodeURIComponent(registeredEmail)}`;
    }

    return '/patient/login';
  }, [isAuthenticated, user?.uid]);

  const markWaitingEntryLeftWithBeacon = useCallback((waitingPatientId: string): boolean => {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return false;
    }

    return navigator.sendBeacon(
      '/api/waiting-room/mark-left',
      JSON.stringify({ waitingPatientId })
    );
  }, []);

  useEffect(() => {
    setAllowLiveKitMount(!disableLiveKitForE2E);
  }, [disableLiveKitForE2E]);

  const finalizeConsultationExit = useCallback(
    (redirectAfterExit: boolean) => {
      if (hasProcessedExitRef.current) {
        if (redirectAfterExit) {
          router.push(getPostCallRedirectPath());
        }
        return;
      }

      hasProcessedExitRef.current = true;
      const currentValidation = validationResultRef.current;
      const waitingPatientId = currentValidation?.waitingPatientId;
      if (waitingPatientId) {
        const markedWithBeacon = markWaitingEntryLeftWithBeacon(waitingPatientId);
        if (!markedWithBeacon) {
          void fetch('/api/waiting-room/mark-left', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waitingPatientId }),
            keepalive: true,
          }).catch((markLeftError) => {
            console.error('Error marking waiting entry as left:', markLeftError);
          });
        }
      }

      if (currentValidation?.roomName && !currentValidation.waitingRoomEnabled) {
        const trackedWithBeacon = trackConsultationEventWithBeacon({
          roomName: currentValidation.roomName,
          action: 'leave',
          patientName: 'Patient',
          userId: user?.uid,
          patientEmail: user?.email || currentValidation.registeredEmail || invitationEmail || null,
          consultationSessionId: activeConsultationSessionIdRef.current,
        });

        if (!trackedWithBeacon) {
          void trackConsultationEvent(
            {
              roomName: currentValidation.roomName,
              action: 'leave',
              patientName: 'Patient',
              userId: user?.uid,
              patientEmail: user?.email || currentValidation.registeredEmail || invitationEmail || null,
              consultationSessionId: activeConsultationSessionIdRef.current,
            },
            { keepalive: true }
          )
            .then((result) => {
              activeConsultationSessionIdRef.current = result.consultationSessionId || null;
              addPendingConsultationSessionId(result.consultationSessionId);
            })
            .catch((trackingError) => {
              console.error('Error tracking patient leave:', trackingError);
            });
        } else if (activeConsultationSessionIdRef.current) {
          addPendingConsultationSessionId(activeConsultationSessionIdRef.current);
        }
      }

      activeConsultationSessionIdRef.current = null;
      trackedJoinKeyRef.current = null;
      validationResultRef.current = null;

      if (redirectAfterExit) {
        router.push(getPostCallRedirectPath());
      }
    },
    [getPostCallRedirectPath, invitationEmail, markWaitingEntryLeftWithBeacon, router, user?.email, user?.uid]
  );

  const handleConsultationExit = useCallback(() => {
    finalizeConsultationExit(true);
  }, [finalizeConsultationExit]);

  useEffect(() => {
    finalizeConsultationExitRef.current = finalizeConsultationExit;
  }, [finalizeConsultationExit]);

  useEffect(() => {
    const handleBrowserExit = () => {
      finalizeConsultationExitRef.current(false);
    };

    window.addEventListener('beforeunload', handleBrowserExit);
    window.addEventListener('pagehide', handleBrowserExit);
    window.addEventListener('popstate', handleBrowserExit);

    return () => {
      window.removeEventListener('beforeunload', handleBrowserExit);
      window.removeEventListener('pagehide', handleBrowserExit);
      window.removeEventListener('popstate', handleBrowserExit);
    };
  }, []);

  useEffect(() => {
    return () => {
      finalizeConsultationExitRef.current(false);
    };
  }, []);

  // Handle registration requirement
  if (requiresRegistration) {
    return (
      <PatientRegistration
        invitationEmail={invitationEmail}
        onRegistrationComplete={async (registeredEmail: string) => {
          // After registration, re-validate the invitation
          if (!deviceFingerprint) return;
          
          try {
            setIsValidating(true);
            setRequiresRegistration(false);
            setError(null);

            const request: ValidateInvitationRequest = {
              token,
              deviceFingerprint,
              userEmail: registeredEmail,
            };

            const response = await fetch('/api/invite/validate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(request),
            });

            const result: ValidateInvitationResponse = await response.json();

            if (result.success) {
              setValidationResult(result);
            } else {
              setError(result.error || 'Validation failed after registration');
            }
          } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error validating invitation after registration:', err);
          } finally {
            setIsValidating(false);
          }
        }}
      />
    );
  }

  // Handle validation errors
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#fef2f2',
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
          maxWidth: '32rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            backgroundColor: '#fecaca',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
              <span style={{ fontSize: '2.5rem', color: '#dc2626' }}>X</span>
          </div>

          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#dc2626',
            marginBottom: '1rem'
          }}>
            Access Denied
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            {error}
          </p>

          <button
            onClick={() => router.push('/')}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isValidating) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#eff6ff',
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
            Validating Invitation...
          </h2>
          <p style={{ color: '#2563eb', marginTop: '0.5rem' }}>
            Please wait while we verify your access
          </p>
        </div>
      </div>
    );
  }

  // Success - check if waiting room or direct access
  if (validationResult && validationResult.liveKitToken && validationResult.roomName) {
    // If waiting room enabled, show waiting room UI
    if (validationResult.waitingRoomEnabled && validationResult.waitingRoomToken) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#eff6ff',
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
            maxWidth: '32rem',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '5rem',
              height: '5rem',
              backgroundColor: '#dbeafe',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}>
              <span style={{ fontSize: '2.5rem' }}>WAIT</span>
            </div>

            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: '#1e40af',
              marginBottom: '1rem'
            }}>
              You&apos;re in the Waiting Room
            </h1>

            <p style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              Please wait while the doctor admits you to the consultation. This page will automatically update when you&apos;re admitted.
            </p>

            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '2rem'
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: '#1e40af',
                margin: 0
              }}>
                <strong>Tip:</strong> Keep this page open. You&apos;ll automatically join the consultation when the doctor admits you.
              </p>
            </div>

            <div style={{
              display: 'inline-block',
              width: '3rem',
              height: '3rem',
              border: '3px solid #dbeafe',
              borderTop: '3px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '1rem'
            }}></div>

            <p style={{
              fontSize: '0.875rem',
              color: '#9ca3af',
              marginTop: '1rem'
            }}>
              Waiting for doctor to admit you...
            </p>

            <WaitingRoomView 
              validationResult={validationResult} 
              invitationEmail={invitationEmail}
              setValidationResult={setValidationResult}
              setError={setError}
            />

            {/* Hidden LiveKit connection for waiting room - patients can see each other */}
            {allowLiveKitMount && (
              <div style={{ display: 'none' }}>
                <PatientLiveKitRoom
                  token={validationResult.liveKitToken}
                  onDisconnected={() => {
                    console.log('Patient disconnected from waiting room');
                    router.push('/');
                  }}
                  onError={(error) => {
                    console.error('Waiting room error:', error);
                  }}
                />
              </div>
            )}
            {disableLiveKitForE2E && (
              <p
                data-testid="e2e-livekit-disabled"
                style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}
              >
                LiveKit connection disabled for E2E lifecycle testing.
              </p>
            )}

            <style jsx>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
          </div>
        </div>
      );
    }

    // Direct access to consultation room (no waiting room)
    if (disableLiveKitForE2E) {
      return (
        <div
          data-testid="e2e-consultation-placeholder"
          style={{
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            LiveKit connection disabled for E2E lifecycle testing.
          </p>
          <button
            onClick={handleConsultationExit}
            style={{
              backgroundColor: '#1d4ed8',
              color: '#fff',
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Leave Consultation
          </button>
        </div>
      );
    }

    if (!allowLiveKitMount) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.95rem',
          }}
        >
          Preparing consultation...
        </div>
      );
    }

    return (
      <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
        <PatientLiveKitRoom
          token={validationResult.liveKitToken}
          onDisconnected={() => {
            console.log('Patient disconnected from consultation');
            handleConsultationExit();
          }}
          onError={(error) => {
            console.error('LiveKit error:', error);
            // Only set error for critical errors, not permission warnings
            if (error && typeof error === 'object' && 'message' in error) {
              const errorMessage = (error as any).message || '';
              // Filter out common non-critical errors that don't prevent connection
              if (!errorMessage.includes('NotReadableError') && 
                  !errorMessage.includes('Permission denied') &&
                  !errorMessage.includes('Could not start video source') &&
                  !errorMessage.includes('Client initiated disconnect')) {
                setError('Connection error. Please try again.');
              } else {
                console.warn('LiveKit permission/connection warning (non-critical):', errorMessage);
              }
            } else {
              // For non-object errors, be more conservative
              const errorStr = String(error);
              if (!errorStr.includes('NotReadableError') && !errorStr.includes('Permission')) {
                setError('Connection error. Please try again.');
              }
            }
          }}
          onLeaveClick={handleConsultationExit}
        />

        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Fallback
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fef2f2',
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
        maxWidth: '32rem',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: '#dc2626',
          marginBottom: '1rem'
        }}>
          Invalid Invitation
        </h1>

        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          This invitation link is invalid or has expired.
        </p>

        <button
          onClick={() => router.push('/')}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#eff6ff',
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
            Loading Invitation...
          </h2>
        </div>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  );
}


