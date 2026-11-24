# 17. Follow verified Firebase claims into server permissions

## The LiveKit boundary to trace

Authentication establishes a caller; authorization decides what that caller
may do. The shared request-auth module reads a Bearer header, asks Firebase
Admin to verify the token, and returns a normalized requester. It carries
email verification explicitly rather than treating the presence of an email
string as proof of control. A permission check then resolves a recognized
role from trusted claims or a server-read profile.

Resource ownership is still a separate domain check. A doctor role does not
grant every doctor's invitations, rooms or summaries. A future reviewer role
does not grant a collection-wide clinical read. The permission map states
which kinds of actions a role may attempt; the resource boundary decides
whether this actor owns or has an exact assignment for the requested record.

## A worked investigation

Use a synthetic patient token against a doctor-only command. Assert the
denial, then use a provisioned doctor fixture and test ownership of two
different doctors' resources. Finally simulate a profile-read outage. The
service must not guess a default privileged role because Firestore is
temporarily unavailable. A retryable availability response can preserve
honest feedback while still failing closed.

Inspect the path for missing configuration separately. An uninitialized
authentication service is not a valid token denial, and neither should be
silently converted into a successful anonymous action. Error vocabulary helps
operators distinguish a bad credential from a broken dependency without
revealing sensitive internals to the browser.

## Exercise with answer

A client hides the doctor navigation when profile.role is patient. Is the
doctor endpoint protected? Not from that observation. Exercise its server
authorization and ownership checks. A request can be sent without using the
normal navigation. Conversely, an authorized endpoint can exist without a
visible UI for a reserved feature; hiding the feature does not remove the
need for deny-by-default policy.

Consider a reviewer assignment with empty identifiers on both sides. Equality
alone can say they match. The policy must require meaningful identifiers,
bounded metadata and valid time evidence before comparison. The November
follow-up hardened that pure preparation policy without exposing a faculty
route. Describe that as defense-in-depth readiness, not as proof that a live
faculty dashboard was secured.

## Trace a principal through the server boundary

Start with the request, not with the navigation menu. A hidden button is an interaction choice; a direct HTTP request can still reach the server. Identify how the route obtains credentials, verifies them and constructs its trusted principal. Then locate the permission decision for the requested object. A role name in a profile document is not automatically a trusted claim, especially if the client can edit that field. The provenance of the role is part of the security model.

Make the authorization question concrete: may this principal perform this command on this encounter now? The word “doctor” alone is incomplete. A clinician should not automatically gain access to every other clinician's consultation. Ownership, participant relationship and the command's scope still matter. Similarly, a patient role does not authorize access to another account's history. Capability names should make the operation visible rather than hiding broad authority behind a generic authenticated check.

Use three synthetic principals: an owner, a same-role non-owner and an unauthenticated caller. For each operation, write expected outcomes before running it. The same-role non-owner case is especially important because a role-only implementation can pass both the owner and unauthenticated tests. Add a malformed or missing assignment case for any prepared reviewer policy. Denial should be the default when the relationship cannot be established reliably.

## Separate claim verification from profile convenience

A profile is useful for display and preferences. It may also contain role-related metadata, but client mutability must be constrained. The profile rules examined in the earlier security work protect identity, permissions and role fields from unauthorized client changes. The corresponding positive controls matter: owners should still read their own profile and permitted login timestamps should still refresh. A rule that denies every request is not a successful access-control implementation.

Provider email verification is another distinct claim. A string stored in a profile does not inherit verification merely because the account signed in successfully. Follow the trusted token claim used by the direct-admission policy. If it is absent or false, a matching allowlist address must not bypass waiting. This conservative branch preserves the distinction between possession of a login session and proof of the intended address.

Do not make correlation signals into authentication factors. Keyed hashes can help relate bounded audit events without retaining raw IP addresses or device details, but they do not establish patient identity. A repeated browser signal can belong to different people on a shared machine, and a single person can use different networks. Security copy should describe the actual verified-account policy, not promise automatic location or device verification that the implementation does not provide.

## Prepared RBAC is not a released reviewer workflow

The faculty reviewer role remains backend-only preparation. Its existence does not justify a route, dashboard or broad clinical-data permission. An actual reviewer feature would need assignment scope, allowed projections, audit expectations and a review interaction design. A blank assignment identifier or malformed expiry must not accidentally mean unrestricted access. The denial behavior is a useful test even while the feature remains disabled.

When reviewing a proposed role change, ask which object relationship it adds and which existing callers gain authority. A new enum value can be harmless by itself but dangerous if a default branch treats every non-patient as a clinician. Exhaustive handling and explicit capabilities make that risk easier to see. Test unknown values as well as known roles where the boundary accepts external data.

For the independent exercise, explain why a valid Firebase token is necessary but not sufficient for a clinician's session mutation. Verification establishes the principal. Authorization establishes the principal's permitted relationship to the object and command. Keeping those steps separate produces a server interface that is both easier to audit and harder to misuse from a second client.

## Source trail

Read lib/services/shared/request-auth.ts, lib/auth/access-policy.ts and
lib/auth/review-assignment-policy.ts. Claim parsing, role permission and
resource ownership should remain distinguishable in your explanation.
