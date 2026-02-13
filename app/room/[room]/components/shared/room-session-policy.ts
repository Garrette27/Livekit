export type RoomRole = 'doctor' | 'patient';

export interface RoomControlsPolicy {
  hideLeaveControl: boolean;
  hideStartVideoControl: boolean;
  hideSettingsControl: boolean;
}

export interface RoomChatPolicy {
  enabled: boolean;
  defaultOpen: boolean;
}

export interface SidebarPolicy {
  enabled: boolean;
  title: string;
  icon: string;
  position: 'left' | 'right';
  width: number;
  collapsedWidth: number;
  defaultCollapsed: boolean;
}

export interface WaitingQueuePanelPolicy extends SidebarPolicy {
  autoRefresh: boolean;
  pollIntervalMs: number;
  showRefreshButton: boolean;
}

export interface RoomSessionPolicy {
  controls: RoomControlsPolicy;
  chat: RoomChatPolicy;
  panels: {
    waitingQueue: WaitingQueuePanelPolicy;
    doctorSession: SidebarPolicy;
    patientSession: SidebarPolicy;
    notes: SidebarPolicy;
  };
}

const DISABLED_PANEL: SidebarPolicy = {
  enabled: false,
  title: '',
  icon: '',
  position: 'right',
  width: 320,
  collapsedWidth: 60,
  defaultCollapsed: false,
};

const DISABLED_WAITING_QUEUE_PANEL: WaitingQueuePanelPolicy = {
  ...DISABLED_PANEL,
  autoRefresh: false,
  pollIntervalMs: 15_000,
  showRefreshButton: false,
};

const ROOM_SESSION_POLICIES: Record<RoomRole, RoomSessionPolicy> = {
  doctor: {
    controls: {
      hideLeaveControl: true,
      hideStartVideoControl: true,
      hideSettingsControl: true,
    },
    chat: {
      enabled: true,
      defaultOpen: false,
    },
    panels: {
      waitingQueue: {
        enabled: true,
        title: 'Waiting Queue',
        icon: 'WQ',
        position: 'left',
        width: 360,
        collapsedWidth: 60,
        defaultCollapsed: false,
        autoRefresh: true,
        pollIntervalMs: 15_000,
        showRefreshButton: false,
      },
      doctorSession: {
        enabled: true,
        title: 'Doctor Session Panel',
        icon: 'DR',
        position: 'right',
        width: 300,
        collapsedWidth: 60,
        defaultCollapsed: false,
      },
      patientSession: DISABLED_PANEL,
      notes: DISABLED_PANEL,
    },
  },
  patient: {
    controls: {
      hideLeaveControl: true,
      hideStartVideoControl: true,
      hideSettingsControl: true,
    },
    chat: {
      enabled: true,
      defaultOpen: false,
    },
    panels: {
      waitingQueue: DISABLED_WAITING_QUEUE_PANEL,
      doctorSession: DISABLED_PANEL,
      patientSession: DISABLED_PANEL,
      notes: DISABLED_PANEL,
    },
  },
};

export function getRoomSessionPolicy(role: RoomRole): RoomSessionPolicy {
  return ROOM_SESSION_POLICIES[role];
}
