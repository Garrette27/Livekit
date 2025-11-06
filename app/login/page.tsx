"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Force dynamic rendering to prevent build-time Firebase errors
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to doctor login (maintain backward compatibility)
    router.replace('/doctor/login');
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="text-gray-600 mb-4">Please wait...</p>
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}
