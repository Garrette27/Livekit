'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PatientLiveKitRoom from './components/PatientLiveKitRoom';
import PatientRegistration from '@/components/PatientRegistration';
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
  setValidationResult: (result: ValidateInvitationResponse) => void;
  setError: (error: string | null) => void;
}) {
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
          }),
        });

        const result = await response.json();

        if (result.success && result.admitted && result.liveKitToken) {
          console.log('✅ Patient admitted! Updating to main consultation room...');
          // Clear any previous errors
          setError(null);
          // Patient has been admitted - update to show consultation room
          setValidationResult({
            ...validationResult,
            liveKitToken: result.liveKitToken,
            roomName: result.roomName,
            waitingRoomEnabled: false,
            waitingRoomToken: false,
          });
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
  }, [validationResult?.invitationId, invitationEmail, validationResult, setValidationResult, setError]);

  return null;
}

function InvitePageContent() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [isValidating, setIsValidating] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidateInvitationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprint | null>(null);
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState<string>('');

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
    if (!token || !deviceFingerprint) return;

    const validateInvitation = async () => {
      try {
        setIsValidating(true);
        setError(null);

        const request: ValidateInvitationRequest = {
          token,
          deviceFingerprint,
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
          // If patient was already admitted (waitingRoomEnabled is false), they should go directly to main room
          // The API now handles this and returns waitingRoomEnabled: false for already-admitted patients
          setValidationResult(result);
          
          // If already admitted, log it for debugging
          if (result.waitingRoomEnabled === false && result.invitationId) {
            console.log('✅ Patient was already admitted, going directly to main room');
          }
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
  }, [token, deviceFingerprint]);

  // Handle registration requirement
  if (requiresRegistration) {
    return (
      <PatientRegistration
        invitationEmail={invitationEmail}
        invitationToken={token}
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
            <span style={{ fontSize: '2.5rem', color: '#dc2626' }}>🚫</span>
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
    // Clear error when we have a valid token and room (patient was admitted)
    if (error && !validationResult.waitingRoomEnabled) {
      // Only clear error if transitioning to main room (not in waiting room)
      setError(null);
    }
    
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
              <span style={{ fontSize: '2.5rem' }}>🚪</span>
            </div>

            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: '#1e40af',
              marginBottom: '1rem'
            }}>
              You're in the Waiting Room
            </h1>

            <p style={{
              fontSize: '1.125rem',
              color: '#6b7280',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              Please wait while the doctor admits you to the consultation. This page will automatically update when you're admitted.
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
                💡 <strong>Tip:</strong> Keep this page open. You'll automatically join the consultation when the doctor admits you.
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
    return (
      <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
        <PatientLiveKitRoom
          token={validationResult.liveKitToken}
          onDisconnected={() => {
            console.log('Patient disconnected from consultation');
            // Redirect to patient dashboard or login page
            // Check if user is registered by checking localStorage or redirect to patient login
            const registeredEmail = localStorage.getItem('patientRegisteredEmail');
            if (registeredEmail) {
              // Patient just registered, guide them to sign in
              router.push('/patient/login?registered=true&email=' + encodeURIComponent(registeredEmail));
            } else {
              // Not registered or no email stored, go to patient login
              router.push('/patient/login');
            }
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
          onLeaveClick={() => router.push('/')}
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
