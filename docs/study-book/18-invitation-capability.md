# 18. An invitation is a bearer capability, not a patient identity

## The LiveKit boundary to trace

A signed invitation proves that its holder possesses a grant issued by the
service. The link can be forwarded, photographed or pasted into another
browser. Its signature prevents undetected modification of signed claims; it
does not identify the human holding the link. The application therefore
combines capability access with verified account evidence and human admission.

Every token-issuing path must check more than cryptography. Persisted
invitation identity, room binding, active state, expiry, ownership, use policy
and applicable capacity remain current authority. A valid old signature can
refer to a revoked record. The database record exists partly so the doctor
can stop future issuance without pretending that a signature can be edited
after it was given to a visitor.

## A worked investigation

Use the same synthetic invitation under several identities: no account,
anonymous account, unverified email account, verified non-allowlisted account
and verified allowlisted account. Only the final case should skip the queue
when the allowlist is configured accordingly. Then revoke the persisted
invitation and repeat validation. The correct decision must change even if
the original token bytes are unchanged.

Typed email is useful labeling for a doctor, not evidence for direct admission.
Network and user-agent HMAC values are correlation signals, not identity
proof. A returning browser may correlate with a recent anonymous visit, but
that observation must not become an automatic clinical identity decision.
The distinction is a privacy and accessibility benefit as well as a security
one: legitimate networks, browsers and devices change.

## Exercise with answer

A visitor copies a token and edits its room claim. Why should the request fail?
The signature check detects tampering. Now keep the original signature but
change the persisted invitation's status to revoked in a local fixture. Why
should it fail again? Current server policy must refuse issuance from the
revoked grant. These tests exercise separate layers and both belong in a
defensible explanation.

A report contains the full invitation URL so another researcher can reproduce
the test. Replace it with a synthetic fixture and redacted route. A real
invitation is access material. Reproducibility should preserve the operation
and policy inputs, not distribute a live capability.

## Model the capability as a constrained promise

An invitation capability says that its holder may ask the server to follow a particular admission policy for a particular persisted invitation. It does not say that every encoded field is sufficient or that the holder is the intended patient. A valid signature protects the signed content from undetected alteration under the key; it does not make an expired, revoked or mismatched persisted invitation usable. The server must join cryptographic validity with current durable policy.

Create a small decision matrix using synthetic labels. Keep the signature valid while changing the persisted room, status or expiry. Then keep the persisted invitation valid while presenting an altered token. The expected rejection in both directions demonstrates that neither half is sufficient alone. Add an ownership mismatch for clinician actions. This matrix is more revealing than testing only a completely fabricated token, which may fail before reaching the more subtle policy checks.

Expiry also has a time boundary. Record the clock and intended comparison in the test. Do not rely on manually waiting until a real production link expires. A controlled clock makes just-before, exact-boundary and just-after cases reproducible. If UI labels round remaining time, remember that presentation rounding is not the server's acceptance rule. A card saying “expires today” does not grant access for the rest of the calendar day.

## Reserve a visit atomically

A limited-use invitation is a concurrency problem. Two visitors can both observe one remaining use before either writes. A read-then-increment sequence outside a transaction can oversubscribe the invitation. For a new waiting visitor, use reservation, access audit and waiting-row creation belong in one atomic operation. Otherwise a counter may advance without a usable row, or a row may exist without a recorded reservation.

Design the test with explicit overlap. Hold two attempts after their initial observation, then let them contend at the mutation boundary. Assert the final counter, row count and outcomes. A sequential loop is not a concurrency test merely because it runs quickly. Include a retry that represents the same active visitor and verify that it reuses the intended row rather than consuming another visit. The identity scope of that retry must be defined by the service, not guessed from arbitrary request text.

Capacity is a different limit from total uses. A reusable invitation may permit many visits over its lifetime while allowing only a bounded waiting queue at one time. Test those constraints independently. An admitted or departed row should not necessarily count the same way as an actively waiting row. Read the actual policy and projection rather than treating the total number of historical rows as current queue occupancy.

## Keep the bearer secret out of routine evidence

The complete invitation URL is needed for navigation and an explicit copy action. It is not needed in ordinary logs, screenshots, analytics events or thesis tables. A route can preserve the first-party HTTPS shape while displaying a redacted token label. A server log should record bounded identifiers and safe outcomes rather than the full capability. An audit event's usefulness depends on its correlation and semantics, not on retaining every credential it observed.

Forwarding a capability is part of the threat model. The forwarded visitor may reach the invitation, but should still wait unless their non-anonymous provider-verified account satisfies the allowlist. This is why the policy is not “only the named email can open the link.” Describe the actual admission effect clearly before creation. The clinician should understand both the direct-join group and the fallback waiting behavior.

For the independent exercise, distinguish revocation from deleting the URL from the interface. Revocation changes the persisted authority consulted on future issuance; hiding a string changes presentation. Previously issued credentials may have their own lifetime and revocation behavior, which must be examined separately. A good design note names those boundaries instead of claiming that one button erases every possible existing connection.

## Source trail

Read docs/invitation-access-model.md, token-utils.ts and validate-service.ts.
The security model is capability plus verified identity plus admission; none
of those layers should be described as a substitute for all the others.
