/**
 * Wording for camera/microphone problems shown in the call. Kept apart from the
 * React component so the policy (which device, which cause, what to say) is
 * testable: a device that is in use by another app or window must never be
 * described as "blocked", and only the device that failed is named.
 */
export type DeviceProblem = 'blocked' | 'in-use' | 'not-found' | 'failed' | 'switch-failed';
export type DeviceProblems = Partial<Record<'camera' | 'microphone', DeviceProblem>>;

/** Map a MediaDeviceKind from LiveKit's MediaDevicesError to the device it names, or null when unknown. */
export function deviceForKind(kind: string | undefined): 'camera' | 'microphone' | null {
  if (kind === 'videoinput') return 'camera';
  if (kind === 'audioinput') return 'microphone';
  return null;
}

const CAUSE: Record<DeviceProblem, string> = {
  blocked: 'blocked for this site. Click the site icon left of the address bar, set it to Allow, then reload this page.',
  'in-use': 'in use by another app or browser window. Close the other app or window (or choose another device), then try again.',
  'not-found': 'not found. Check that it is connected, or choose another device.',
  failed: 'not starting. Try choosing the device again or reload this page.',
  'switch-failed': 'still the one you used before: the device you picked would not start. It may be off, in use by another app, or (for a virtual camera such as OBS) not started yet.',
};

/** One sentence per distinct cause (both devices named together when they share it), or null when nothing is wrong. */
export function describeDeviceProblems(problems: DeviceProblems): string | null {
  const devices = (['camera', 'microphone'] as const).filter((device) => problems[device]);
  if (!devices.length) return null;
  const causes = [...new Set(devices.map((device) => problems[device]!))];
  const lines = causes.map((cause) => {
    const named = devices.filter((device) => problems[device] === cause);
    const subject = named.length === 2 ? 'The camera and microphone are' : `The ${named[0]} is`;
    return `${subject} ${CAUSE[cause]}`;
  });
  return `${lines.join(' ')} You can still hear, see and chat with the other participant meanwhile.`;
}
