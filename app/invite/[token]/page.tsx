'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
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

  // Success - show video interface
  if (validationResult && validationResult.liveKitToken && validationResult.roomName) {
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
            console.log('Disconnected from room');
            router.push('/');
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
