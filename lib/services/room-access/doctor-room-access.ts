import type { Firestore } from 'firebase-admin/firestore';
import { InvitationRepository } from '@/lib/repositories/invitation-repository';
import { RoomRepository } from '@/lib/repositories/room-repository';
import { isDoctorClaimableRoomName } from '@/lib/rooms/room-name-policy';
import {
  serviceError,
  serviceOk,
  type ServiceResult,
} from '@/lib/services/shared/service-result';

interface DoctorRoomIdentity {
  userId: string;
  email?: string;
  name?: string;
}

/**
 * Owns doctor-to-room authorization and the migration path for invitation-era
 * rooms that predate explicit room records. Callers never need to duplicate
 * owner-field precedence or accidentally let a doctor claim another doctor's
 * room.
 */
/** Rejection for reserved `-waiting` names and malformed room names. */
function invalidRoomName<T>(): ServiceResult<T> {
  return serviceError(
    400,
    'invalid_room_name',
    'This room name cannot be used. Room names ending in "-waiting" are reserved.'
  );
}

export class DoctorRoomAccess {
  private readonly rooms: RoomRepository;
  private readonly invitations: InvitationRepository;

  constructor(db: Firestore) {
    this.rooms = new RoomRepository(db);
    this.invitations = new InvitationRepository(db);
  }

  /** Claims a new invitation room, or confirms it already belongs to the doctor. */
  async claimInvitationRoom(input: {
    roomName: string;
    doctor: DoctorRoomIdentity;
  }): Promise<ServiceResult<{ roomName: string }>> {
    if (!isDoctorClaimableRoomName(input.roomName)) {
      return invalidRoomName();
    }
    const claimed = await this.rooms.claimForDoctor(input.roomName, input.doctor);
    if (!claimed) {
      return serviceError(
        409,
        'room_owned_by_another_doctor',
        'This room name is already owned by another doctor'
      );
    }

    return serviceOk({ roomName: input.roomName });
  }

  /**
   * Authorizes entry to an owned room. For legacy data only, an owned
   * invitation can establish the missing room record atomically.
   */
  async authorizeDoctorRoom(input: {
    roomName: string;
    doctor: DoctorRoomIdentity;
  }): Promise<ServiceResult<{ roomName: string }>> {
    if (!isDoctorClaimableRoomName(input.roomName)) {
      return invalidRoomName();
    }
    const roomDoc = await this.rooms.getByRoom(input.roomName);
    if (!roomDoc.exists) {
      const invitationDocs = await this.invitations.findActiveByRoom(input.roomName, 50);
      const ownsLegacyInvitation = invitationDocs.some(
        (invitationDoc) => invitationDoc.data()?.createdBy === input.doctor.userId
      );
      if (!ownsLegacyInvitation) {
        return serviceError(
          404,
          'room_not_found',
          'Room not found for this doctor. Create an invitation first.'
        );
      }
    }

    const claimed = await this.rooms.claimForDoctor(input.roomName, input.doctor);
    if (!claimed) {
      return serviceError(
        403,
        'room_forbidden',
        'You can only join rooms that belong to your account'
      );
    }

    return serviceOk({ roomName: input.roomName });
  }
}
