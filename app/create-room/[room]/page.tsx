import CreateRoomClient from './CreateRoomClient';

export default async function CreateRoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  
  return <CreateRoomClient room={room} />;
}
