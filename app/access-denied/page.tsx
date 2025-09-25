'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function AccessDeniedContent() {
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const reasonParam = searchParams.get('reason');
    setReason(reasonParam || 'unknown');

    // Set details based on reason
    switch (reasonParam) {
      case 'invalid-link':
        setDetails('The invitation link is invalid or malformed.');
        break;
      case 'invalid-token':
        setDetails('The invitation token is invalid or corrupted.');
        break;
      case 'direct-access':
        setDetails('Direct access to patient rooms is not allowed. Please use the invitation link provided by your doctor.');
        break;
      case 'expired':
        setDetails('This invitation has expired. Please contact your doctor for a new invitation.');
        break;
      case 'already-used':
        setDetails('This invitation has already been used. Each invitation can only be used once.');
        break;
      case 'wrong-email':
        setDetails('This invitation is not valid for your email address.');
        break;
      case 'wrong-country':
        setDetails('This invitation is not valid for your current location.');
        break;
      case 'wrong-browser':
        setDetails('This invitation requires a different web browser.');
        break;
      case 'wrong-device':
        setDetails('This invitation is bound to a different device.');
        break;
      default:
        setDetails('Access to this consultation room has been denied.');
    }
  }, [searchParams, reason]);

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
        {/* Error Icon */}
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

        {/* Title */}
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: '#dc2626',
          marginBottom: '1rem'
        }}>
          Access Denied
        </h1>

        {/* Details */}
        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          {details}
        </p>

        {/* Reason Code */}
        {reason && reason !== 'unknown' && (
          <div style={{
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '2rem'
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: '0'
            }}>
              <strong>Reason:</strong> {reason.replace('-', ' ').toUpperCase()}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              textDecoration: 'none',
              fontSize: '1rem',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            Return to Home
          </Link>

          <button
            onClick={() => window.history.back()}
            style={{
              backgroundColor: 'transparent',
              color: '#6b7280',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            Go Back
          </button>
        </div>

        {/* Help Text */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '0.5rem'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: '#0369a1',
            margin: '0',
            lineHeight: '1.5'
          }}>
            <strong>Need help?</strong> Contact your doctor or healthcare provider for assistance with accessing your consultation.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={
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
      </div>
    }>
      <AccessDeniedContent />
    </Suspense>
  );
}
