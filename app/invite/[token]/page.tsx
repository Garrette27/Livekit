'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import PatientRegistration from '@/components/PatientRegistration';
import { 
  ValidateInvitationRequest, 
  ValidateInvitationResponse, 
  DeviceFingerprint 
} from '@/lib/types';

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
            />

            {/* Hidden LiveKit connection for waiting room - patients can see each other */}
            <div style={{ display: 'none' }}>
              <LiveKitRoom
                token={validationResult.liveKitToken}
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
                connect={true}
                audio={false}
                video={false}
                onDisconnected={() => {
                  console.log('Patient disconnected from waiting room');
                  router.push('/');
                }}
                onError={(error) => {
                  console.error('Waiting room error:', error);
                }}
              >
                <VideoConference />
              </LiveKitRoom>
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
        <LiveKitRoom
          token={validationResult.liveKitToken}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
          connect={true}
          audio
          video
          style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
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
            setError('Connection error. Please try again.');
          }}
        >
          <VideoConference />
          
          {/* Back to Home Button */}
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
              onClick={() => router.push('/')}
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
        </LiveKitRoom>

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
