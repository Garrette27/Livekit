import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: Request) {
  const { roomName, participantName } = await req.json();

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: participantName }
  );
  at.addGrant({ roomJoin: true, room: roomName });

  return NextResponse.json({ token: at.toJwt() });
}
