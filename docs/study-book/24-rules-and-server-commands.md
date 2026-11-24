# 24. Rules and server commands are separate security boundaries

## The LiveKit boundary to trace

Firebase client rules and server authorization protect different access paths.
The client SDK can be constrained by deployed rules. Administrative server
access requires application policy in its own routes and services. A strong
rules file does not excuse a server endpoint that trusts caller-supplied
ownership, and a strong server service does not excuse permissive client
writes to records that service later treats as authoritative.

The consultation-integrity repair chose server-owned encounter writes. That
removes a second client write policy for identity and lifecycle fields while
preserving permitted participant reads. The design cost is that browser
clients cannot repair arbitrary records directly. That is an intentional
boundary, not a reason to reopen client writes for convenience.

## A worked investigation

Retrieve active rule source through authorized tooling and compare it to the
reviewed repository file using a documented normalization method. Then test
the matching policy in an emulator with synthetic patient, doctor and
unrelated identities. Include denied create/update/delete and allowed reads
for supported current and legacy shapes.

The earlier audit discovered active source drift after a merge. The subsequent
authorized release deployed Firestore rules only and verified the resulting
source. A later defense pass introduced another room/call creation restriction
that its own report still marked pending publication. These are distinct
releases. Never use a successful older source match to claim a newer rule
change is already active.

## Exercise with answer

A client is denied when attempting to create a consultation, while a server
command can still write it. Is that inconsistent? It can be exactly the
intended architecture. The server command authenticates the actor, checks
ownership and applies lifecycle rules before using administrative persistence.
The distinction must be visible in tests and documentation.

Why not perform the attack directly in production? It can create false
clinical records, alter identity or expose data. Exact-source emulator tests
provide a safer way to exercise malicious inputs. A production-source match
plus bounded safe acceptance checks is a defensible release argument; it is
not an independent exhaustive penetration certificate.

## Two access paths need two proofs

The application uses trusted server code and client-facing Firebase paths. These are not interchangeable authority mechanisms. Firestore Security Rules constrain applicable client requests, while privileged server SDK operations rely on the server's own credential and authorization logic. A rule that denies a client write does not automatically inspect a trusted server mutation. A secure server route does not automatically close a direct client write that the active rules still permit.

Draw both paths to the same consultation object. On the client path, identify the authenticated Firebase principal and the rule expression. On the server path, identify token verification, capability or ownership policy, service command and privileged persistence adapter. Then ask which invariant each path enforces. If either path can mutate protected state without the intended relationship, the system remains vulnerable even when the normal interface uses the other path correctly.

This explains the historical gap between a merged application fix and active production rules. Repository source can deny consultation client writes while the published policy remains older. The local test can be correct and the production acceptance still incomplete. The release record must identify the active rule source and compare it with the reviewed candidate. Do not turn a Git merge into a claim about a separately released Firebase artifact.

## Build a rule test with positive controls

Use emulators and synthetic records. Attempt a forbidden consultation write as a patient, then verify that the intended authorized read still succeeds. Try a same-role non-owner and an unauthenticated principal. For profile policy, preserve owner reads and allowed profile creation while denying cross-profile reads and role escalation. These positive controls show that denial comes from the intended policy rather than an emulator that rejects everything.

Test create and update separately. A rule can validate an existing owner field on update while allowing an attacker to choose that field during creation. A whitelist of changed fields also differs from a whitelist of all fields in a new document. Review missing fields, extra fields, malformed types and oversized values. Security policy is executable input validation as well as an ownership expression.

Retain the exact source loaded into the emulator. A test importing the wrong rule file can produce a convincing result against an irrelevant policy. Record a checksum and the emulator configuration with the evidence. When comparing deployed source, normalize only understood representation differences; do not discard meaningful text to force a match. An unexplained mismatch remains a finding requiring investigation.

## Review the trusted command boundary independently

For the server route, call the operation directly with a valid principal outside the normal UI. Attempt a cross-owner object identifier and a stale encounter binding. Confirm that the service rejects it before protected mutation. Then run the intended owner's case. A source-contract assertion that a helper name appears is useful for drift, but it does not replace behavior tests that exercise the helper's semantics.

Unexpected dependency failures should not expand access. If the database cannot establish ownership, the route must not assume that the caller owns the object. At the same time, availability failures should be classified truthfully rather than presented as ordinary empty state. A permission denial and a retryable quota outage have different meanings for both user feedback and operational response.

For an independent exercise, a direct client write is denied but the same mutation succeeds through an unprotected server endpoint. Has the rules remediation failed? The rule boundary may be working exactly as tested, while the server boundary is vulnerable. Report both facts. Security is not a score assigned to a file; it is an argument covering every relevant path to the protected effect.

End with a release checklist that separates candidate rules, emulator evidence, reviewed application code, deployed application identity and retrieved active rules. Check only the states actually observed. That discipline makes the remaining gap actionable: the next person knows whether to fix policy, test it, release it or verify the active source.

## Source trail

Read firestore.rules, functions/test/security-rules.test.cjs and the dated
rules-release and defense reports. Deployment scope, active source and test
scope must accompany every statement that a database boundary is secured.
