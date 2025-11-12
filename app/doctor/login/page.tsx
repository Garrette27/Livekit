"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, query, where, getDocs, collection } from "firebase/firestore";

export const dynamic = 'force-dynamic';

export default function DoctorLoginPage() {
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (auth && provider) {
      setIsFirebaseReady(true);
    } else {
      console.warn('Firebase not initialized');
    }
  }, []);

  const signInWithGoogle = async () => {
    if (!auth || !provider) {
      setError('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      setError(null);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Auto-register doctor if first login
      if (user && db) {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          // First login - create doctor profile
          await setDoc(userRef, {
            email: user.email,
            role: 'doctor',
            doctorName: user.displayName || 'Dr. ' + (user.email?.split('@')[0] || 'User'),
            doctorEmail: user.email,
            registeredAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
          console.log('Doctor profile created');
        } else {
          // Update last login
          await setDoc(userRef, { 
            lastLoginAt: serverTimestamp() 
          }, { merge: true });
        }
      }

      // Redirect to doctor dashboard
      router.push('/doctor/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Login error:', err.message);
        setError('Failed to sign in. Please try again.');
      } else {
        console.error('Login error:', err);
        setError('An unexpected error occurred.');
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
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
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            setError('This email is already registered. Please sign in instead.');
            setIsSignUp(false);
            setLoading(false);
            return;
          }
          throw authError;
        }

        const user = userCredential.user;

        // Now that user is authenticated, check if user document exists
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role !== 'doctor') {
              setError('This email is registered as a patient. Please use patient login.');
              // Sign out and clean up
              await auth.signOut();
              setLoading(false);
              return;
            }
            // User document already exists, just redirect
            router.push('/doctor/dashboard');
            return;
          }

          // Create doctor profile - user is now authenticated so Firestore rules allow this
          await setDoc(doc(db, 'users', user.uid), {
            email: email.toLowerCase().trim(),
            role: 'doctor',
            doctorName: 'Dr. ' + (email.split('@')[0] || 'User'),
            doctorEmail: email.toLowerCase().trim(),
            registeredAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });

          console.log('Doctor profile created successfully');
          router.push('/doctor/dashboard');
        } catch (firestoreError: any) {
          console.error('Firestore error during sign-up:', {
            code: firestoreError.code,
            message: firestoreError.message,
            uid: user.uid,
            email: email
          });
          
          // Sign out on Firestore error
          try {
            await auth.signOut();
          } catch (signOutError) {
            console.error('Error signing out after Firestore failure:', signOutError);
          }
          
          if (firestoreError.code === 'permission-denied') {
            setError('Permission denied. Please contact support or try signing in with Google.');
          } else {
            setError('Failed to create account. Please try again or contact support.');
          }
          setLoading(false);
          return;
        }
      } else {
        // Sign in
        await signInWithEmailAndPassword(auth, email, password);
        
        // Check user role
        const user = auth.currentUser;
        if (user && db) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'doctor') {
              // Update last login
              await setDoc(doc(db, 'users', user.uid), { 
                lastLoginAt: serverTimestamp() 
              }, { merge: true });
              router.push('/doctor/dashboard');
            } else {
              setError('This account is for patients. Please use patient login.');
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
        setError('Email/password authentication is not enabled. Please contact support or use Google sign in.');
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
        url: `${window.location.origin}/doctor/login?mode=resetPassword&oobCode=`,
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

  if (!isFirebaseReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded shadow-md text-center">
          <h1 className="text-2xl font-bold mb-4">Doctor Login</h1>
          <p className="text-gray-600 mb-4">Loading...</p>
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f9ff',
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
          width: '5rem',
          height: '5rem',
          backgroundColor: '#dbeafe',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem'
        }}>
          <span style={{ fontSize: '2.5rem' }}>🩺</span>
        </div>

        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: '#1e40af',
          marginBottom: '0.5rem'
        }}>
          Doctor Login
        </h1>
        <p style={{
          color: '#6b7280',
          marginBottom: '2rem',
          fontSize: '0.875rem'
        }}>
          Sign in to access your doctor dashboard
        </p>

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
              backgroundColor: loginMethod === 'google' ? '#2563eb' : 'transparent',
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
              backgroundColor: loginMethod === 'email' ? '#2563eb' : 'transparent',
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
          <>
            <button
              onClick={signInWithGoogle}
              style={{
                width: '100%',
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </>
        ) : (
          <form onSubmit={showForgotPassword ? handleForgotPassword : handleEmailLogin}>
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
                placeholder="doctor@example.com"
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
                      color: '#2563eb',
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
                    backgroundColor: '#dbeafe',
                    border: '1px solid #bfdbfe',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0, lineHeight: '1.5' }}>
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
                        color: '#2563eb',
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
                  backgroundColor: resetLoading || !email.trim() ? '#9ca3af' : '#2563eb',
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
                  backgroundColor: loading || (showForgotPassword && resetEmailSent) ? '#9ca3af' : '#2563eb',
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

        {loginMethod === 'email' && !showForgotPassword && (
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
                color: '#2563eb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textDecoration: 'underline'
              }}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        )}

        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: '#9ca3af'
        }}>
          For healthcare professionals only
        </p>

        {/* Cross-navigation link to patient login */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '0.5rem'
          }}>
            Are you a patient?
          </p>
          <a
            href="/patient/login"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Go to Patient Login →
          </a>
        </div>
      </div>
    </div>
  );
}

