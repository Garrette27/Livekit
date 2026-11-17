# TeleConsole security assessment

## Assessment conclusion

TeleConsole does not currently meet the proposed release criterion of preventing
cross-user profile access and self-assigned elevated roles. The production
Firestore rules retrieved on 17 November 2026 differ from the repository rules.
Two synthetic emulator tests loaded with that deployed source allowed both
operations that should have been denied. No real patient profile was read in
those attack tests, and no production role was changed.

The application passed 11 existing policy tests and 20 anonymous API rejection
probes after correcting two probe inputs. These results demonstrate specific
controls; they do not cancel the database authorization failures.

## Purpose and scope

This assessment supports the thesis objective concerning secure and reliable
consultations. It examines the Next.js application, signed invitation policy,
Firebase authorization, dependency exposure, and deployment consistency.
OWASP ASVS 5.0.0 supplies verification themes, WSTG 4.2 supplies testing
techniques, and NIST SP 800-115 supplies assessment planning and reporting
principles [1–3]. The selected tests do not constitute verification of every
requirement or an ASVS assurance level.

Code: `fa5a33cca4b341513dae6d78538f4eeede26a92b` from Garrette27/Livekit.
The frontend production alias was resolved to deployment
`dpl_FzHC1v6uwfCc1vcAeB8vzQV1kz7o`, which carries the same commit.
Database: `livekit-5eef6`, `(default)`, Standard edition, asia-southeast1.
Tests ran on WSL2 Linux, AMD Ryzen 5 5500GT, Node 20.20.2. Firebase emulator
tests used Java 21 and Firebase CLI 15.36.0. The existing local `AGENTS.md` and
lockfile edits were preserved. Dependency results separately use the committed
lockfile, while build/policy checks used the installed local dependencies.

Production inspection was read-only. Synthetic rule tests used isolated emulator
data. No password guessing, saturation traffic, valid patient invitations,
production malicious payloads, or successful clinical mutations were attempted.

## Acceptance and result vocabulary

PASS means the stated observed behavior met a case's criterion. FAIL means a
case violated that criterion. NOT TESTED means no adequate execution evidence
exists. BLOCKED means a required read or setup failed. NOT APPLICABLE means the
feature is deliberately disabled. A test defect is recorded separately from an
application vulnerability. Severity is an engineering judgment, not a clinical
or regulatory certification.

For authorization, the criterion is zero successful unauthorized reads/writes.
For dependency hygiene, the proposed criterion is zero untriaged high or
critical production dependency findings. These are project acceptance criteria,
not automatic pass levels prescribed by ISO.

## Executed results register

| ID | Case and criterion | Result | Evidence |
| --- | --- | --- | --- |
| SEC01 | Existing security/policy suite exits zero | PASS, 11 tests plus two source-contract scripts | policy.log |
| SEC02 | Twenty protected endpoints reject missing credentials | PASS after input correction, 20/20 return 401 and success false | assessment.json and auth-retest.json |
| SEC03 | Deployed rules deny another user's profile read | FAIL, synthetic read succeeded | rules.log, deployed rule source |
| SEC04 | Deployed rules deny patient changing own role to doctor | FAIL, synthetic update succeeded | rules.log, deployed rule source |
| SEC05 | Repository rules deny operational access, patient summary read and self role elevation | PASS, three existing emulator cases | rules.log |
| SEC06 | Existing Storage regression suite agrees with disabled uploads | FAIL in test expectation; denied PNG upload is correct current product behavior | rules.log, storage.rules |
| SEC07 | No untriaged high/critical production dependency findings | FAIL, 9 high and 4 critical package findings | dependency-audit.json |
| SEC08 | Public responses include HSTS, nosniff, frame denial and CSP | PASS for presence on sampled pages | assessment.json |
| SEC09 | Complete authenticated consultation and cross-session isolation | NOT TESTED | remaining-experiments.md |
| SEC10 | Deployed Storage rules match reviewed version | BLOCKED, authenticated rules read failed | firestore-aggregates.json |
| SEC11 | Revoked, expired, tampered invites and replay denied end to end | NOT TESTED; policy tests cover only part of this claim | remaining-experiments.md |
| SEC12 | Active ZAP assessment and signed/forged webhook comparisons | NOT TESTED | remaining-experiments.md |

The original SEC02 runner submitted `{}` everywhere. Eighteen requests reached
authorization and returned 401. The admission-check and mark-left routes first
returned 400 for missing required identifiers. Their retest used synthetic
identifiers and no credential; both returned 401. The original 400 responses
were not unauthorized successes and are not classified as vulnerabilities.

## Findings and remediation recommendations

### F01 Deployed rules permit role changes and broad profile reads

Severity: critical deployment authorization gap. The active `/users/{userId}`
rule permits reads whenever `request.auth != null` and permits owner writes
without immutable-role constraints. Firestore reads return whole documents;
a comment saying only email and role are visible does not restrict fields.
The isolated tests used `assessment-patient` and `assessment-other`, proving
cross-user reads and a patient-to-doctor role update were accepted by that rule
source. This is evidence of database policy failure, not proof that every
downstream clinical API can be exploited using the changed profile.

The repository has stricter user rules. Review and deploy the intended Firestore
rules through the normal release process, verify provisioned clinician custom
claims, and rerun both positive and negative authenticated journeys. Preserve
this failed baseline and put remediation results under a new run identifier.
Do not close F01 merely because the repository's rules tests pass.

### F02 Dependency findings require triage

Severity: high release hygiene gap, with critical advisories in the dependency
inventory. `npm audit --omit=dev --package-lock-only --json` against committed
package files returned 23 package findings: 4 critical, 9 high, 9 moderate and
1 low. Counts describe affected packages, not 23 distinct verified exploits.
Read each advisory and determine installed version, runtime reachability,
required configuration, patched versions and regression impact. Upgrade in a
separate tested change; a blanket forced downgrade is not a remediation plan.
The complete advisory URLs and affected ranges are preserved in the evidence.

### F03 Storage regression tests describe a removed feature

Severity: test/release integrity defect. The fourth existing Firebase case
expects a PNG upload to `notes/doctor-1/room-1/note.png` to succeed, but current
Storage rules intentionally deny every client path and the attachment feature
is disabled. Three existing cases pass and one fails. Update that obsolete test
to assert denial under the disabled capability and add separately gated tests
when attachments are actually implemented. Do not loosen Storage to satisfy
the obsolete test.

### F04 A duplicate Vercel project cannot build

Severity: operational reliability defect. The frontend project is READY at the
tested commit. The separate project named `livekit` is ERROR at the same commit:
its build log says the Root Directory `livekit-frontend` does not exist. Identify
whether the duplicate is intended; correct its root or retire it through a
separate approved configuration change. This does not mean the active frontend
deployment failed.

### F05 Lifecycle and consent evidence need careful interpretation

The aggregate read found 202 invitations, including 81 stored as active whose
expiry timestamps are already past. Expiry must remain checked at authorization
time; a stale status alone is not evidence of usable expired access. Of 21 user
profiles, 20 have no `consentVersion`. Legacy absence does not establish missing
consent during a new call because current validation can ask again. There are
149 waiting rows and 119 consultations, including old waiting/admitted/active
labels. They must not be reported as simultaneous participants. See the exact
masked aggregates before deciding on additive cleanup and retention work.

## Limits and recommended closure evidence

Admin/MCP credentials bypass client rules for inspection; successful aggregate
reads do not prove patient authorization. The emulator reproduces the retrieved
rules but does not reproduce all production IAM, API configuration, or identity
provider behavior. No evidence of historical exploitation is asserted.

The database reports point-in-time recovery and delete protection disabled.
That is a recoverability configuration observation; backup existence and restore
time were not tested. The recent Vercel log query returned no groups over its
30-minute window before these probes, which does not demonstrate long-term
availability. Stored transcript/summary content was excluded from collection
field masks. No assessment artifact contains clinical content.

Close the release assessment only after F01 remediation is verified, high and
critical advisory disposition is recorded, the Storage test is corrected, and
the remaining authenticated isolation, invitation and webhook cases are run.

## References

[1] OWASP, Application Security Verification Standard 5.0.0.
https://asvs.owasp.org/downloads/ (accessed 17 November 2026).

[2] OWASP, Web Security Testing Guide 4.2.
https://wstg.owasp.org/v4.2/ (accessed 17 November 2026).

[3] NIST, SP 800-115, Technical Guide to Information Security Testing and
Assessment, 2008. https://csrc.nist.gov/pubs/sp/800/115/final

[4] Firebase, Build unit tests for Security Rules.
https://firebase.google.com/docs/rules/unit-tests
