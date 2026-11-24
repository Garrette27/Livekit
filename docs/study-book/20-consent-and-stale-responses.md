# 20. Consent versions, account refresh and stale asynchronous responses

## The LiveKit boundary to trace

An account already establishes an authentication identity. The consultation
journey should not ask someone to retype an address as though that second,
unverified string were stronger evidence. What remains necessary is informed
agreement to the current statement, recorded with the version the person saw.
The consent endpoint accepts only the current version and derives identity
from the verified account token.

Optional transcription consent is separate from the consultation agreement.
The call must remain usable with transcription off. A clinician's browser
speech-notes fallback has its own explicit start and verbal-consent
confirmation. Do not merge these controls into a generic checkbox that
silently authorizes every present and future data use.

## A worked investigation

Use an account profile with an old consent flag but no current version. The
policy should ask for the present statement rather than assume the older
agreement covered it. After the synthetic consent response succeeds, the
client reruns its single validation path, including refreshed account evidence.
It must not create a second tokenless validation route.

Now fail the signed-in token refresh. The client should show a retryable
service problem rather than silently queueing the patient as an anonymous
visitor. Delay one response across a change in account state and confirm
cleanup prevents it from overwriting the newer result. These temporal tests
protect the reliable journey without changing who the server may admit.

## Exercise with answer

The consent copy promises automatic summary deletion after a retention window.
What operational evidence should accompany that promise? Inspect retention
configuration, the scheduled worker and the scope of actual deletion. A
constant in UI copy is not proof that enforcement runs in every deployment.
The production-readiness guide explicitly treats retention approval and
configuration as separate decisions. Flag any mismatch rather than describing
an unverified promise as a measured control.

When revising a consent statement in substance, change its version so stored
agreement continues to name definite words. Do not alter historical records
to make everyone appear to have agreed to new text. Versioning preserves
meaning; it is not paperwork added after the important engineering work.

## Consent has an identity, version and scope

A checked box is evidence of a browser interaction, but durable consent needs a defined subject, purpose and version. The product distinguishes core consultation access from optional transcription. A patient should be able to complete a call without opting into the optional feature. Do not merge those decisions merely because both occur near the preflight interface. The data path must honor the optional state as well as the visible control.

Follow the account transition from signed out to signed in. The application may need to refresh profile or consent state after authentication. A response obtained for the old principal must not overwrite the new principal's state. Bind asynchronous results to the identity and request generation that created them. Cleanup should also stop obsolete polling and listeners; ignoring one promise result does not necessarily stop repeated network work.

Construct a deterministic schedule with two deferred responses. Request A starts for the anonymous visitor. Request B starts after account authentication. Resolve B first and verify the intended authenticated state. Resolve A last and assert that it is ignored. Repeat the inverse order to ensure that normal early completion still works. Then sign out before either completes. Neither result should restore account-specific state after the principal has gone away.

## Test the meaning of optional capture

For a synthetic consultation, leave transcription off and complete the core join path. Verify that the media journey does not depend on a transcription provider succeeding. Then enable capture only under the intended participant consent and verify the session binding of submitted segments. Use harmless synthetic speech or mocked segment text in local tests. Do not record a real participant's microphone to explore the feature without separate consent and authority.

The clinician's browser speech-recognition fallback has a separate interaction contract: it is labeled as browser-generated notes, started by the clinician after confirming verbal patient consent, and not described as a complete recording or transcript. That wording matters because browser recognition can omit, mishear or duplicate speech. Provenance should survive into the evidence consumed by a summary, rather than being erased by treating every text segment as equally reliable.

If consent is withdrawn or the page changes identity, consider pending work explicitly. Which audio buffers, requests or segment subscriptions remain active? Which already persisted text is subject to the approved retention policy? Do not invent deletion semantics from a checkbox alone. The operational policy must define what happens to existing evidence, and the implementation must make the relevant transitions observable without exposing clinical content in logs.

## Version changes are not ordinary refreshes

A consent version can change when the meaning of the permission changes. An old acceptance should not silently satisfy a materially different current policy merely because the same Boolean field is true. Conversely, a routine profile refresh should not invent a new consent event or ask for the same accepted version indefinitely. Model the version relationship clearly and test both current acceptance and stale acceptance with synthetic records.

Avoid a repair that catches every consent fetch error and assumes acceptance. That makes dependency unavailability expand authority. Also avoid blocking the entire core call indefinitely when only optional transcription state is unavailable. The safe behavior depends on which permission is unresolved: preserve the core journey where allowed, keep optional capture off when its authorization cannot be established, and explain the limitation inline.

For an independent exercise, imagine that a slow profile response arrives after a different user signs in on the same browser. List every state it might contaminate: displayed name, consent status, history projection, pending invitation context and capture controls. Then identify one shared lifetime boundary that can prevent the family of errors. A deep identity-scoped state owner can be easier to reason about than scattered Boolean cancellation flags, provided its interface and cleanup are explicit.

The final lesson is that time is part of authorization. A correct response can become inappropriate when applied to a different principal or revision. Tests should therefore control the ordering, not only the payload. That method transfers to admission, history, summaries and every other asynchronous projection in the application.

## Source trail

Read lib/consent/telehealth-consent.ts, app/api/patient/consent/route.ts and
docs/production-readiness.md. This chapter does not approve any retention
period or grant permission to enable transcription for a participant.
