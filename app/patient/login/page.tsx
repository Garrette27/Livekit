"use client";

import { useState, useEffect, Suspense } from "react";
import { auth, db, provider } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup } from "firebase/auth";
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
  const [loginMethod, setLoginMethod] = useState<'email' | 'google'>('email');
  const [googleLoading, setGoogleLoading] = useState(false);
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
        // Create new Firebase Auth account first
        // Firebase Auth will throw an error if email already exists
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            setError('This email is already registered. Please sign in instead.');
            setIsSignUp(false);
            setLoading(false);
            // Don't return - try to sign in instead
            // Fall through to sign-in logic below
            return;
          }
          throw authError;
        }
        
        const user = userCredential.user;

        // Now that user is authenticated, create user document in Firestore
        try {
          // Create new patient profile
          // Use setDoc without merge to ensure it's a create operation
          await setDoc(doc(db, 'users', user.uid), {
            email: email.toLowerCase().trim(),
            role: 'patient',
            registeredAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            consentGiven: false, // Will be given when accessing invitation
          });
          
          console.log('User document created successfully:', user.uid);
        } catch (firestoreError: any) {
          console.error('Firestore error during sign-up:', {
            code: firestoreError.code,
            message: firestoreError.message,
            uid: user.uid,
            email: email
          });
          
          // If Firestore write fails, try to clean up Auth account
          try {
            await auth.signOut();
            // Note: We can't delete the Auth account from client-side
            // The user will need to use password reset or contact support
          } catch (signOutError) {
            console.error('Error signing out after Firestore failure:', signOutError);
          }
          
          if (firestoreError.code === 'permission-denied') {
            setError('Permission denied. The security rules may not be deployed yet. Please wait a moment and try again, or contact support.');
          } else if (firestoreError.code === 'failed-precondition') {
            setError('Account creation failed. Please try again.');
          } else {
            setError(`Failed to create account: ${firestoreError.message || 'Unknown error'}. Please try again or contact support.`);
          }
          setLoading(false);
          return;
        }

        // Use window.location for more reliable navigation after sign-up
        window.location.href = '/patient/dashboard';
      } else {
        // Sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check user role and create document if missing
        if (user && db) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'patient') {
              // Use window.location for more reliable navigation
              window.location.href = '/patient/dashboard';
            } else {
              setError('This account is for doctors. Please use doctor login.');
              if (auth) {
                await auth.signOut();
              }
            }
          } else {
            // User document doesn't exist - create it
            // This can happen if sign-up partially failed or user was created via Google
            try {
              await setDoc(doc(db, 'users', user.uid), {
                email: email.toLowerCase().trim(),
                role: 'patient',
                registeredAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                consentGiven: false,
              });
              // Use window.location for more reliable navigation
              window.location.href = '/patient/dashboard';
            } catch (firestoreError: any) {
              console.error('Error creating user document during sign-in:', firestoreError);
              setError('Account found but profile setup failed. Please try again or contact support.');
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
        setError('This account was created with Google Sign-In only. Password reset is not available. Please use the "Sign in with Google" button to access your account. After signing in, you can set a password for future use in your account settings.');
        setResetLoading(false);
        setShowForgotPassword(false);
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

  const handleGoogleSignIn = async () => {
    if (!auth || !provider) {
      setError('System not ready. Please refresh the page.');
      return;
    }

    setError(null);
    setGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user && db) {
        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'patient') {
            window.location.href = '/patient/dashboard';
          } else {
            setError('This account is for doctors. Please use doctor login.');
            await auth.signOut();
          }
        } else {
          // Create new patient profile for Google sign-in
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email?.toLowerCase().trim() || '',
            role: 'patient',
            registeredAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            consentGiven: false,
          });
          window.location.href = '/patient/dashboard';
        }
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email. Please use email/password to sign in.');
      } else {
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
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

        {/* Login Method Toggle */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '0.25rem'
        }}>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('google');
              setError(null);
              setShowForgotPassword(false);
              setResetEmailSent(false);
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: loginMethod === 'google' ? '#059669' : 'transparent',
              color: loginMethod === 'google' ? 'white' : '#6b7280',
              fontWeight: loginMethod === 'google' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'all 0.2s'
            }}
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('email');
              setError(null);
              setShowForgotPassword(false);
              setResetEmailSent(false);
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: loginMethod === 'email' ? '#059669' : 'transparent',
              color: loginMethod === 'email' ? 'white' : '#6b7280',
              fontWeight: loginMethod === 'email' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'all 0.2s'
            }}
          >
            Email
          </button>
        </div>

        {loginMethod === 'google' ? (
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              style={{
                width: '100%',
                backgroundColor: googleLoading ? '#9ca3af' : '#059669',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: googleLoading ? 'not-allowed' : 'pointer',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {googleLoading ? 'Signing in...' : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
            <p style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              textAlign: 'center',
              marginTop: '1rem'
            }}>
              Use your Google account to sign in to your patient dashboard
            </p>
          </div>
        ) : (
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
        )}

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

