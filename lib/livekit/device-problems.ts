/**
 * Wording for camera/microphone problems shown in the call. Kept apart from the
 * React component so the policy (which device, which cause, what to say) is
 * testable: a device that is in use by another app or window must never be
 * described as "blocked", and only the device that failed is named.
 */
export type DeviceProblem = 'blocked' | 'in-use' | 'not-found' | 'failed';
export type DeviceProblems = Partial<Record<'camera' | 'microphone', DeviceProblem>>;

/** Map a MediaDeviceKind from LiveKit's MediaDevicesError to the device it names, or null when unknown. */
export function deviceForKind(kind: string | undefined): 'camera' | 'microphone' | null {
  if (kind === 'videoinput') return 'camera';
  if (kind === 'audioinput') return 'microphone';
  return null;
}

const CAUSE: Record<DeviceProblem, string> = {
  blocked: 'is blocked for this site. Click the site icon left of the address bar, set it to Allow, then reload this page.',
  'in-use': 'is in use by another app or browser window. Close the other app or window (or choose another device), then try again.',
  'not-found': 'was not found. Check that it is connected, or choose another device.',
  failed: 'could not be started. Try choosing the device again or reload this page.',
};

/** One sentence per affected device, or null when nothing is wrong. */
export function describeDeviceProblems(problems: DeviceProblems): string | null {
  const lines = (['camera', 'microphone'] as const)
    .filter((device) => problems[device])
    .map((device) => `The ${device} ${CAUSE[problems[device]!]}`);
  if (!lines.length) return null;
  return `${lines.join(' ')} You can still hear, see and chat with the other participant meanwhile.`;
}
