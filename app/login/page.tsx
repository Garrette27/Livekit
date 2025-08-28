"use client";

import { useState, useEffect } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";

// Force dynamic rendering to prevent build-time Firebase errors
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Firebase is initialized
    if (auth && provider) {
      setIsFirebaseReady(true);
    } else {
      console.warn('Firebase not initialized');
    }
  }, []);

  const signIn = async () => {
    if (!auth || !provider) {
      setError('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      setError(null);
      await signInWithPopup(auth, provider);
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

  // Loading state while Firebase initializes
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
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Doctor Login</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <button
          onClick={signIn}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
