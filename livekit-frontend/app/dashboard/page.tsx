"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import Link from "next/link";

export default function DashboardPage() {
  const [user] = useAuthState(auth);
  if (!user) return <p>Loading...</p>;

  const waitingRoomLink = `${window.location.origin}/room/${user.uid}`;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Welcome, {user.displayName}</h1>
        <button
          onClick={() => signOut(auth)}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold text-lg mb-2">Your Waiting Room Link:</h2>
        <p className="text-blue-600 underline">{waitingRoomLink}</p>
        <Link
          href={`/room/${user.uid}`}
          className="inline-block mt-4 bg-green-600 text-white px-4 py-2 rounded"
        >
          Join Your Room
        </Link>
      </div>
    </div>
  );
}
