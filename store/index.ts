import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from 'firebase/auth';
import { Room, RemoteParticipant, LocalParticipant } from 'livekit-client';

// Auth State
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  } as AuthState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    signOut: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
});

// Video Call State
interface VideoCallState {
  room: any | null; // Use any to avoid Immer/LiveKit type conflicts
  participants: any[]; // Use any to avoid Immer/LiveKit type conflicts
  localParticipant: any | null; // Use any to avoid Immer/LiveKit type conflicts
  isConnected: boolean;
  isConnecting: boolean;
  token: string | null;
  tokenError: string | null;
  isJoining: boolean;
  roomName: string | null;
}

const videoCallSlice = createSlice({
  name: 'videoCall',
  initialState: {
    room: null,
    participants: [],
    localParticipant: null,
    isConnected: false,
    isConnecting: false,
    token: null,
    tokenError: null,
    isJoining: false,
    roomName: null,
  } as VideoCallState,
  reducers: {
    setRoom: (state, action: PayloadAction<any | null>) => {
      state.room = action.payload;
    },
    setParticipants: (state, action: PayloadAction<any[]>) => {
      state.participants = action.payload;
    },
    setLocalParticipant: (state, action: PayloadAction<any | null>) => {
      state.localParticipant = action.payload;
    },
    setIsConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setIsConnecting: (state, action: PayloadAction<boolean>) => {
      state.isConnecting = action.payload;
    },
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
    },
    setTokenError: (state, action: PayloadAction<string | null>) => {
      state.tokenError = action.payload;
    },
    setIsJoining: (state, action: PayloadAction<boolean>) => {
      state.isJoining = action.payload;
    },
    setRoomName: (state, action: PayloadAction<string | null>) => {
      state.roomName = action.payload;
    },
    resetCallState: (state) => {
      state.room = null;
      state.participants = [];
      state.localParticipant = null;
      state.isConnected = false;
      state.isConnecting = false;
      state.token = null;
      state.tokenError = null;
      state.isJoining = false;
      state.roomName = null;
    },
  },
});

// Transcription State
interface TranscriptionState {
  transcription: string[];
  manualNotes: string[];
  speechRecognitionStatus: 'idle' | 'listening' | 'error';
  isTranscribing: boolean;
  isThrottled: boolean;
  restartCount: number;
  lastTranscriptionUpdate: Date | null;
}

const transcriptionSlice = createSlice({
  name: 'transcription',
  initialState: {
    transcription: [],
    manualNotes: [],
    speechRecognitionStatus: 'idle',
    isTranscribing: false,
    isThrottled: false,
    restartCount: 0,
    lastTranscriptionUpdate: null,
  } as TranscriptionState,
  reducers: {
    setTranscription: (state, action: PayloadAction<string[]>) => {
      state.transcription = action.payload;
    },
    addTranscriptionEntry: (state, action: PayloadAction<string>) => {
      state.transcription.push(action.payload);
      state.lastTranscriptionUpdate = new Date();
    },
    setManualNotes: (state, action: PayloadAction<string[]>) => {
      state.manualNotes = action.payload;
    },
    addManualNote: (state, action: PayloadAction<string>) => {
      state.manualNotes.push(action.payload);
      state.lastTranscriptionUpdate = new Date();
    },
    setSpeechRecognitionStatus: (state, action: PayloadAction<'idle' | 'listening' | 'error'>) => {
      state.speechRecognitionStatus = action.payload;
    },
    setIsTranscribing: (state, action: PayloadAction<boolean>) => {
      state.isTranscribing = action.payload;
    },
    setIsThrottled: (state, action: PayloadAction<boolean>) => {
      state.isThrottled = action.payload;
    },
    setRestartCount: (state, action: PayloadAction<number>) => {
      state.restartCount = action.payload;
    },
    setLastTranscriptionUpdate: (state, action: PayloadAction<Date | null>) => {
      state.lastTranscriptionUpdate = action.payload;
    },
    resetTranscriptionState: (state) => {
      state.transcription = [];
      state.manualNotes = [];
      state.speechRecognitionStatus = 'idle';
      state.isTranscribing = false;
      state.isThrottled = false;
      state.restartCount = 0;
      state.lastTranscriptionUpdate = null;
    },
  },
});

// UI State
interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  isMobile: boolean;
  showNotifications: boolean;
  currentView: 'dashboard' | 'room' | 'settings' | 'invitations';
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: 'system',
    sidebarOpen: true,
    isMobile: false,
    showNotifications: true,
    currentView: 'dashboard',
  } as UIState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setIsMobile: (state, action: PayloadAction<boolean>) => {
      state.isMobile = action.payload;
    },
    setShowNotifications: (state, action: PayloadAction<boolean>) => {
      state.showNotifications = action.payload;
    },
    setCurrentView: (state, action: PayloadAction<'dashboard' | 'room' | 'settings' | 'invitations'>) => {
      state.currentView = action.payload;
    },
  },
});

// Room Management State
interface RoomManagementState {
  ownedRooms: string[];
  isCreatingRoom: boolean;
  roomCreationError: string | null;
  currentRoom: string | null;
}

const roomManagementSlice = createSlice({
  name: 'roomManagement',
  initialState: {
    ownedRooms: [],
    isCreatingRoom: false,
    roomCreationError: null,
    currentRoom: null,
  } as RoomManagementState,
  reducers: {
    setOwnedRooms: (state, action: PayloadAction<string[]>) => {
      state.ownedRooms = action.payload;
    },
    addOwnedRoom: (state, action: PayloadAction<string>) => {
      state.ownedRooms.push(action.payload);
    },
    removeOwnedRoom: (state, action: PayloadAction<string>) => {
      state.ownedRooms = state.ownedRooms.filter(room => room !== action.payload);
    },
    setIsCreatingRoom: (state, action: PayloadAction<boolean>) => {
      state.isCreatingRoom = action.payload;
    },
    setRoomCreationError: (state, action: PayloadAction<string | null>) => {
      state.roomCreationError = action.payload;
    },
    setCurrentRoom: (state, action: PayloadAction<string | null>) => {
      state.currentRoom = action.payload;
    },
  },
});

// Configure store
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    videoCall: videoCallSlice.reducer,
    transcription: transcriptionSlice.reducer,
    ui: uiSlice.reducer,
    roomManagement: roomManagementSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

// Export actions
export const authActions = authSlice.actions;
export const videoCallActions = videoCallSlice.actions;
export const transcriptionActions = transcriptionSlice.actions;
export const uiActions = uiSlice.actions;
export const roomManagementActions = roomManagementSlice.actions;

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectVideoCall = (state: RootState) => state.videoCall;
export const selectTranscription = (state: RootState) => state.transcription;
export const selectUI = (state: RootState) => state.ui;
export const selectRoomManagement = (state: RootState) => state.roomManagement;
