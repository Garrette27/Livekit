"use client";

import { useState } from "react";

export default function PasswordResetDebugPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkUserStatus = async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/password-reset?email=${encodeURIComponent(email.trim())}`);
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to check user status');
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Password Reset Diagnostic Tool
        </h1>
        
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          This tool helps diagnose password reset issues by checking user status in Firebase Auth.
        </p>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Email Address
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                fontSize: '1rem'
              }}
            />
            <button
              onClick={checkUserStatus}
              disabled={loading || !email.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: loading || !email.trim() ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '1rem',
            borderRadius: '0.25rem',
            marginBottom: '1rem'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            padding: '1rem',
            borderRadius: '0.25rem',
            marginTop: '1rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              User Status
            </h2>
            <pre style={{
              backgroundColor: 'white',
              padding: '1rem',
              borderRadius: '0.25rem',
              overflow: 'auto',
              fontSize: '0.875rem',
              lineHeight: '1.5'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '0.25rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Common Issues and Solutions:
          </h3>
          <ul style={{ marginLeft: '1.5rem', color: '#92400e', lineHeight: '1.8' }}>
            <li><strong>User not found:</strong> The email is not registered in Firebase Auth. User needs to sign up first.</li>
            <li><strong>No password provider:</strong> Account was created with Google Sign-In. User should use Google Sign-In instead.</li>
            <li><strong>Email not sent:</strong> Check Firebase Console → Authentication → Templates → Password reset to ensure email template is configured.</li>
            <li><strong>Email/Password not enabled:</strong> Go to Firebase Console → Authentication → Sign-in method and enable Email/Password provider.</li>
          </ul>
        </div>

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.25rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Next Steps:
          </h3>
          <ol style={{ marginLeft: '1.5rem', color: '#166534', lineHeight: '1.8' }}>
            <li>Check if user exists in Firebase Auth</li>
            <li>Verify user has email/password provider (not just Google)</li>
            <li>Check Firebase Console email template configuration</li>
            <li>Verify Email/Password sign-in method is enabled</li>
            <li>Check spam folder if email is being sent but not received</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

