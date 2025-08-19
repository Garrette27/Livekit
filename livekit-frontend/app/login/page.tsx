"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";

// Force dynamic rendering to prevent build-time Firebase errors
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const signIn = async () => {
    await signInWithPopup(auth, provider);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Doctor Login</h1>
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
