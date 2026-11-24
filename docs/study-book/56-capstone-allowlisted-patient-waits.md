# 56. Capstone: an allowlisted patient is still waiting

## The case and the safety boundary

A fictional clinician creates an invitation for a synthetic patient account. The invitation preview says that one verified account can enter directly. The patient opens the link in a private browser window, sees the waiting page, signs in, and still appears to wait. A teammate concludes that the allowlist is broken. Your task is to investigate that conclusion without weakening admission. Do not solve this exercise by admitting every visitor who types the allowlisted address. That would replace an inconvenient symptom with an identity vulnerability.

The case has several plausible explanations. The browser might hold an anonymous Firebase identity. The account might be signed in but lack a provider-verified email. The signed-in email might differ from the invitation entry after normalization. The invitation might have expired or been revoked. The browser might be rendering a response from the earlier anonymous attempt. A request might be failing before the admission decision is reached. Finally, the system may have correctly admitted the patient while the visible component still shows its earlier state. These explanations predict different observations. Treat them as alternatives, not as an unordered checklist of things to change.

Use local emulators and synthetic fixtures for the worked experiment. A production invitation supplied by a user is not a general license to mint repeated tokens, consume uses, or collect its bearer secret in a report. If a live observation is separately authorized, prefer a bounded status observation and masked metadata. The study book itself neither performs nor authorizes that live experiment.

## Build an evidence ladder

Begin with the smallest statement the screen supports: this browser is displaying a waiting state. It does not yet establish that the server denied a verified account, that the invitation is valid, or that the owning clinician has no queue row. Record the browser profile, source revision, environment, synthetic run label and time. Do not record the complete invitation URL or an authentication header. Keep the time zone explicit so the invitation expiry and browser clock can be compared coherently.

Next inspect the relevant application request in Network. Identify the actual endpoint, method, status, response type and request initiator. A JSON response saying that the visitor is waiting is substantially different from a framework HTML error page. If the response is HTML with a server error, stop reasoning as though a normal admission policy decision occurred. Follow the matching server failure and its runtime boundary instead. A client parsing exception is a secondary symptom when the upstream contract was not delivered.

For a valid JSON decision, inspect claim shape through a safe diagnostic projection. You need to know whether the principal is anonymous, whether the provider says the email is verified, and whether the verified normalized address matches the persisted invitation policy. You do not need to publish the address itself. A report can state that verification was false or that the normalized values differed. Never infer verification merely because a display name, profile document or login button is present.

Then establish that the persisted invitation is the one referenced by the signed capability. Validate the signature through the normal server path; decoding a token locally is not verification. Check the invitation identifier, room binding, status, expiry and use policy in the fixture. A convenient display of the room name does not prove those constraints. If the identifier and room disagree, the expected result is rejection, not a fallback to whichever room happens to exist.

## The controlled fixture sequence

Create one reusable synthetic invitation with a future expiry, an owning clinician and one verified allowlist address. Give the waiting queue enough capacity for the planned cases. In the first case, redeem without a signed-in non-anonymous account. Expect a waiting-scoped result, not direct consultation access. Verify the token grants through a local decoded test assertion, without placing the raw token in saved evidence. The waiting token must not provide the consultation room's publish, subscribe or data rights.

In the second case, present a valid Firebase test identity whose email equals the allowlist but whose verification claim is false. Expect waiting rather than direct admission. This is an important negative control because it distinguishes an email comparison from an identity-qualified admission decision. In the third case, use a non-anonymous verified identity with a different address. Again expect waiting. In the fourth, use the intended verified allowlisted identity and expect the direct path, provided every other invitation condition remains satisfied.

Repeat the fourth case with an expired fixture, then a revoked fixture, then a room-binding mismatch. Those changes must remove access even though the account is still the intended person. The contract is a conjunction of constraints. A verified allowlist match is not an override for revocation or expiry. Keep the fixtures independent so a failed case cannot contaminate the next by consuming a one-use invitation or filling the queue.

Now test the browser transition. Hold the anonymous response artificially, complete a signed-in request, and release the old response last. The authenticated state must not be replaced by obsolete anonymous state. This experiment tests client response lifetime, not server admission. Label it separately. A request-generation guard or cleanup can make stale results inert, but the implementation must also stop obsolete polling and subscriptions; suppressing one render does not prove resource cleanup.

## What the observations mean

Suppose all server cases pass but the delayed anonymous response recreates the waiting screen. The finding is a client race with a concrete schedule: request A starts anonymously, request B starts after authentication, B succeeds, then A overwrites B. The narrow repair preserves the server boundary and binds asynchronous work to the identity or generation that created it. A regression should force that ordering rather than hope that a fast laptop reproduces it by chance.

Suppose the verified test identity enters directly, but the real browser's safe claim projection says anonymous. The next question concerns the login transition and request credential attachment. Rewriting invitation storage would not address that evidence. Check whether the request starts before authentication settles, whether the current account's ID token is obtained, and whether the request uses the authenticated server helper. Do not copy a token manually from another tab as a permanent repair; that obscures the actual ownership and renewal path.

Suppose the request receives a retryable service error because the database quota is exhausted. The correct interface should distinguish temporary unavailability from waiting for admission. Returning an empty queue or a success-shaped waiting response would make a service outage look like a normal clinical workflow. Preserve a bounded retry policy, useful modeless feedback and the patient's ability to understand what remains incomplete. Retrying every render is not recovery; it can increase the load on the failing dependency.

## A worked answer for the clinician

A useful explanation might read: “The synthetic verified-account admission cases passed against the pinned local server implementation. The browser reproduction showed an obsolete anonymous response updating the waiting component after sign-in. The proposed client correction ignores results from the replaced identity and cancels its polling lifetime. Production release and an authorized end-to-end confirmation remain separate steps.” Each sentence states a different kind of evidence. None claims that a local fixture proves the deployed app is repaired.

An unhelpful explanation would be: “Google login is unreliable, so we removed waiting checks.” It names a provider without discriminating evidence and abandons the security requirement. Another unhelpful explanation is that an account has “the right email” without saying who asserted it. The clinician's legitimate goal is timely access for the intended patient, not a bypass of proof. Strong design makes that distinction understandable while keeping the decision on the server.

## Independent exercise and answer

You see a verified allowlist match and a waiting response. What is the next decisive observation? Establish that the response belongs to the same authenticated request and persisted invitation, then inspect the remaining conditions. A screenshot of account settings is not enough. The response could be stale, the invitation could be revoked, or the request could carry credentials from another account. Correlation must be exact without exposing secrets.

What must the final test record contain? Include fixture identities as labels, source baseline, executed cases, positive and negative outcomes, response-generation ordering, and limitations. Include the expected denial for an unverified match. Exclude raw bearer capabilities, real emails, access tokens and unrelated network requests. A concise reproducible record is more defensible than an enormous unredacted capture.

The capstone is complete when another student can reproduce the distinction between server policy and client presentation, explain why direct admission requires verified identity, and propose a repair whose scope matches the evidence. It is not complete merely because the waiting screen disappears. That visual outcome could also be produced by a dangerously permissive token issuer.

## Source trail

Trace docs/invitation-access-model.md, docs/invitation-flow-design.md,
docs/access-control.md, lib/services/invitation-access/invitation-access-core.ts
and the invitation/waiting-room
API routes at the pinned baseline. Endpoint details should be followed in the
repository rather than inferred from this fictional scenario. The experiments
in this chapter are instructions and worked interpretations, not newly executed
production results.
