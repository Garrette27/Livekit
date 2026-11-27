/**
 * Call-quality measurement from WebRTC getStats() entries.
 *
 * Turns the raw RTCStats objects of one browser's LiveKit tracks into the
 * handful of receiver-side numbers a paired-call trial reports: round-trip
 * time, jitter, packet loss since join, and the video resolution/frame rate
 * actually received and sent. The output carries no identities, room names or
 * media content, so a measurement can be copied into a trial log safely.
 *
 * Every field is null when the browser did not report it (e.g. no remote
 * video yet); callers must show "not measured", never a guessed value.
 */

export interface CallQualitySample {
  /** Transport round-trip time in milliseconds (nominated candidate pair). */
  roundTripMs: number | null;
  /** Worst inbound jitter across received audio/video, in milliseconds. */
  jitterMs: number | null;
  /** Inbound packets lost since join, as a percentage of packets expected. */
  packetLossPercent: number | null;
  receivedVideo: { width: number; height: number; fps: number | null } | null;
  sentVideo: { width: number; height: number; fps: number | null } | null;
}

type StatEntry = Record<string, unknown> & { type?: string };

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

function largestVideo(entries: StatEntry[]) {
  let best: { width: number; height: number; fps: number | null } | null = null;
  for (const entry of entries) {
    const width = num(entry.frameWidth);
    const height = num(entry.frameHeight);
    if (width === null || height === null) continue;
    if (!best || width * height > best.width * best.height) {
      const fps = num(entry.framesPerSecond);
      best = { width, height, fps: fps === null ? null : round(fps, 0) };
    }
  }
  return best;
}

export function summarizeCallStats(entries: StatEntry[]): CallQualitySample {
  const inbound = entries.filter((entry) => entry.type === 'inbound-rtp');
  const outboundVideo = entries.filter((entry) => entry.type === 'outbound-rtp' && entry.kind === 'video');

  const rtts = entries
    .filter((entry) => entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.nominated !== false)
    .map((entry) => num(entry.currentRoundTripTime))
    .concat(entries.filter((entry) => entry.type === 'remote-inbound-rtp').map((entry) => num(entry.roundTripTime)))
    .filter((value): value is number => value !== null);

  const jitters = inbound.map((entry) => num(entry.jitter)).filter((value): value is number => value !== null);

  let lost = 0;
  let received = 0;
  let sawCounters = false;
  for (const entry of inbound) {
    const entryLost = num(entry.packetsLost);
    const entryReceived = num(entry.packetsReceived);
    if (entryLost === null || entryReceived === null) continue;
    sawCounters = true;
    lost += Math.max(0, entryLost);
    received += entryReceived;
  }

  return {
    roundTripMs: rtts.length ? round(Math.max(...rtts) * 1000, 0) : null,
    jitterMs: jitters.length ? round(Math.max(...jitters) * 1000) : null,
    packetLossPercent: sawCounters && lost + received > 0 ? round((lost / (lost + received)) * 100, 2) : null,
    receivedVideo: largestVideo(inbound.filter((entry) => entry.kind === 'video')),
    sentVideo: largestVideo(outboundVideo),
  };
}
