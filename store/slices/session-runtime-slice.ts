import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type SessionLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SessionRuntimeEntry {
  consultationSessionId: string | null;
  roomName: string;
  status: SessionLoadStatus;
  fetchedAtMs: number | null;
  error: string | null;
}

export interface SessionRuntimeState {
  byRoomName: Record<string, SessionRuntimeEntry>;
}

interface SetSessionLoadingPayload {
  roomName: string;
}

interface SetSessionReadyPayload {
  roomName: string;
  consultationSessionId: string | null;
  fetchedAtMs?: number;
}

interface SetSessionErrorPayload {
  roomName: string;
  error: string;
}

const initialState: SessionRuntimeState = {
  byRoomName: {},
};

function getOrCreateEntry(
  state: SessionRuntimeState,
  roomName: string
): SessionRuntimeEntry {
  const existing = state.byRoomName[roomName];
  if (existing) {
    return existing;
  }

  const nextEntry: SessionRuntimeEntry = {
    consultationSessionId: null,
    roomName,
    status: 'idle',
    fetchedAtMs: null,
    error: null,
  };
  state.byRoomName[roomName] = nextEntry;
  return nextEntry;
}

const sessionRuntimeSlice = createSlice({
  name: 'sessionRuntime',
  initialState,
  reducers: {
    setSessionLoading(state, action: PayloadAction<SetSessionLoadingPayload>) {
      const entry = getOrCreateEntry(state, action.payload.roomName);
      entry.status = 'loading';
      entry.error = null;
    },
    setSessionReady(state, action: PayloadAction<SetSessionReadyPayload>) {
      const entry = getOrCreateEntry(state, action.payload.roomName);
      entry.consultationSessionId = action.payload.consultationSessionId;
      entry.status = 'ready';
      entry.fetchedAtMs = action.payload.fetchedAtMs ?? Date.now();
      entry.error = null;
    },
    setSessionError(state, action: PayloadAction<SetSessionErrorPayload>) {
      const entry = getOrCreateEntry(state, action.payload.roomName);
      entry.status = 'error';
      entry.error = action.payload.error;
    },
    clearSession(state, action: PayloadAction<{ roomName: string }>) {
      delete state.byRoomName[action.payload.roomName];
    },
  },
});

export const { setSessionLoading, setSessionReady, setSessionError, clearSession } =
  sessionRuntimeSlice.actions;
export default sessionRuntimeSlice.reducer;
