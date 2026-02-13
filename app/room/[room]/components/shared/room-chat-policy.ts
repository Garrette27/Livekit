import { getRoomSessionPolicy, RoomChatPolicy } from './room-session-policy';

export type { RoomChatPolicy };

export const DOCTOR_ROOM_CHAT: RoomChatPolicy = getRoomSessionPolicy('doctor').chat;

export const PATIENT_ROOM_CHAT: RoomChatPolicy = getRoomSessionPolicy('patient').chat;
