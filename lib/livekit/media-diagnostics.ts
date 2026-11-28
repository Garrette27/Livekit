/**
 * Temporary media diagnostics (enabled per page load with `?mediaDiagnostics=1`).
 *
 * Turns cumulative WebRTC video counters into per-interval DELTAS for one
 * track, so a visible stall can be lined up with what the receiver or sender
 * did in that same second. Cumulative values alone (as the Call quality panel
 * shows) cannot say *when* frames were dropped. Output holds no identities,
 * room names, tokens or media content.
 */

type StatEntry = Record<string, unknown> & { type?: string; kind?: string; id?: string };

export interface VideoStatDelta {
  direction: 'in' | 'out';
  /** Simulcast layer id for outbound entries (`q`, `h`, `f`); null otherwise. */
  rid: string | null;
  codec: string | null;
  implementation: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  decoded: number | null;
  encoded: number | null;
  dropped: number | null;
  freezes: number | null;
  keyframes: number | null;
  keyframeRequests: number | null;
  packetsLost: number | null;
  limitedBy: string | null;
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value ? value.slice(0, 64) : null);

/**
 * Compute deltas for every video inbound/outbound RTP entry in `entries`
 * against `previous` (keyed by entry id) and return the updated map. The first
 * observation of an entry yields cumulative-since-start values, marked by the
 * caller as the baseline sample.
 */
export function videoStatDeltas(
  previous: Map<string, StatEntry>,
  entries: StatEntry[]
): { deltas: VideoStatDelta[]; next: Map<string, StatEntry> } {
  const codecs = new Map<string, string>();
  for (const entry of entries) if (entry.type === 'codec' && typeof entry.id === 'string') codecs.set(entry.id, String(entry.mimeType ?? ''));
  const next = new Map<string, StatEntry>();
  const deltas: VideoStatDelta[] = [];
  for (const entry of entries) {
    if ((entry.type !== 'inbound-rtp' && entry.type !== 'outbound-rtp') || entry.kind !== 'video') continue;
    const key = String(entry.id);
    const before = previous.get(key) ?? {};
    next.set(key, entry);
    const delta = (field: string) => {
      const now = num(entry[field]);
      return now === null ? null : now - (num(before[field]) ?? 0);
    };
    const pli = delta('pliCount');
    const fir = delta('firCount');
    deltas.push({
      direction: entry.type === 'inbound-rtp' ? 'in' : 'out',
      rid: text(entry.rid),
      codec: typeof entry.codecId === 'string' ? codecs.get(entry.codecId) || null : null,
      implementation: text(entry.decoderImplementation ?? entry.encoderImplementation),
      width: num(entry.frameWidth),
      height: num(entry.frameHeight),
      fps: num(entry.framesPerSecond),
      decoded: delta('framesDecoded'),
      encoded: delta('framesEncoded'),
      dropped: delta('framesDropped'),
      freezes: delta('freezeCount'),
      keyframes: delta(entry.type === 'inbound-rtp' ? 'keyFramesDecoded' : 'keyFramesEncoded'),
      keyframeRequests: pli === null && fir === null ? null : (pli ?? 0) + (fir ?? 0),
      packetsLost: delta('packetsLost'),
      limitedBy: text(entry.qualityLimitationReason),
    });
  }
  return { deltas, next };
}

/** Short, non-reversible label for an id (track SID, device id) so logs can correlate without exposing it. */
export function redactId(value: string | undefined | null): string {
  if (!value) return '—';
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `#${(hash >>> 0).toString(16).padStart(8, '0').slice(0, 6)}`;
}
