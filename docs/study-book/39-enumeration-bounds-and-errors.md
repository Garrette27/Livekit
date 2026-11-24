# 39. Review account enumeration, input bounds and error disclosure

## The LiveKit boundary to trace

An error response can reveal more than the product intends. A login fallback
that searches profiles to distinguish unknown account from wrong password
can expose account existence. An invitation form that reports whether a
patient email already has an account can do the same. Generic public failure
responses preserve privacy while trusted internal diagnostics remain bounded.

Input bounds address a different risk. Authenticated callers can still send
oversized names, allowlists, chat text or summary edits. The current baseline
uses explicit type and size contracts rather than assuming that the normal
form is the only client. The allowlist, display name, summary fields and edit
history each need a bounded representation.

## A worked lab

Use synthetic credential failures and compare the public response for
different account-existence fixtures. Do not enumerate real accounts.
Inspect source for fallback database searches that bypass the generic
response. Then test summary-edit fields at their boundaries: wrong types,
oversized lists, oversized entries and allowed short content.

For unexpected exceptions, assert a generic failure or the shared retryable
database envelope as appropriate. A raw Firestore path error should not
become browser text. Do not paste real stack traces containing document IDs
into a classroom exercise merely to show what was masked.

## Exercise with answer

Why keep a positive bounded-input case? Otherwise a validator that rejects
every edit appears secure while preventing the clinician's legitimate work.
Security acceptance requires preserving the operation under its intended
contract, not eliminating it indiscriminately.

A summary's edit history is capped at recent entries. Does that automatically
satisfy audit-retention requirements? No. A bounded document history prevents
unlimited growth; an approved audit policy may require a different durable
event store and retention period. Resource bounds and governance are related
but separate decisions. Document the current scope rather than converting
one implementation constant into a compliance claim.

## Source trail

Inspect the login and invite-create routes, summary-edit-policy.ts and the
shared HTTP error helper. The relevant defense fixes are recorded in the
22 November report with their individual verification and deployment limits.
