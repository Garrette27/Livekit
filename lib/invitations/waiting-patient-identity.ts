interface BuildWaitingPatientIdentityInput {
  explicitUserEmail?: string;
  profileEmail?: string;
  invitationEmail?: string;
  userDocId?: string;
}

interface WaitingPatientIdentity {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  isAnonymous: boolean;
}

function normalizeEmail(email?: string): string | undefined {
  return email ? email.toLowerCase().trim() : undefined;
}

export function buildWaitingPatientIdentity({
  explicitUserEmail,
  profileEmail,
  invitationEmail,
  userDocId,
}: BuildWaitingPatientIdentityInput): WaitingPatientIdentity {
  const explicitEmail = normalizeEmail(explicitUserEmail);

  // If the patient did not explicitly identify, keep waiting-room display anonymous.
  if (!explicitEmail) {
    return {
      patientId: `anonymous_${Date.now()}`,
      patientName: 'Anonymous Patient',
      isAnonymous: true,
    };
  }

  const resolvedEmail = normalizeEmail(profileEmail) || explicitEmail || normalizeEmail(invitationEmail);

  return {
    patientId: userDocId || `anonymous_${Date.now()}`,
    patientName: resolvedEmail || 'Anonymous Patient',
    ...(resolvedEmail && { patientEmail: resolvedEmail }),
    isAnonymous: !userDocId,
  };
}
