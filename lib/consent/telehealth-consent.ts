import { SUMMARY_RETENTION_DAYS } from '../consultations/retention-policy';

/**
 * What a patient agrees to before their first video consultation, and how that
 * agreement is recorded.
 *
 * Consent is asked at the point of care, when it becomes relevant, instead of
 * being bundled into a registration form. The account already is the
 * registration — the identity provider has established who the patient is —
 * so the only question left is whether they agree, and nothing is collected
 * that the consultation does not use: no phone number, no device details.
 *
 * The screen that shows the statement and the server that records agreement
 * both read it from here, so a stored version always names the words the
 * patient was shown. Change the version whenever the statement changes in
 * substance; every patient is then asked again, once.
 */
export const TELEHEALTH_CONSENT = {
  version: '2026-09-13',
  statements: [
    'I agree to consult my doctor by video, for this and later invitations from this service.',
    'My doctor sees the email address of the account I signed in with, so they know who is joining.',
    'Transcription is optional and asked for separately in the call. If I allow it, my speech is used to draft a summary that my doctor reviews.',
    `Consultation summaries are deleted automatically after ${SUMMARY_RETENTION_DAYS} days.`,
    'This is a university thesis prototype, not a certified medical service. I can ask the thesis team to see, correct, or delete my information.',
  ],
} as const;

/** The fields that record agreement on a `users/{uid}` profile. */
export function telehealthConsentRecord(agreedAt: Date): Record<string, unknown> {
  return {
    consentGiven: true,
    consentGivenAt: agreedAt,
    consentVersion: TELEHEALTH_CONSENT.version,
  };
}

/**
 * Whether a profile holds agreement to the current statement.
 *
 * Profiles marked by the old registration form have `consentGiven` but no
 * version, and are asked once more: that form asked about storing network and
 * browser hashes, not about the consultation itself, so it is not agreement to
 * this.
 */
export function hasTelehealthConsent(
  profile: { consentGiven?: unknown; consentVersion?: unknown } | null | undefined
): boolean {
  return profile?.consentGiven === true && profile.consentVersion === TELEHEALTH_CONSENT.version;
}
