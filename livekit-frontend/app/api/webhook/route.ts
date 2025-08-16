import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const event = await req.json();

  if (event.event === 'room_finished') {
    console.log(`Room ${event.room.name} ended`);
    // 🔹 Trigger AI summarization here
    // 🔹 Delete call record in DB
  }

  return NextResponse.json({ received: true });
}
