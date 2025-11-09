"use client";

import { useState, useEffect, Suspense } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp, query, where, getDocs, collection } from "firebase/firestore";

export const dynamic = 'force-dynamic';

function PatientLoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if user just registered
  useEffect(() => {
    const registered = searchParams.get('registered');
    const emailParam = searchParams.get('email');
    if (registered === 'true' && emailParam) {
      setJustRegistered(true);
      setEmail(emailParam);
      setIsSignUp(false); // Show sign-in form, not sign-up
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('patientRegisteredEmail');
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth || !db) {
      setError('System not ready. Please refresh the page.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Check if user exists in users collection with this email
        const usersQuery = query(
          collection(db, 'users'),
          where('email', '==', email.toLowerCase().trim())
        );
        const userDocs = await getDocs(usersQuery);

        if (!userDocs.empty) {
          // User exists, check if they have a password (Firebase Auth account)
          const userData = userDocs.docs[0].data();
          if (userData.role !== 'patient') {
            setError('This email is registered as a doctor. Please use doctor login.');
            setLoading(false);
            return;
          }
          // User exists but might not have Firebase Auth account
          setError('An account with this email already exists. Please sign in instead.');
          setIsSignUp(false);
          setLoading(false);
          return;
        }

        // Check if user already exists in users collection (registered via invitation)
        const existingUserQuery = query(
          collection(db, 'users'),
          where('email', '==', email.toLowerCase().trim())
        );
        const existingDocs = await getDocs(existingUserQuery);

        // Create new Firebase Auth account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!existingDocs.empty) {
          // User already registered via invitation, just link Firebase Auth account
          const existingUserDoc = existingDocs.docs[0];
          await setDoc(doc(db, 'users', user.uid), {
            ...existingUserDoc.data(),
            // Keep existing consent and device info
          }, { merge: true });
          // Also update the old document to point to new UID if needed
        } else {
          // Create new patient profile
          await setDoc(doc(db, 'users', user.uid), {
            email: email.toLowerCase().trim(),
            role: 'patient',
            registeredAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            consentGiven: false, // Will be given when accessing invitation
          });
        }

        router.push('/patient/dashboard');
      } else {
        // Sign in
        await signInWithEmailAndPassword(auth, email, password);
        
        // Check user role
        const user = auth.currentUser;
        if (user && db) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'patient') {
              router.push('/patient/dashboard');
            } else {
              setError('This account is for doctors. Please use doctor login.');
              if (auth) {
                await auth.signOut();
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please sign up.');
        setIsSignUp(true);
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again or reset your password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in.');
        setIsSignUp(false);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/password authentication is not enabled. Please contact support.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetLoading(true);

    if (!email.trim()) {
      setError('Please enter your email address.');
      setResetLoading(false);
      return;
    }

    if (!auth) {
      setError('System not ready. Please refresh the page.');
      setResetLoading(false);
      return;
    }

    try {
      // First, check user status via API to get better error messages
      const statusResponse = await fetch(`/api/password-reset?email=${encodeURIComponent(email.trim())}`);
      const statusData = await statusResponse.json();

      if (!statusData.exists) {
        setError('No account found with this email address. Please sign up first.');
        setResetLoading(false);
        return;
      }

      if (!statusData.hasPasswordProvider) {
        setError('This account was created with Google Sign-In. Please use Google Sign-In to access your account.');
        setResetLoading(false);
        return;
      }

      // If user exists and has password provider, send reset email
      console.log('Sending password reset email to:', email.trim());
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/patient/login?mode=resetPassword&oobCode=`,
        handleCodeInApp: false,
      });
      
      console.log('Password reset email sent successfully');
      setResetEmailSent(true);
    } catch (err: any) {
      console.error('Password reset error:', {
        code: err.code,
        message: err.message,
        email: email.trim()
      });
      
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address. Please sign up first.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address. Please check and try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Password reset is not enabled. Please contact support or use Google Sign-In.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many password reset requests. Please wait a few minutes and try again.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.message || 'Failed to send password reset email. Please try again or contact support.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0fdf4',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '1rem',
        padding: '3rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '28rem',
        width: '100%'
      }}>
        <div style={{
          width: '5rem',
          height: '5rem',
          backgroundColor: '#dcfce7',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem'
        }}>
          <span style={{ fontSize: '2.5rem' }}>👤</span>
        </div>

        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: '#166534',
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          {isSignUp ? 'Create Patient Account' : 'Patient Login'}
        </h1>
        <p style={{
          color: '#6b7280',
          marginBottom: '2rem',
          fontSize: '0.875rem',
          textAlign: 'center'
        }}>
          {justRegistered 
            ? 'Registration successful! Please sign in to view your consultation history.'
            : isSignUp 
            ? 'Create an account to view your consultation history'
            : 'Sign in to view your consultation history'
          }
        </p>

        {justRegistered && (
          <div style={{
            backgroundColor: '#dcfce7',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#166534', margin: 0, lineHeight: '1.5' }}>
              ✅ <strong>Registration Complete!</strong> You've successfully registered. Please create a password below to sign in and access your consultation dashboard.
            </p>
          </div>
        )}

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

        <form onSubmit={showForgotPassword ? handleForgotPassword : handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="patient@example.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          {!showForgotPassword && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError(null);
                    setResetEmailSent(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!showForgotPassword}
                placeholder="Enter your password"
                minLength={6}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              />
            </div>
          )}

          {showForgotPassword && (
            <div style={{ marginBottom: '1.5rem' }}>
              {resetEmailSent ? (
                <div style={{
                  backgroundColor: '#dcfce7',
                  border: '1px solid #bbf7d0',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <p style={{ fontSize: '0.875rem', color: '#166534', margin: 0, lineHeight: '1.5' }}>
                    ✅ <strong>Password reset email sent!</strong> Please check your inbox at <strong>{email}</strong> and follow the instructions to reset your password.
                  </p>
                </div>
              ) : (
                <>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '1rem',
                    lineHeight: '1.5'
                  }}>
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setError(null);
                      setResetEmailSent(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#059669',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      textDecoration: 'underline',
                      marginBottom: '1rem',
                      padding: 0
                    }}
                  >
                    ← Back to sign in
                  </button>
                </>
              )}
            </div>
          )}

          {showForgotPassword && !resetEmailSent ? (
            <button
              type="submit"
              disabled={resetLoading || !email.trim()}
              style={{
                width: '100%',
                backgroundColor: resetLoading || !email.trim() ? '#9ca3af' : '#059669',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: resetLoading || !email.trim() ? 'not-allowed' : 'pointer',
                marginBottom: '1rem'
              }}
            >
              {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || (showForgotPassword && resetEmailSent)}
              style={{
                width: '100%',
                backgroundColor: loading || (showForgotPassword && resetEmailSent) ? '#9ca3af' : '#059669',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: loading || (showForgotPassword && resetEmailSent) ? 'not-allowed' : 'pointer',
                marginBottom: '1rem'
              }}
            >
              {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          )}
        </form>

        {!showForgotPassword && (
          <div style={{
            textAlign: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setShowForgotPassword(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#059669',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textDecoration: 'underline'
              }}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        )}

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
          color: '#1e40af',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0 }}>
            <strong>Note:</strong> You can also join consultations directly using invitation links from your doctor without signing in.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PatientLoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0fdf4',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            border: '2px solid #dcfce7',
            borderTop: '2px solid #059669',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading...</p>
        </div>
      </div>
    }>
      <PatientLoginContent />
    </Suspense>
  );
}

