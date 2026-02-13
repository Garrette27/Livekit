import { RoomGridPolicy } from './room-session-policy';

interface GridBreakpoint {
  upToParticipants: number;
  columns: number;
}

// Tuned to avoid empty 2x2 for 3 participants while still scaling toward larger rooms.
const DEFAULT_GRID_BREAKPOINTS: GridBreakpoint[] = [
  { upToParticipants: 1, columns: 1 },
  { upToParticipants: 2, columns: 2 },
  { upToParticipants: 3, columns: 3 },
  { upToParticipants: 4, columns: 2 },
  { upToParticipants: 6, columns: 3 },
  { upToParticipants: 9, columns: 3 },
  { upToParticipants: 12, columns: 4 },
  { upToParticipants: 16, columns: 4 },
  { upToParticipants: 20, columns: 5 },
  { upToParticipants: 30, columns: 6 },
  { upToParticipants: 40, columns: 7 },
];

export function resolveGridColumns(
  participantCount: number,
  policy: RoomGridPolicy
): number {
  if (!policy.enabled) {
    return 0;
  }

  const safeCount = Math.max(1, Math.min(participantCount, policy.maxParticipants));
  const match = DEFAULT_GRID_BREAKPOINTS.find((entry) => safeCount <= entry.upToParticipants);
  if (match) {
    return match.columns;
  }

  return Math.ceil(Math.sqrt(safeCount));
}

export function resolveMobileGridColumns(desktopColumns: number, policy: RoomGridPolicy): number {
  return Math.max(1, Math.min(desktopColumns, policy.mobileMaxColumns));
}
