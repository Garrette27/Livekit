import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WaitingPatient } from '@/lib/types';

interface WaitingQueueSnapshot {
  waitingPatients: WaitingPatient[];
  waitingPatientCounts: Record<string, number>;
  lastUpdatedAtMs: number | null;
}

export interface WaitingQueueState {
  byScopeKey: Record<string, WaitingQueueSnapshot>;
}

interface SetWaitingQueueSnapshotPayload {
  scopeKey: string;
  waitingPatients: WaitingPatient[];
  waitingPatientCounts: Record<string, number>;
  lastUpdatedAtMs: number;
}

const initialState: WaitingQueueState = {
  byScopeKey: {},
};

const waitingQueueSlice = createSlice({
  name: 'waitingQueue',
  initialState,
  reducers: {
    setWaitingQueueSnapshot(state, action: PayloadAction<SetWaitingQueueSnapshotPayload>) {
      state.byScopeKey[action.payload.scopeKey] = {
        waitingPatients: action.payload.waitingPatients,
        waitingPatientCounts: action.payload.waitingPatientCounts,
        lastUpdatedAtMs: action.payload.lastUpdatedAtMs,
      };
    },
    clearWaitingQueueSnapshot(state, action: PayloadAction<{ scopeKey: string }>) {
      delete state.byScopeKey[action.payload.scopeKey];
    },
  },
});

export const { setWaitingQueueSnapshot, clearWaitingQueueSnapshot } = waitingQueueSlice.actions;
export default waitingQueueSlice.reducer;
