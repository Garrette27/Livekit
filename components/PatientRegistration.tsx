'use client';

import { useState, useEffect } from 'react';
import { 
  RegisterUserRequest, 
  RegisterUserResponse,
  DeviceFingerprint
} from '@/lib/types';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface PatientRegistrationProps {
  invitationToken: string;
  invitationEmail: string;
  onRegistrationComplete: (email: string) => void;
}

export default function PatientRegistration({ 
  invitationToken,
  invitationEmail, 
  onRegistrationComplete 
}: PatientRegistrationProps) {
  const { showToast } = useToast();
  const [email, setEmail] = useState(invitationEmail);
  const [phone, setPhone] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprint | null>(null);

  // Generate device fingerprint on mount
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

  const handleRegister = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!consentGiven) {
      setError('You must provide consent to store device information for security purposes');
      return;
    }

    if (!deviceFingerprint) {
      setError('Device information could not be collected. Please refresh the page.');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const request: RegisterUserRequest = {
        invitationToken,
        email: email.trim(),
        phone: phone.trim() || undefined,
        consentGiven: true,
        deviceFingerprint,
      };

      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result: RegisterUserResponse = await response.json();

      if (result.success) {
        // Store registered email in localStorage for post-consultation redirect
        if (typeof window !== 'undefined') {
          localStorage.setItem('patientRegisteredEmail', email.trim());
        }
        showToast({
          kind: 'success',
          title: 'Registration complete',
          message: 'You can now join the consultation room.',
        });
        onRegistrationComplete(email.trim());
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error registering user:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f9ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '1rem',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '32rem',
        width: '100%'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>🔐</span>
          </div>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '0.5rem'
          }}>
            Patient Registration
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#6b7280'
          }}>
            Please register to access your consultation
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            marginBottom: '1.5rem',
            color: '#dc2626',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@example.com"
              required
              disabled={isRegistering}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                backgroundColor: email === invitationEmail ? '#f3f4f6' : 'white'
              }}
            />
            {email === invitationEmail && (
              <p style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                marginTop: '0.25rem'
              }}>
                This email matches your invitation
              </p>
            )}
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              disabled={isRegistering}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{
            padding: '1rem',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.5rem'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                disabled={isRegistering}
                style={{
                  marginTop: '0.25rem',
                  width: '1.25rem',
                  height: '1.25rem',
                  cursor: 'pointer'
                }}
              />
              <div>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1e40af',
                  marginBottom: '0.5rem'
                }}>
                  Consent to Store Device Information *
                </p>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#4b5563',
                  lineHeight: '1.5'
                }}>
                  I consent to the system storing a protected device fingerprint and browser
                  information for invitation security. The complete signed invitation is required
                  to submit this registration.
                </p>
              </div>
            </label>
          </div>
        </div>

        <button
          onClick={handleRegister}
          disabled={isRegistering || !consentGiven || !email.trim()}
          style={{
            width: '100%',
            backgroundColor: isRegistering || !consentGiven || !email.trim() ? '#9ca3af' : '#059669',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: isRegistering || !consentGiven || !email.trim() ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease'
          }}
        >
          {isRegistering ? 'Registering...' : 'Register & Continue'}
        </button>
      </div>
    </div>
  );
}

