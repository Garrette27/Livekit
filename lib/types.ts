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
  /** Legacy plaintext allowlist field. New writes use keyed email hashes. */
  emailAllowed?: string;
  phoneAllowed?: string; // Optional phone number
  expiresAt: Timestamp;
  maxUses: number;
  currentUses?: number; // Track how many times invitation has been used
  maxPatients?: number; // Maximum number of patients allowed in waiting room
  waitingRoomEnabled?: boolean; // Whether waiting room feature is enabled
  usedAt?: Timestamp;
  usedBy?: string;
  createdBy: string;
  createdAt: Timestamp;
  status: 'active' | 'used' | 'expired' | 'cancelled' | 'revoked';
  metadata: {
    createdBy: string;
    doctorName: string;
    doctorEmail: string;
    roomName: string;
        constraints: {
          /** Legacy plaintext fields retained only while old documents remain readable. */
          email?: string;
          emails?: string[];
          /** Keyed hashes support equality checks without persisting addresses. */
          emailHashes?: string[];
          allowlistCount?: number;
          phone?: string;
        };
    security: {
      singleUse: boolean;
      timeLimited: boolean;
      usagePolicy?: 'single-use' | 'reusable-until-expiry';
      admissionPolicy?: 'doctor-admit' | 'verified-allowlist-or-doctor-admit';
    };
  };
  audit: {
    eventDomain?: string;
    eventVersion?: number;
    created: Timestamp;
    lastAccessed?: Timestamp;
  };
}

export interface AccessAttempt {
  eventDomain?: string;
  eventType?: string;
  eventVersion?: number;
  occurredAt?: Timestamp;
  actorType?: 'patient' | 'doctor' | 'system' | 'anonymous';
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  timestamp: Timestamp;
  networkHash: string;
  userAgentHash: string;
  success: boolean;
  reason?: string;
}

export interface SecurityViolation {
  eventDomain?: string;
  eventType?: string;
  eventVersion?: number;
  occurredAt?: Timestamp;
  actorType?: 'patient' | 'doctor' | 'system' | 'anonymous';
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  timestamp: Timestamp;
  type: 'wrong_email' | 'wrong_country' | 'wrong_browser' | 'wrong_device' | 'wrong_ip' | 'expired' | 'already_used' | 'not_registered' | 'consent_not_given';
  details: string;
  networkHash: string;
  userAgentHash: string;
}

export interface InvitationToken {
  invitationId: string;
  roomName: string;
  /** Legacy claim accepted while old links expire. New tokens omit identity data. */
  email?: string;
  exp: number;
  iat: number;
  oneUse: boolean;
}

// API request/response types
export interface CreateInvitationRequest {
  roomName: string;
  emailAllowed?: string; // Optional email - invitation can be created without email
  emailAllowlist?: string[]; // Optional multi-email auto-admit allowlist
  phoneAllowed?: string; // Optional phone number
  expiresInHours?: number; // Optional expiration (defaults to 24 hours)
  waitingRoomEnabled?: boolean; // Enable waiting room feature
  maxPatients?: number; // Maximum number of patients allowed (defaults to 1 if waiting room disabled, 10 if enabled)
  maxUses?: number; // Maximum number of times invitation can be used (defaults to 1 if waiting room disabled, unlimited if enabled)
  doctorUserId?: string; // Doctor's user ID for tracking who created the invitation
  doctorEmail?: string; // Doctor's email
  doctorName?: string; // Doctor's name
  // Removed: countryAllowlist, browserAllowlist, deviceBinding, allowedIpAddresses, allowedDeviceIds
  // System will automatically verify using registered user's device/location/browser info
}

export interface CreateInvitationResponse {
  success: boolean;
  invitationId: string;
  inviteUrl: string;
  expiresAt: string;
  error?: string;
  existingAccount?: {
    exists: boolean;
    message: string;
  } | null;
}

export interface ValidateInvitationRequest {
  token: string;
  userEmail?: string; // Email from registration if user just registered
}

export interface ValidateInvitationResponse {
  success: boolean;
  liveKitToken?: string;
  roomName?: string; // This will be the waiting room name if waiting room is enabled
  waitingRoomToken?: boolean; // Indicates this is a waiting room token
  invitationId?: string; // Invitation ID for checking admission status
  waitingPatientId?: string; // Stable waiting-patient reference for admission polling
  error?: string;
  requiresRegistration?: boolean; // If true, user needs to register first
  registeredEmail?: string; // Email that should be used for registration
  waitingRoomEnabled?: boolean; // Whether patient is in waiting room
}

// UI component props
export interface InvitationFormData {
  email: string;
  phone?: string; // Optional phone number
  expiresInHours: number;
  waitingRoomEnabled?: boolean; // Enable waiting room
  maxPatients?: number; // Max patients in waiting room
  // Removed: countries, browsers, deviceBinding, ipAllowlist, deviceIdAllowlist
}

// Waiting room types
export interface WaitingPatient {
  id: string;
  doctorUserId?: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  roomName: string;
  invitationId: string;
  joinedAt: Timestamp | Date | any;
  status: 'waiting' | 'admitted' | 'left' | 'rejected';
  admittedAt?: Timestamp | Date | any;
  leftAt?: Timestamp | Date | any;
  rejectedAt?: Timestamp | Date | any;
  metadata?: {
    deviceFingerprint?: string;
    deviceFingerprintHash?: string;
    ip?: string;
    userAgent?: string;
    networkHash?: string;
    userAgentHash?: string;
    lastAccessed?: Timestamp | Date | any;
    isAnonymous?: boolean;
    admissionMode?: 'doctor-manual' | 'auto-email-match';
    doctorUserId?: string;
    consultationSessionId?: string;
  };
}

export interface AdmitPatientRequest {
  waitingPatientId: string;
  roomName: string;
}

export interface AdmitPatientResponse {
  success: boolean;
  liveKitToken?: string; // Token for main consultation room
  roomName?: string;
  error?: string;
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

// User profile types for privacy-compliant registration
export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  role: 'doctor' | 'patient' | 'faculty_reviewer' | 'admin';
  consentGiven: boolean;
  consentGivenAt: Timestamp | Date | any; // Flexible for client/server compatibility
  deviceInfo?: { // Only for patients who gave consent
    deviceFingerprintHash: string;
    userAgent: string;
    platform: string;
    screenResolution: string;
    timezone: string;
  };
  locationInfo?: { // Only for patients who gave consent
    country: string;
    countryCode: string;
    region: string;
    city: string;
    ipHash: string; // Hashed IP for privacy
  };
  browserInfo?: { // Only for patients who gave consent
    name: string;
    version?: string;
  };
  registeredAt: Timestamp | Date | any; // Flexible for client/server compatibility
  lastLoginAt: Timestamp | Date | any; // Flexible for client/server compatibility
  // Doctor-specific fields
  doctorName?: string;
  doctorEmail?: string;
}

export interface RegisterUserRequest {
  invitationToken: string;
  email: string;
  phone?: string;
  consentGiven: boolean;
}

export interface RegisterUserResponse {
  success: boolean;
  userId?: string;
  error?: string;
  requiresConsent?: boolean;
}
