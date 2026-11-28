import type { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse, unexpectedErrorResponse } from '@/lib/services/shared/http';
import { serviceError } from '@/lib/services/shared/service-result';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { isConsultationCapabilityEnabled } from '@/lib/consultations/consultation-capabilities';
import { appointmentRoomName, parseAppointmentCommand } from '@/lib/appointments/appointment-policy';
import { revokeActiveInvitationsForRoom } from '@/lib/invitations/revoke-invitation';
import { AppointmentService } from '@/lib/services/appointments/appointment-service';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';

/** One authenticated command/query boundary; no invitation or media side effects. */
async function handle(req: NextRequest, write: boolean) {
  try {
    const auth = await authorizeBearerRequest(req, 'appointment:manage-own');
    if (!auth.ok) return serviceResultToResponse(auth);
    if (!isConsultationCapabilityEnabled('scheduling')) return serviceResultToResponse(serviceError(503, 'scheduling_disabled', 'Appointments are not enabled in this deployment.'));
    const limited = await enforceRateLimit(req, write ? RateLimitConfigs.TOKEN_GENERATION : RateLimitConfigs.GENERAL);
    if (limited) return limited;
    const command = write ? parseAppointmentCommand(await req.json().catch(() => null)) : null;
    if (command && !command.ok) return serviceResultToResponse(command);
    const db = getFirebaseAdmin();
    if (!db) return serviceResultToResponse(serviceError(503, 'db_unavailable', 'Appointment service is unavailable. Please retry.'));
    const service = new AppointmentService(db);
    if (command?.ok) {
      const result = await service.execute(auth.data.userId, command.data);
      // Cancelling a visit also closes its door: revoke this doctor's active
      // invitations for the visit room (the calendar-cancel pattern). Runs after
      // the booking commit; a repeated cancel simply finds nothing to revoke.
      if (result.ok && command.data.action === 'cancel' && result.data.appointment.status === 'cancelled') {
        const revoked = await revokeActiveInvitationsForRoom(db, auth.data.userId, appointmentRoomName(command.data.id));
        if (revoked > 0 || result.data.appointment.cancellation?.revokedInvitationCount == null) {
          await service.recordRevokedInvitations(command.data.id, revoked);
        }
        const cancellation = result.data.appointment.cancellation;
        return serviceResultToResponse({ ...result, data: { ...result.data, revokedInvitationCount: revoked, appointment: { ...result.data.appointment, cancellation: cancellation ? { ...cancellation, revokedInvitationCount: (cancellation.revokedInvitationCount || 0) + revoked } : cancellation } } });
      }
      return serviceResultToResponse(result);
    }
    return serviceResultToResponse(await service.list(auth.data.userId, new URL(req.url).searchParams.get('cursor') || undefined));
  } catch (error) { return unexpectedErrorResponse(error); }
}

/** Appointment contact data must never be cached publicly by a browser or CDN. */
function privateResponse(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const GET = withRequestLogging(async (req: NextRequest) => privateResponse(await handle(req, false)));
export const POST = withRequestLogging(async (req: NextRequest) => privateResponse(await handle(req, true)));
