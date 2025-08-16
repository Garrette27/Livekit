// livekit-frontend/app/page.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

export default function Page() {
  const [user, setUser] = useState<any>(null);
  const [roomName, setRoomName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const provider = useMemo(() => new GoogleAuthProvider(), []);

  async function login() {
    await signInWithPopup(auth, provider);
  }
  async function logout() {
    await signOut(auth);
    setToken(null);
  }

  async function createOrJoinRoom() {
    if (!user) return alert('Please sign in');
    if (!roomName) return alert('Enter room name');

    const identity = user.displayName || user.email || user.uid;

    // create a call doc (id = roomName)
    const callsRef = collection(db, 'calls');
    await setDoc(doc(callsRef, roomName), {
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      status: 'active',
    }, { merge: true });

    // generate token from our Next.js server route
    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, identity }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Failed to get token');

    setToken(data.token);
    setShareUrl(`${window.location.origin}/room/${encodeURIComponent(roomName)}`);
  }

  async function onDisconnected() {
    setToken(null);
    if (roomName) {
      await updateDoc(doc(db, 'calls', roomName), { status: 'ended', endedAt: serverTimestamp() });
    }
  }

  // Signed-out view
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2">Telehealth Console</h1>
          <p className="text-sm text-gray-600 mb-6">Sign in to create rooms and invite patients.</p>
          <button onClick={login} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium">Sign in with Google</button>
        </div>
      </div>
    );
  }

  // Pre-join view
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-2xl shadow p-8 w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm text-gray-500">Signed in as</div>
              <div className="font-semibold">{user.displayName || user.email}</div>
            </div>
            <button onClick={logout} className="text-red-600 text-sm">Sign out</button>
          </div>

          <label className="block text-sm font-medium mb-1">Room name</label>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g. dr-smith-aug15"
            className="border w-full rounded-xl px-3 py-2 mb-4"
          />
          <button onClick={createOrJoinRoom} className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white py-3 font-medium">Create & Join</button>

          {shareUrl && (
            <div className="mt-6 p-4 border rounded-xl bg-gray-50">
              <div className="text-sm text-gray-600 mb-2">Patient link</div>
              <div className="font-mono text-sm break-all">{shareUrl}</div>
              <button
                className="mt-3 text-blue-600 text-sm"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >Copy link</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // In-call view (doxy.me–style via VideoConference)
  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect
      audio
      video
      onDisconnected={onDisconnected}
      className="min-h-screen"
    >
      <VideoConference />
    </LiveKitRoom>
  );
}