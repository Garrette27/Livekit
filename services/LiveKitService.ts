import { Room, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { User } from 'firebase/auth';

export interface LiveKitTokenResponse {
  token: string;
  error?: string;
}

export interface RoomCreationRequest {
  roomName: string;
  userId: string;
  userName?: string;
  userEmail?: string;
}

export interface RoomCreationResponse {
  success: boolean;
  roomName: string;
  error?: string;
}

export class LiveKitService {
  private static readonly API_BASE = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  private static readonly API_KEY = process.env.LIVEKIT_API_KEY;
  private static readonly API_SECRET = process.env.LIVEKIT_API_SECRET;

  /**
   * Generate LiveKit token for room access
   */
  static async generateToken(
    roomName: string, 
    participantName: string
  ): Promise<LiveKitTokenResponse> {
    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName, 
          participantName 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          token: '',
          error: errorData.error || 'Failed to generate token'
        };
      }

      const data = await response.json();
      return { token: data.token };
    } catch (error) {
      console.error('Token generation error:', error);
      return {
        token: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new room in Firestore
   */
  static async createRoom(request: RoomCreationRequest): Promise<RoomCreationResponse> {
    try {
      const response = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          roomName: request.roomName,
          error: errorData.error || 'Failed to create room'
        };
      }

      return {
        success: true,
        roomName: request.roomName
      };
    } catch (error) {
      console.error('Room creation error:', error);
      return {
        success: false,
        roomName: request.roomName,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate room access permissions
   */
  static async validateRoomAccess(
    roomName: string, 
    userId: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/room/${roomName}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.hasAccess || false;
    } catch (error) {
      console.error('Room validation error:', error);
      return false;
    }
  }

  /**
   * Get room information
   */
  static async getRoomInfo(roomName: string): Promise<any> {
    try {
      const response = await fetch(`/api/room/${roomName}`);
      
      if (!response.ok) {
        throw new Error('Room not found');
      }

      return await response.json();
    } catch (error) {
      console.error('Get room info error:', error);
      return null;
    }
  }

  /**
   * Delete a room
   */
  static async deleteRoom(roomName: string, userId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/room/${roomName}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      return response.ok;
    } catch (error) {
      console.error('Delete room error:', error);
      return false;
    }
  }

  /**
   * Get room participants
   */
  static async getRoomParticipants(roomName: string): Promise<RemoteParticipant[]> {
    try {
      const response = await fetch(`/api/room/${roomName}/participants`);
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.participants || [];
    } catch (error) {
      console.error('Get participants error:', error);
      return [];
    }
  }

  /**
   * Generate unique room name
   */
  static generateRoomName(prefix: string = 'consultation'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Validate room name format
   */
  static validateRoomName(roomName: string): { isValid: boolean; error?: string } {
    if (!roomName || roomName.trim().length === 0) {
      return { isValid: false, error: 'Room name is required' };
    }

    if (roomName.length < 3) {
      return { isValid: false, error: 'Room name must be at least 3 characters' };
    }

    if (roomName.length > 50) {
      return { isValid: false, error: 'Room name must be less than 50 characters' };
    }

    // Allow alphanumeric, hyphens, and underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(roomName)) {
      return { 
        isValid: false, 
        error: 'Room name can only contain letters, numbers, hyphens, and underscores' 
      };
    }

    return { isValid: true };
  }

  /**
   * Check if room is active
   */
  static async isRoomActive(roomName: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/room/${roomName}/status`);
      
      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.isActive || false;
    } catch (error) {
      console.error('Check room status error:', error);
      return false;
    }
  }

  /**
   * Get room statistics
   */
  static async getRoomStatistics(roomName: string): Promise<any> {
    try {
      const response = await fetch(`/api/room/${roomName}/stats`);
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Get room stats error:', error);
      return null;
    }
  }

  /**
   * Update room settings
   */
  static async updateRoomSettings(
    roomName: string, 
    settings: any, 
    userId: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/room/${roomName}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, userId }),
      });

      return response.ok;
    } catch (error) {
      console.error('Update room settings error:', error);
      return false;
    }
  }
}
