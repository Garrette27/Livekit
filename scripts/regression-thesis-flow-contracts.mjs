import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  validationRoute,
  validationService,
  invitationCreateRoute,
  registrationRoute,
  invitationAllowlist,
  invitationReservation,
  securitySignal,
  invitePage,
  invitationPage,
  invitationPresentation,
  historyView,
  historyPresentation,
  roomShell,
  transcriptionBridge,
  transcriptionRoute,
  summaryGenerator,
  capabilities,
  firestoreRules,
] = await Promise.all([
  read('app/api/invite/validate/route.ts'),
  read('lib/invitations/validate-service.ts'),
  read('app/api/invite/create/route.ts'),
  read('app/api/user/register/route.ts'),
  read('lib/invitations/email-allowlist.ts'),
  read('lib/invitations/invitation-use-reservation.ts'),
  read('lib/security/security-signal.ts'),
  read('app/invite/[token]/page.tsx'),
  read('app/doctor/invitations/page.tsx'),
  read('lib/invitations/invitation-presentation.ts'),
  read('app/doctor/dashboard/components/ConsultationHistoryView.tsx'),
  read('lib/consultations/history-presentation.ts'),
  read('app/room/[room]/components/shared/RoomShell.tsx'),
  read('app/room/[room]/components/shared/SessionTranscriptionBridge.tsx'),
  read('app/api/session-transcription/chunks/route.ts'),
  read('lib/services/consultation-finalization/summary-generator.ts'),
  read('lib/consultations/consultation-capabilities.ts'),
  read('firestore.rules'),
]);

assert.match(validationRoute, /await enforceRateLimit\(req, RateLimitConfigs\.INVITATION_VALIDATION\)/);
assert.doesNotMatch(validationRoute, /body\.deviceFingerprint/);
assert.doesNotMatch(invitePage, /DeviceFingerprint|navigator\.platform|screenResolution/);
assert.match(validationService, /hashSecuritySignal\('ip', clientIP\)/);
assert.match(validationService, /networkHash: hashSecuritySignal\('ip'/);
assert.doesNotMatch(validationService, /\nip: hashSecuritySignal\('ip'/);
assert.match(validationService, /waitingPatient:\s*\{/);
assert.match(validationService, /recordExistingInvitationAccess/);
assert.doesNotMatch(validationService, /getGeolocationFromIP|generateDeviceFingerprintHash|Validation debug info/);
assert.match(securitySignal, /SECURITY_SIGNAL_HASH_SECRET/);
assert.match(securitySignal, /LIVEKIT_API_SECRET/);
assert.match(securitySignal, /SECURITY_SIGNAL_KEY_CONTEXT/);
assert.match(invitationCreateRoute, /emailHashes/);
assert.match(invitationCreateRoute, /allowlistCount: emailHashes\.length/);
assert.doesNotMatch(invitationCreateRoute, /invitation\.emailAllowed\s*=/);
assert.doesNotMatch(invitationCreateRoute, /accessAttempts:\s*\[\]|violations:\s*\[\]/);
assert.doesNotMatch(registrationRoute, /Email does not match this invitation/);
assert.match(invitationAllowlist, /hashSecuritySignal\('email', normalized\)/);
assert.match(invitationReservation, /MAX_ACCESS_EVENTS_PER_INVITATION = 100/);
assert.match(validationService, /collection\('violations'\)\.doc\(violation\.type\)/);
assert.match(firestoreRules, /match \/invitations\/\{invitationId\}[\s\S]*allow write: if false;/);
assert.match(invitePage, /Unable to Verify Invitation/);
assert.match(invitePage, /Your link has not been rejected/);

assert.doesNotMatch(invitationPage, /automatically verifies patient.*device.*location.*browser/i);
assert.match(invitationPage, /Show .* more/);
assert.match(invitationPage, /View queue/);
assert.match(invitationPresentation, /reusable until expiry/);

assert.match(historyView, /aria-label="Sort consultations"/);
assert.match(historyView, /<option value="desc">Newest first<\/option>/);
assert.match(historyView, /<option value="asc">Oldest first<\/option>/);
assert.match(historyPresentation, /function sortConsultationRecords/);

assert.match(roomShell, /Allow my microphone audio to be transcribed/);
assert.match(transcriptionBridge, /!consentConfirmed/);
assert.match(transcriptionRoute, /form\.get\('consentConfirmed'\) === 'true'/);

assert.match(summaryGenerator, /SummaryJobRepository/);
assert.match(summaryGenerator, /requiresClinicianReview: true/);
assert.match(summaryGenerator, /transcriptRevision/);

assert.match(capabilities, /ENABLE_FILE_ATTACHMENTS/);
assert.match(capabilities, /ENABLE_CONSULTATION_SCHEDULING/);
assert.match(capabilities, /=== 'true'/);

console.log('Thesis invitation, consent, summary, and UI contracts verified.');
