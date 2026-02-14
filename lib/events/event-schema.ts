export const EVENT_SCHEMA_VERSION = 1 as const;

export const EVENT_DOMAINS = {
  CONSULTATION_PRESENCE: 'consultation.presence',
  INVITATION_AUDIT: 'invitation.audit',
} as const;

export type EventDomain = (typeof EVENT_DOMAINS)[keyof typeof EVENT_DOMAINS];
