# TeleConsole security remediation and thesis testing report

Assessment and retest date: 17 November 2026, Asia/Singapore.
Baseline: `fa5a33cca4b341513dae6d78538f4eeede26a92b`.
Remediation source: the `codex/security-remediation` PR and its immutable commit.

## Findings and retest conclusion

The two demonstrated profile vulnerabilities have been corrected in the active
Firestore policy. The updated policy was compiled, tested, released to
`livekit-5eef6`, retrieved through authenticated Firebase MCP, and compared with
the reviewed source. Both original attack tests now pass against that retrieved
policy in an isolated emulator. No production patient role or clinical record
was modified during attack testing.

The application and Cloud Functions dependency inventories now report zero
vulnerabilities, including development dependencies, in the candidate lockfiles.
This closes the previously observed 4 critical and 9 high application package
findings for this candidate and the advisory database at retest time. The
updated application and function packages still require their normal release;
a branch/PR is not proof that those packages are already serving production.

Real video latency, concurrent consultation capacity, and clinician documentation
efficiency remain unmeasured. The report does not label those experiments as
passed. Isolated media credentials/test accounts and a participating clinician
are required to collect the remaining results.

## Before and after evidence

| Control or experiment | Baseline | Remediation result |
| --- | --- | --- |
| Reading another user's private profile | Unauthorized read accepted by deployed rules | Denied by retrieved updated rules; owner read remains permitted in repository tests |
| Patient changes own role to doctor | Unauthorized update accepted | Denied by retrieved updated rules |
| Patient injects admin/permissions or rewrites consent | Profile-owner writes unrestricted in old policy | Denied by new focused emulator tests |
| Delete and recreate privileged profile | Old owner write path unrestricted | Client deletion denied; privileged creation requires a trusted claim |
| Application dependency audit | 23 affected production package entries, including 4 critical and 9 high | Zero findings in full candidate audit |
| Cloud Functions dependency audit | Not established by original application-only inventory | Zero findings in full candidate audit |
| Existing Storage upload test | Failed because it expected removed note uploads | Corrected to assert disabled upload behavior; passes |
| Application policy tests | 11 passed | 11 passed |
| Repository Firebase rules suite | 3 passed, 1 obsolete test failed | 7 passed, including positive owner and provisioned-doctor cases |
| Tests using retrieved deployed rules | 2 failed | 2 passed |
| Candidate local API regression suite | Not run in baseline | 23 passed, including missing-credential denial and unsigned webhook rejection |
| Type check, lint and production build | Passed after stale build-cache regeneration | Passed on Node 22 candidate |
| Media latency and simultaneous calls | Not tested | Not tested; controlled staging experiment required |
| Reviewed documentation efficiency | Not tested | Not tested; clinician paired-time study required |

Evidence is preserved separately under `evidence/2026-11-17/` (failed baseline)
and `evidence/2026-11-17-remediation/` (retest). The latter contains audit JSON,
verification exit codes, rule-test logs, retrieved active rule source, deployment
source comparison and SHA-256 checksums. Source snapshots and lockfiles in the
PR identify the candidate; test timestamps precede the final packaging commit.

## What changed and why

Private profile reads are owner-scoped. Users cannot list other profiles, alter
their role/email, inject permissions, fabricate consent evidence, or delete a
profile and recreate it with greater privilege. Client profile creation validates
the provider's email, bounded login fields, and trusted elevated-role claims.
Existing login timestamps can still be refreshed; legacy fields may remain
unchanged. Consent writes continue through the authenticated server endpoint.
Server Admin SDK access remains governed by the application's API authorization.

The login failure path no longer queries the users collection to infer whether
an email has an account. It returns a generic credential error. Existing doctor
profiles continue to work; new clinician provisioning still requires trusted
custom claims. No faculty/reviewer, scheduling or attachment UI was introduced.

Next.js was updated to the patched 15.5 line, React and LiveKit libraries were
updated, Firebase client libraries remain on the compatible 12.x line, and
Firebase Admin and Functions dependencies were updated. Narrow overrides pin
patched gRPC, PostCSS and minimatch versions, and compatible Firebase app/database
packages, instead of accepting npm's suggested major-version downgrades. Node
22 is declared explicitly. Both lockfiles are included. CI now fails on high or
critical audit findings as well as running existing policy/build/rules checks.

An active-rules snapshot is necessary because the original issue was deployment
drift: stricter code in Git did not imply stricter rules in Firebase. Future
releases should retain the active-rule comparison alongside the normal tests.

## Remaining threats and interpretation

The remediation blocks new profile escalation through these paths. It does not
prove no account was altered while the former policy was active. Review existing
clinician/admin accounts against the authors' approved roster before clinical
use; do not automatically demote historical doctors or rewrite patient data.

The emulator tests execute the downloaded rule source with synthetic accounts.
They do not constitute malicious writes to production or exhaustive testing of
every application endpoint. The prior 20 missing-credential HTTP rejections
remain baseline evidence, not a complete authenticated end-to-end retest of the
candidate. The candidate's 23 local API regression cases also passed; these are rejection
tests and do not substitute for successful authenticated consultations.
Deployed Storage policy retrieval was blocked in the original read; the passing
Storage tests describe repository policy. The rule release changed
Firestore only. There is no assertion of HIPAA, ASVS-level, or medical-device
certification.

## Text for Chapter III

The researchers evaluated authorization using synthetic accounts and isolated
Firebase emulators. Test cases included owner access, cross-user profile access,
role escalation, privilege-field injection, profile replacement, and provisioned
clinician access. The active Firestore rule source was retrieved and compared
with the repository to distinguish implementation intent from deployment
enforcement. Dependency inventories were audited using locked package versions.
Each failure was retained as baseline evidence and repeated after remediation.

Performance evaluation is organized separately into browser/API response time,
WebRTC media quality, simultaneous consultation load, and AI documentation
efficiency. Acceptance thresholds and repeated-trial procedures are specified
in the performance protocol. Provider response time alone does not establish
clinician time savings or clinical accuracy.

## Text for Chapter IV

The baseline assessment identified two authorization failures in the active
Firestore rules. A signed-in synthetic user could read another profile and
change their own role to doctor. After remediation and deployment verification,
both original attack cases were denied in an emulator using the retrieved
updated rule source. Seven repository rules cases and eleven application policy
tests passed. Audits of both updated dependency trees returned zero findings at
the time of the retest.

The public-page HTTP pilot remains limited to ten sequential observations per
page. Its results cannot establish WebRTC media latency, simultaneous-call
capacity, or documentation efficiency. Those outcomes will be reported after
controlled paired-call trials and a clinician-reviewed documentation study.

## Remaining experiment protocol

Use the complete thresholds and sample design in `performance-assessment.md`
and the cases in `remaining-experiments.md`. At minimum, run 1, 3 and 5 paired
consultations on isolated staging; five simultaneous calls require ten media
clients. Record per-direction RTT, jitter, interval packet loss, delivered FPS,
bitrate, reconnect events and admission-to-media time. Preserve device/network
conditions and repeated-run variation. HTTP request load alone is insufficient.

For documentation efficiency, compare manual documentation time against AI
generation plus clinician review and correction on the same deidentified case
set, using a counterbalanced order. Record factual omissions and unsupported
statements as well as time. Without a reviewer, the study cannot claim reduced
clinical documentation effort. Use `record-performance.mjs` to validate completed
observations; an empty dataset produces NOT TESTED rather than a fabricated pass.

## References

OWASP ASVS 5.0.0: https://asvs.owasp.org/downloads/

OWASP WSTG 4.2: https://wstg.owasp.org/v4.2/

NIST SP 800-115: https://csrc.nist.gov/pubs/sp/800/115/final

ISO/IEC 25010:2023: https://www.iso.org/standard/78176.html

Firebase rule testing: https://firebase.google.com/docs/rules/unit-tests

WebRTC statistics: https://www.w3.org/TR/webrtc-stats/
