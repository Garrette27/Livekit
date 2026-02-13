import { getRoomSessionPolicy, RoomControlsPolicy } from './room-session-policy';

export type { RoomControlsPolicy };

export const DOCTOR_ROOM_CONTROLS: RoomControlsPolicy = getRoomSessionPolicy('doctor').controls;

export const PATIENT_ROOM_CONTROLS: RoomControlsPolicy = getRoomSessionPolicy('patient').controls;
