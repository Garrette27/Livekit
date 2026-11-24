# 55. Rollback, retention, backups and prototype readiness

## The LiveKit boundary to trace

A secure endpoint is not a complete operational security program. Retention,
backup restoration, incident response, access provisioning and deletion
verification require policies and configurations beyond route code. The
production-readiness guide explicitly distinguishes implemented controls
from governance and certification decisions.

Retention must account for data classes separately: temporary audio,
transcript evidence, summaries, chat, waiting rows, invitation signals, audit
events and provider-managed logs or backups. A scheduled summary cleanup does
not automatically delete every derivative or backup. A UI promise should be
checked against the approved and enabled enforcement path.

## A worked operations review

Choose a synthetic retention record in isolated staging. Verify the policy
window, worker authorization, eligible-record selection, deletion outcome and
the subsequent read. Do not enable production cleanup to discover how it
works. Preserve rollback and recovery considerations before any operation
that makes data difficult to restore.

For backups, distinguish an export existing from a restoration procedure
being tested. A copy can be incomplete, encrypted under unavailable keys or
incompatible with the expected recovery path. Record the tested restore
scope, timing and integrity checks. Avoid claiming disaster recovery from
the mere presence of a download link.

## Exercise with answer

A panel asks whether the prototype is HIPAA compliant. What can the engineering
team responsibly say? Describe the implemented safeguards and their evidence,
then state that compliance requires contracts, risk assessment, operations,
training, retention governance and independent review. A repository or test
count does not certify a medical service.

Why preserve a failed baseline in the study package? It demonstrates what
changed and prevents the current pass from erasing known risk history.
Preservation should not include real clinical content or leaked credentials.
The useful durable artifact is the bounded observation, source state and
reproduction method, not every sensitive byte captured during the incident.

## Foundational systems reading - adapted companion material

These adapted recovery readings emphasize observable checkpoints and tested restoration. Apply them only in an authorized isolated environment. They do not establish that the prototype already has a complete disaster-recovery program.

## Supplied systems reference - page 160

Recovery needs equally concrete evidence. A backup file's existence proves little until you restore it to an isolated destination and check meaningful data through the intended access path. A restore drill should measure elapsed time, document required credentials and tooling without exposing secrets, and identify which changes after the backup would be lost. Code rollback and data restoration solve different failures.

## Supplied systems reference - page 162

The finished runbook should be executable by another developer without guessing which process to replace or which storage to restore. It succeeds when every checkpoint has concrete evidence, every recovery action identifies its scope, and one unresolved assumption is paired with a narrow experiment that could settle it before a real release.

## Source trail

Read docs/production-readiness.md, docs/cost-control-and-migration.md and
docs/testing/verification-status.md. The remaining capstones require you to
apply these distinctions independently rather than memorize a claim that
the whole application is simply ready.
