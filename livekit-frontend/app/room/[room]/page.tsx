"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";

export default function RoomPage() {
  const { roomId } = useParams();
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function join() {
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: roomId, participantName: name }),
    });
    const data = await res.json();
    setToken(data.token);
  }

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded shadow w-80">
          <h1 className="text-xl mb-4">Join Room</h1>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="border p-2 w-full mb-4"
          />
          <button
            onClick={join}
            className="bg-blue-600 text-white p-2 rounded w-full"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      video
      audio
      onDisconnected={() => setToken(null)}
      style={{ height: "100vh" }}
    />
  );
}
