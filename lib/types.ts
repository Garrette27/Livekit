/**
 * Type definitions for the telehealth application
 * Including the new invitation system
 */

import { Timestamp } from 'firebase/firestore';

// Existing types
export interface CallSummary {
  id: string;
  roomName: string;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: string;
  category: string;
  createdAt: Timestamp;
  participants: string[];
  duration: number;
  metadata?: {
    totalParticipants: number;
    createdBy?: string;
  };
  createdBy?: string;
  _logged?: boolean;
}

export interface Consultation {
  id: string;
  roomName: string;
  patientName?: string;
  duration?: number;
  status?: string;
  joinedAt?: any;
  leftAt?: any;
  createdBy?: string;
  patientUserId?: string;
  isRealConsultation?: boolean;
  metadata?: {
    createdBy?: string;
    patientUserId?: string;
    visibleToUsers?: string[];
  };
}

// New invitation system types
export interface Invitation {
  id: string;
  roomName: string;
  emailAllowed: string;
  countryAllowlist: string[];
  browserAllowlist: string[];
  deviceFingerprintHash?: string;
  expiresAt: Timestamp;
  maxUses: number;
  usedAt?: Timestamp;
  usedBy?: string;
  createdBy: string;
  createdAt: Timestamp;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  metadata: {
    createdBy: string;
    doctorName: string;
    doctorEmail: string;
    roomName: string;
    constraints: {
      email: string;
      countries: string[];
      browsers: string[];
      deviceBinding: boolean;
    };
    security: {
      singleUse: boolean;
      timeLimited: boolean;
      geoRestricted: boolean;
      deviceRestricted: boolean;
    };
  };
  audit: {
    created: Timestamp;
    lastAccessed?: Timestamp;
    accessAttempts: AccessAttempt[];
    violations: SecurityViolation[];
  };
}

export interface AccessAttempt {
  timestamp: Timestamp;
  ip: string;
  userAgent: string;
  country?: string;
  deviceFingerprint?: string;
  success: boolean;
  reason?: string;
}

export interface SecurityViolation {
  timestamp: Timestamp;
  type: 'wrong_email' | 'wrong_country' | 'wrong_browser' | 'wrong_device' | 'expired' | 'already_used';
  details: string;
  ip: string;
  userAgent: string;
}

export interface InvitationToken {
  invitationId: string;
  roomName: string;
  email: string;
  exp: number;
  iat: number;
  oneUse: boolean;
}

export interface DeviceFingerprint {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  cookieEnabled: boolean;
  doNotTrack: string;
  hash: string;
}

export interface GeolocationData {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  timezone: string;
  isp: string;
}

// API request/response types
export interface CreateInvitationRequest {
  roomName: string;
  emailAllowed: string;
  countryAllowlist: string[];
  browserAllowlist: string[];
  deviceBinding: boolean;
  expiresInHours: number;
}

export interface CreateInvitationResponse {
  success: boolean;
  invitationId: string;
  inviteUrl: string;
  expiresAt: string;
  error?: string;
}

export interface ValidateInvitationRequest {
  token: string;
  deviceFingerprint?: DeviceFingerprint;
  geolocation?: GeolocationData;
}

export interface ValidateInvitationResponse {
  success: boolean;
  liveKitToken?: string;
  roomName?: string;
  error?: string;
  violations?: SecurityViolation[];
}

// UI component props
export interface InvitationFormData {
  email: string;
  countries: string[];
  browsers: string[];
  deviceBinding: boolean;
  expiresInHours: number;
}

export interface InvitationListItem {
  id: string;
  roomName: string;
  email: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  accessAttempts: number;
  violations: number;
}
