import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from 'firebase/auth';
import { Room, RemoteParticipant, LocalParticipant } from 'livekit-client';

// Auth Store Interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  signOut: () => void;
}

// Video Call Store Interface
interface VideoCallState {
  room: Room | null;
  participants: RemoteParticipant[];
  localParticipant: LocalParticipant | null;
  isConnected: boolean;
  isConnecting: boolean;
  token: string | null;
  tokenError: string | null;
  isJoining: boolean;
  roomName: string | null;
  
  // Actions
  setRoom: (room: Room | null) => void;
  setParticipants: (participants: RemoteParticipant[]) => void;
  setLocalParticipant: (participant: LocalParticipant | null) => void;
  setIsConnected: (connected: boolean) => void;
  setIsConnecting: (connecting: boolean) => void;
  setToken: (token: string | null) => void;
  setTokenError: (error: string | null) => void;
  setIsJoining: (joining: boolean) => void;
  setRoomName: (name: string | null) => void;
  
  // Reset
  resetCallState: () => void;
}

// Transcription Store Interface
interface TranscriptionState {
  transcription: string[];
  manualNotes: string[];
  speechRecognitionStatus: 'idle' | 'listening' | 'error';
  isTranscribing: boolean;
  isThrottled: boolean;
  restartCount: number;
  lastTranscriptionUpdate: Date | null;
  
  // Actions
  setTranscription: (transcription: string[]) => void;
  addTranscriptionEntry: (entry: string) => void;
  setManualNotes: (notes: string[]) => void;
  addManualNote: (note: string) => void;
  setSpeechRecognitionStatus: (status: 'idle' | 'listening' | 'error') => void;
  setIsTranscribing: (transcribing: boolean) => void;
  setIsThrottled: (throttled: boolean) => void;
  setRestartCount: (count: number) => void;
  setLastTranscriptionUpdate: (date: Date | null) => void;
  
  // Reset
  resetTranscriptionState: () => void;
}

// UI Store Interface
interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  isMobile: boolean;
  showNotifications: boolean;
  currentView: 'dashboard' | 'room' | 'settings' | 'invitations';
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSidebarOpen: (open: boolean) => void;
  setIsMobile: (mobile: boolean) => void;
  setShowNotifications: (show: boolean) => void;
  setCurrentView: (view: 'dashboard' | 'room' | 'settings' | 'invitations') => void;
}

// Room Management Store Interface
interface RoomManagementState {
  ownedRooms: string[];
  isCreatingRoom: boolean;
  roomCreationError: string | null;
  currentRoom: string | null;
  
  // Actions
  setOwnedRooms: (rooms: string[]) => void;
  addOwnedRoom: (roomName: string) => void;
  removeOwnedRoom: (roomName: string) => void;
  setIsCreatingRoom: (creating: boolean) => void;
  setRoomCreationError: (error: string | null) => void;
  setCurrentRoom: (room: string | null) => void;
}

// Create Auth Store
export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: !!user,
          error: null 
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      signOut: () => set({ 
        user: null, 
        isAuthenticated: false,
        error: null 
      }),
    }),
    {
      name: 'auth-store',
    }
  )
);

// Create Video Call Store
export const useVideoCallStore = create<VideoCallState>()(
  devtools(
    (set, get) => ({
      room: null,
      participants: [],
      localParticipant: null,
      isConnected: false,
      isConnecting: false,
      token: null,
      tokenError: null,
      isJoining: false,
      roomName: null,

      setRoom: (room) => set({ room }),

      setParticipants: (participants) => set({ participants }),

      setLocalParticipant: (participant) => set({ localParticipant: participant }),

      setIsConnected: (connected) => set({ isConnected: connected }),

      setIsConnecting: (connecting) => set({ isConnecting: connecting }),

      setToken: (token) => set({ token }),

      setTokenError: (error) => set({ tokenError: error }),

      setIsJoining: (joining) => set({ isJoining: joining }),

      setRoomName: (name) => set({ roomName: name }),

      resetCallState: () => set({
        room: null,
        participants: [],
        localParticipant: null,
        isConnected: false,
        isConnecting: false,
        token: null,
        tokenError: null,
        isJoining: false,
        roomName: null,
      }),
    }),
    {
      name: 'video-call-store',
    }
  )
);

// Create Transcription Store
export const useTranscriptionStore = create<TranscriptionState>()(
  devtools(
    (set, get) => ({
      transcription: [],
      manualNotes: [],
      speechRecognitionStatus: 'idle',
      isTranscribing: false,
      isThrottled: false,
      restartCount: 0,
      lastTranscriptionUpdate: null,

      setTranscription: (transcription) => set({ transcription }),

      addTranscriptionEntry: (entry) => set((state) => ({
        transcription: [...state.transcription, entry],
        lastTranscriptionUpdate: new Date(),
      })),

      setManualNotes: (notes) => set({ manualNotes: notes }),

      addManualNote: (note) => set((state) => ({
        manualNotes: [...state.manualNotes, note],
        lastTranscriptionUpdate: new Date(),
      })),

      setSpeechRecognitionStatus: (status) => set({ speechRecognitionStatus: status }),

      setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),

      setIsThrottled: (throttled) => set({ isThrottled: throttled }),

      setRestartCount: (count) => set({ restartCount: count }),

      setLastTranscriptionUpdate: (date) => set({ lastTranscriptionUpdate: date }),

      resetTranscriptionState: () => set({
        transcription: [],
        manualNotes: [],
        speechRecognitionStatus: 'idle',
        isTranscribing: false,
        isThrottled: false,
        restartCount: 0,
        lastTranscriptionUpdate: null,
      }),
    }),
    {
      name: 'transcription-store',
    }
  )
);

// Create UI Store
export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      theme: 'system',
      sidebarOpen: true,
      isMobile: false,
      showNotifications: true,
      currentView: 'dashboard',

      setTheme: (theme) => set({ theme }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setIsMobile: (mobile) => set({ isMobile: mobile }),

      setShowNotifications: (show) => set({ showNotifications: show }),

      setCurrentView: (view) => set({ currentView: view }),
    }),
    {
      name: 'ui-store',
    }
  )
);

// Create Room Management Store
export const useRoomManagementStore = create<RoomManagementState>()(
  devtools(
    (set, get) => ({
      ownedRooms: [],
      isCreatingRoom: false,
      roomCreationError: null,
      currentRoom: null,

      setOwnedRooms: (rooms) => set({ ownedRooms: rooms }),

      addOwnedRoom: (roomName) => set((state) => ({
        ownedRooms: [...state.ownedRooms, roomName],
      })),

      removeOwnedRoom: (roomName) => set((state) => ({
        ownedRooms: state.ownedRooms.filter(room => room !== roomName),
      })),

      setIsCreatingRoom: (creating) => set({ isCreatingRoom: creating }),

      setRoomCreationError: (error) => set({ roomCreationError: error }),

      setCurrentRoom: (room) => set({ currentRoom: room }),
    }),
    {
      name: 'room-management-store',
    }
  )
);

// Combined selectors for easy access
export const useStores = () => ({
  auth: useAuthStore(),
  videoCall: useVideoCallStore(),
  transcription: useTranscriptionStore(),
  ui: useUIStore(),
  roomManagement: useRoomManagementStore(),
});

// Selectors for common use cases
export const useAuth = () => useAuthStore();
export const useVideoCall = () => useVideoCallStore();
export const useTranscription = () => useTranscriptionStore();
export const useUI = () => useUIStore();
export const useRoomManagement = () => useRoomManagementStore();
