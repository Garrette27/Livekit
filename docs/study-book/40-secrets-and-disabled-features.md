# 40. Secrets, logs, webhooks and disabled capability boundaries

## The LiveKit boundary to trace

A missing signing secret must fail closed rather than fall back to a guessable
value. A missing maintenance secret must not accidentally authenticate the
literal string undefined. A webhook must be verified before its event is
trusted. These are configuration-sensitive boundaries: the code and deployed
configuration together determine what happens.

The application uses a shared secret-comparison helper for maintenance
authorization. It hashes inputs to equal-length digests before constant-time
comparison. This narrows a timing concern but does not replace secret
rotation, protected configuration or careful logging. No comparison function
can recover confidentiality after a credential is pasted into a public
artifact.

## A worked lab

Test absent configuration, wrong credentials and the intended synthetic
credential. Use a disposable environment, never a production secret in a
test source file. For webhooks, verify that unsigned requests are refused
and that missing verification configuration does not silently enable an
unverified path. Treat delivery as a hint requiring appropriate idempotent
processing, not perfect guaranteed notification.

Attachments and scheduling remain disabled capabilities. Their reserved
names and metadata structures are preparation, not shipped user workflows.
Enabling attachments requires session-scoped storage authorization,
scanning, download policy, retention and tests. A feature flag is not the
entire security design.

## Exercise with answer

A user shares a refresh token in a screenshot. Should the investigator use it
to continue testing? No. Treat it as compromised access material and follow
the authorized account-management process. Do not repeat, persist or place it
in the thesis. Ask for a browser sign-in or established authorized connection
instead of turning a leaked token into a convenience credential.

A log records a before-and-after clinical document to make debugging easy.
What is the problem? The audit expands sensitive-data exposure and retention
without necessarily improving the narrow investigation. Prefer metadata-only
events, stable bounded error categories and purpose-limited aggregate
observations. Logging is another data system that needs its own boundary.

## Source trail

Read token-utils.ts, admin-secret-auth.ts, app/api/webhook/route.ts and
docs/production-readiness.md. Prepared features must remain server-disabled
until their explicit security gates and user workflow are implemented.
