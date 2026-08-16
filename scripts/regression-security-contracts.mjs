import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const functionsSource = read('functions/index.js');
assert.doesNotMatch(functionsSource, /exports\.(getJoinToken|onRoomEnd|manualDeleteSummary|getDeletionStats)\b/);

const passwordResetSource = read('app/api/password-reset/route.ts');
assert.doesNotMatch(passwordResetSource, /getUserByEmail|export const GET|providerData|user-not-found/);
assert.match(passwordResetSource, /GENERIC_RESET_MESSAGE/);

const webhookSource = read('app/api/webhook/route.ts');
assert.match(webhookSource, /verification_not_configured/);
assert.doesNotMatch(webhookSource, /verification_disabled|JSON\.stringify\(event,\s*null/);

const speechSource = read('app/room/[room]/doctor/hooks/useSpeechCapture.ts');
assert.match(speechSource, /patientConsentConfirmed/);
assert.match(speechSource, /doctor-device-browser-speech-recognition/);
assert.doesNotMatch(speechSource, /document\.addEventListener/);

const invitationSource = read('lib/invitations/validate-service.ts');
assert.match(invitationSource, /hashSecuritySignal/);
assert.doesNotMatch(invitationSource, /'audit\.accessAttempts':\s*\[\.\.\./);
assert.doesNotMatch(invitationSource, /metadata:\s*\{[\s\S]{0,300}\bip:\s*input\.clientIP/);
assert.doesNotMatch(invitationSource, /deviceFingerprint|geolocation|ip-api\.com/);

const patientInvitationSource = read('app/invite/[token]/page.tsx');
const patientRegistrationSource = read('components/PatientRegistration.tsx');
const patientRegistrationRouteSource = read('app/api/user/register/route.ts');
assert.doesNotMatch(patientInvitationSource, /screenResolution|deviceFingerprint/);
assert.doesNotMatch(patientRegistrationSource, /screenResolution|deviceFingerprint/);
assert.doesNotMatch(
  patientRegistrationRouteSource,
  /deviceInfo|browserInfo|screenResolution|deviceFingerprint/
);
assert.match(patientRegistrationRouteSource, /hashSecuritySignal/);

assert.doesNotMatch(read('middleware.ts'), /ip-api\.com/);
assert.doesNotMatch(read('vercel.json'), /ip-api\.com/);
assert.equal(existsSync(resolve(root, 'lib/invitations/geolocation-utils.ts')), false);
assert.equal(existsSync(resolve(root, 'lib/device-utils.ts')), false);

const attachmentSource = read('app/api/session-chat/attachments/route.ts');
assert.doesNotMatch(attachmentSource, /body\.(storagePath|downloadUrl|extractedText|extractionStatus)/);
assert.doesNotMatch(attachmentSource, /extractedText:\s*null|downloadUrl:\s*null/);
const sessionMessageSource = read('app/api/session-chat/messages/route.ts');
assert.match(sessionMessageSource, /Attachment metadata must be resolved by the server/);
assert.match(sessionMessageSource, /resolveMessageReferences/);
const attachmentRepositorySource = read('lib/repositories/attachment-repository.ts');
assert.match(attachmentRepositorySource, /collection\('evidence'\)\.doc\('extraction'\)/);
assert.match(attachmentRepositorySource, /attachment\.uploadStatus !== 'ready'/);

const auditSource = read('functions/activity-log-pipeline.js');
assert.doesNotMatch(auditSource, /\n\s+(before|after):\s*(beforeSnapshot|afterSnapshot)/);

const storageRules = read('storage.rules');
assert.match(storageRules, /allow read, write: if false/);
assert.doesNotMatch(storageRules, /match \/notes\//);

assert.equal(existsSync(resolve(root, 'app/api/admin/clear-cache/route.ts')), false);
assert.equal(existsSync(resolve(root, 'app/api/migrate/fix-waiting-patients/route.ts')), false);
assert.equal(existsSync(resolve(root, 'app/room/[room]/doctor/components/NotesPanel.tsx')), false);
assert.equal(existsSync(resolve(root, 'scripts/clear-firestore-cache.js')), false);

const firestoreRules = read('firestore.rules');
assert.match(firestoreRules, /match \/reviewAssignments\/\{assignmentId\}/);
assert.match(firestoreRules, /match \/consultationSessions\/\{sessionId\}\/attachments\/\{attachmentId\}[\s\S]*allow read, write: if false;/);
assert.match(firestoreRules, /match \/appointments\/\{appointmentId\}[\s\S]*allow read, write: if false;/);
assert.match(firestoreRules, /match \/securityRateLimits\/\{counterId\}/);
assert.match(firestoreRules, /match \/summaryJobs\/\{jobId\}/);

const summaryJobSource = read('lib/repositories/summary-job-repository.ts');
assert.match(summaryJobSource, /nextAttemptAt/);
assert.match(summaryJobSource, /FieldValue\.increment\(1\)/);

const summaryWorkerSource = read('app/api/summary/process-queue/route.ts');
assert.match(summaryWorkerSource, /CRON_SECRET/);
assert.match(summaryWorkerSource, /claimDue\(5\)/);

assert.equal(existsSync(resolve(root, 'app/faculty')), false);
assert.equal(existsSync(resolve(root, 'app/professor')), false);
assert.equal(existsSync(resolve(root, 'app/api/faculty')), false);

console.log('Security architecture regression contracts passed.');
