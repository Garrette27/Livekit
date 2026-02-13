import { getRoomSessionPolicy, RoomGridPolicy } from './room-session-policy';

export type { RoomGridPolicy };

export const DOCTOR_ROOM_GRID: RoomGridPolicy = getRoomSessionPolicy('doctor').grid;

export const PATIENT_ROOM_GRID: RoomGridPolicy = getRoomSessionPolicy('patient').grid;
