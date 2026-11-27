/** Scheduling commands carry intent only; server identity supplies ownership. */
export interface AppointmentFields {
  patientName: string;
  /** Scheduling contact only, never an invitation allowlist or verified identity. */
  patientEmail: string | null;
  startsAt: string;
  endsAt: string;
  displayTimeZone: string;
}

export type AppointmentCommand =
  | (AppointmentFields & { action: 'create'; id: string })
  | (AppointmentFields & { action: 'reschedule'; id: string; expectedVersion: number })
  | { action: 'cancel'; id: string; expectedVersion: number };

type ParsedCommand = { ok: true; data: AppointmentCommand }
  | { ok: false; error: { status: number; code: string; message: string } };

/** Half-open intervals allow the next booking to start when the previous one ends. */
export function appointmentsOverlap(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && otherStart < end;
}

/**
 * Resolve a wall-clock minute in an IANA zone, rejecting nonexistent or repeated
 * times rather than guessing at a daylight-saving offset. No device zone is used.
 */
export function localAppointmentTimeToUtc(local: string, timezone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error('Enter a valid local date and time.');
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  if (year < 2000 || year > 2200 || new Date(nominal).toISOString().slice(0, 16) !== local) {
    throw new Error('Enter a valid calendar date and time.');
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const wallTime = (instant: number) => {
    const fields = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
    return Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day), Number(fields.hour), Number(fields.minute));
  };
  // Probe both sides of an offset transition. Candidate validation below rejects
  // gaps and keeps both possible instants for repeated wall-clock minutes.
  const offsets = new Set([-36, 0, 36].map((hours) => {
    const instant = nominal + hours * 3_600_000;
    return wallTime(instant) - instant;
  }));
  const candidates = [...offsets].map((offset) => nominal - offset).filter((instant) => wallTime(instant) === nominal);
  if (candidates.length !== 1) throw new Error('This local time does not exist or is ambiguous. Choose another time.');
  return new Date(candidates[0]);
}

/** Validate bounded commands before database IO; mutations never accept a client owner. */
export function parseAppointmentCommand(body: unknown, now: Date = new Date()): ParsedCommand {
  const invalid = (message: string): ParsedCommand => ({ ok: false, error: { status: 400, code: 'invalid_appointment', message } });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('A booking command is required.');
  const input = body as Record<string, unknown>;
  const { action, id, expectedVersion } = input;
  if (!['create', 'reschedule', 'cancel'].includes(String(action)) || typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return invalid('Choose a valid booking action and identifier.');
  }
  const allowed = action === 'cancel'
    ? ['action', 'id', 'expectedVersion']
    : ['action', 'id', 'patientName', 'patientEmail', 'localStart', 'durationMinutes', 'displayTimeZone', ...(action === 'reschedule' ? ['expectedVersion'] : [])];
  if (Object.keys(input).some((key) => !allowed.includes(key))) return invalid('The command contains unsupported fields.');
  if (action !== 'create' && (!Number.isSafeInteger(expectedVersion) || Number(expectedVersion) < 1)) return invalid('Refresh the appointment before changing it.');
  if (action === 'cancel') return { ok: true, data: { action, id, expectedVersion: Number(expectedVersion) } };
  const patientName = typeof input.patientName === 'string' ? input.patientName.trim() : '';
  const patientEmail = typeof input.patientEmail === 'string' ? input.patientEmail.trim().toLowerCase() : null;
  if (!patientName || patientName.length > 100 || /[\u0000-\u001f\u007f]/.test(patientName)) return invalid('Enter a patient name of 1-100 characters.');
  if ((input.patientEmail != null && typeof input.patientEmail !== 'string') || (patientEmail && (patientEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)))) return invalid('Enter a valid optional contact email.');
  if (!Number.isInteger(input.durationMinutes) || Number(input.durationMinutes) < 15 || Number(input.durationMinutes) > 120) return invalid('Choose a duration from 15 to 120 minutes.');
  if (typeof input.localStart !== 'string' || typeof input.displayTimeZone !== 'string' || input.displayTimeZone.length > 100) return invalid('Enter a local time and IANA timezone.');
  let startsAt;
  try { startsAt = localAppointmentTimeToUtc(input.localStart, input.displayTimeZone); }
  catch { return invalid('The date or timezone is invalid, or that local time is ambiguous.'); }
  if (startsAt.getTime() <= now.getTime() || startsAt.getTime() > now.getTime() + 180 * 86_400_000) return invalid('Choose a future time within 180 days.');
  const fields: AppointmentFields = { patientName, patientEmail: patientEmail || null, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + Number(input.durationMinutes) * 60_000).toISOString(), displayTimeZone: input.displayTimeZone };
  return { ok: true, data: action === 'create' ? { action, id, ...fields } : { action: 'reschedule', id, expectedVersion: Number(expectedVersion), ...fields } };
}
