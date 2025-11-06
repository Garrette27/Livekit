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
  phoneAllowed?: string; // Optional phone number
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
      phone?: string;
    };
    security: {
      singleUse: boolean;
      timeLimited: boolean;
      // Removed: geoRestricted, deviceRestricted - now handled via user profile
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
  type: 'wrong_email' | 'wrong_country' | 'wrong_browser' | 'wrong_device' | 'wrong_ip' | 'expired' | 'already_used' | 'not_registered' | 'consent_not_given';
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
  phoneAllowed?: string; // Optional phone number
  expiresInHours: number;
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
  deviceFingerprint?: DeviceFingerprint;
  geolocation?: GeolocationData;
  userEmail?: string; // Email from registration if user just registered
}

export interface ValidateInvitationResponse {
  success: boolean;
  liveKitToken?: string;
  roomName?: string;
  error?: string;
  violations?: SecurityViolation[];
  requiresRegistration?: boolean; // If true, user needs to register first
  registeredEmail?: string; // Email that should be used for registration
}

// UI component props
export interface InvitationFormData {
  email: string;
  phone?: string; // Optional phone number
  expiresInHours: number;
  // Removed: countries, browsers, deviceBinding, ipAllowlist, deviceIdAllowlist
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
  role: 'doctor' | 'patient'; // User role
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
  email: string;
  phone?: string;
  consentGiven: boolean;
  deviceFingerprint: DeviceFingerprint;
  geolocation?: GeolocationData;
}

export interface RegisterUserResponse {
  success: boolean;
  userId?: string;
  error?: string;
  requiresConsent?: boolean;
}