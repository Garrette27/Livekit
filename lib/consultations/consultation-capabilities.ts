export type ConsultationCapability = 'file-attachments' | 'scheduling';

const ENVIRONMENT_FLAG: Record<ConsultationCapability, string> = {
  'file-attachments': 'ENABLE_FILE_ATTACHMENTS',
  scheduling: 'ENABLE_CONSULTATION_SCHEDULING',
};

/**
 * Server-side release gate for consultation capabilities whose domain and
 * security contracts exist before their product surface does. Disabled is the
 * safe default; do not expose these flags through NEXT_PUBLIC_* variables.
 */
export function isConsultationCapabilityEnabled(
  capability: ConsultationCapability,
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  return environment[ENVIRONMENT_FLAG[capability]] === 'true';
}
