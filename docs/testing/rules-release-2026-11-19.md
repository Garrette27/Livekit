# Firestore rules release acceptance

19 November 2026, Asia/Singapore. Explicit owner approval to deploy the merged
consultation-write restrictions. Reviewed source commit: add9a04 (rules from
PR #8); no product source changes were needed for this release.

## Executed release and evidence

- Firebase CLI 15.36.0 deployed only firestore:rules to livekit-5eef6.
- Compilation and publication completed successfully (exit 0).
- Active source was retrieved through authenticated Firebase tooling and
  normalized against the reviewed file: exact match.
- Normalized SHA-256:
  dd864ad4bb41db008b24e853e83c293a5c515a2a6f57e56c938587bfdbee9876.
- The active consultation policy now denies all Firebase client writes, including
  patient create and owner identity/lifecycle rewrites. Authorized server Admin
  services remain the command boundary; participant reads remain in the policy.
- All 12 maintained Firestore/Storage emulator tests passed against the local
  source equivalent to the retrieved active Firestore policy. Storage tests
  describe repository policy; active Storage retrieval remains blocked.
- Four live missing-credential probes returned JSON 401: doctor-access,
  user/role-conflict, patient/consultations and waiting-room/list.
- Remote Quality and security CI for add9a04 completed successfully.

Evidence directory: evidence/2026-11-19-rules-release/. It includes deployment
log, exact active source, matching result, emulator log, public probe outcomes
and SHA-256 manifest. Previous failed deployment-drift evidence is unchanged.
No malicious production writes, clinical record reads, data migration, indexes,
Storage rule publication or Functions deployment were performed.

## Acceptance boundaries

The specific Firestore deployment-drift finding is resolved. This does not
establish comprehensive production security acceptance. Authenticated positive
and negative doctor/patient controls and direct application commit verification
remain pending. Vercel inspection still returns team-scope 403; the preceding
authorization attempt returned team-not-found. GitHub deployment status alone
does not replace direct metadata or a successful user journey.

Media latency, concurrent-call capacity and clinician efficiency remain NOT
TESTED. Existing local queue efficiency passes are operation-count invariants,
not media benchmarks. Continue with the isolated staging protocol and numeric
WebRTC observations from both endpoints; clinician time savings require an
actual reviewer and paired baseline. No paid AI requests were made.

Reproduction scripts: scripts/thesis/deploy-reviewed-rules.mjs is a production
write and must only run under explicit deployment authority. The read-only
recon script plus scripts/thesis/verify-rules-release.mjs verify source, public
denials and synthetic emulator behavior. Do not run production attack writes.
