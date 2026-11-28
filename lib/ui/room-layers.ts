/**
 * Stacking order for the consultation room, lowest to highest. One scale so a
 * new overlay cannot accidentally cover a panel the user opened: informational
 * overlays on the call (quality readout, device notices, diagnostics, error
 * toast) sit above the video and LiveKit's control bar but BELOW the side
 * panels and sheets, whose close buttons must always stay reachable.
 * LiveKit's chat popover keeps its own value in LiveKitStyles.
 */
export const ROOM_LAYERS = {
  connectionStatus: 40,
  controlBar: 10000,
  callQuality: 10010,
  diagnostics: 10011,
  notice: 10012,
  errorToast: 10013,
  sidePanel: 10020,
} as const;
