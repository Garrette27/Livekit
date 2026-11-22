/**
 * Room-name rules shared by every path that lets a doctor claim or join a room.
 *
 * A patient who is not yet admitted receives a LiveKit token for the derived
 * `<room>-waiting` room. That suffix is therefore reserved: if a doctor could
 * claim `drA-room-waiting` as an ordinary room, they would get a publish and
 * subscribe token for another doctor's waiting room and see every queued
 * patient's display name. The check lives here, as a pure function, so the
 * claim and join paths cannot drift apart.
 */
export const WAITING_ROOM_SUFFIX = '-waiting';

/**
 * Upper bound on a claimable room name. Deliberately looser than the 50-char
 * invitation validator so legacy rooms keep working; it only stops unbounded
 * strings reaching Firestore keys and LiveKit token claims.
 */
const MAX_ROOM_NAME_LENGTH = 128;

/** True when `roomName` is the derived waiting room for some consultation room. */
export function isWaitingRoomName(roomName: string): boolean {
  return roomName.trim().toLowerCase().endsWith(WAITING_ROOM_SUFFIX);
}

/**
 * True when a doctor may claim or join `roomName` as their own consultation
 * room: a non-empty, bounded string that is not a reserved waiting room.
 * Unknown input shapes are rejected rather than coerced.
 */
export function isDoctorClaimableRoomName(roomName: unknown): roomName is string {
  return (
    typeof roomName === 'string' &&
    roomName.trim().length > 0 &&
    roomName.length <= MAX_ROOM_NAME_LENGTH &&
    !isWaitingRoomName(roomName)
  );
}
