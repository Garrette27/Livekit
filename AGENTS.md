# Agent Instructions: Software Design Principles

Follow these principles derived from "A Philosophy of Software Design" (2nd Edition) during code generation and review.

## 1. Complexity is Incremental
- **Problem**: Complexity accumulates from many small decisions, not a single catastrophic mistake.
- **Solution**: Make continuous small investments to prevent complexity from building up. Complexity is what makes software hard to understand and modify.

## 2. Working Code Isn't Enough (Strategic vs. Tactical Programming)
- **Tactical Programming (avoid)**: Focus only on getting features working quickly. Creates complexity debt.
- **Strategic Programming (adopt)**: Invest 10–20% of total development time in good design. Your primary goal is a great design that happens to work, not just working code.
- **Mindset**: Take pride in continuously improving the system's design.

## 3. Modules Should Be Deep
- **Deep Modules**: Provide powerful functionality behind a simple interface. The best modules have a high benefit-to-cost ratio (lots of functionality, minimal interface complexity).
- **Shallow Modules (avoid)**: Modules where the interface is nearly as complex as the implementation provide little value.
- **Example**: Unix I/O has just 5 simple calls (`open`, `read`, `write`, `lseek`, `close`) but enables complex file operations.

## 4. Information Hiding
- **Core Principle**: Each module should encapsulate knowledge that represents design decisions. Hide implementation details.
- **Information Leakage (avoid)**: When a design decision is reflected in multiple modules. This creates dependencies and makes changes difficult.
- **Temporal Decomposition (avoid)**: Don't structure modules around the order of execution (e.g., separate read/parse/analyze modules). Instead, hide temporal dependencies inside modules.

## 5. General-Purpose Modules Are Deeper
- **Approach**: Make interfaces somewhat general-purpose rather than specialized for particular use cases.
- **Benefits**: Simpler interfaces, reduced cognitive load, easier to reuse.
- **Balance**: Don't over-engineer for hypothetical future needs, but avoid designing solely for today's narrow requirements.

## 6. Different Layer, Different Abstraction
- **Red Flag**: Pass-through methods/variables that simply pass information to another layer without adding value.
- **Solution**: Each layer should provide a meaningful abstraction different from adjacent layers.
- **Dispatcher Methods Exception**: A dispatcher that uses its own logic to select among multiple implementations is acceptable.

## 7. Pull Complexity Downwards
- **Principle**: It's more important for a module to have a simple interface than a simple implementation.
- **Practice**: Handle complexity inside modules rather than exposing it to users. Most modules have more users than developers.
- **Configuration Parameters (use sparingly)**: Each configuration parameter adds complexity to the interface. Only expose what users truly need to control.

## 8. Define Errors Out of Existence
- **Best Approach**: Design APIs so normal operation handles "exceptional" cases (e.g., deleting a nonexistent file succeeds silently).
- **Mask Exceptions**: Handle exceptions internally when possible rather than propagating them.
- **Exception Aggregation**: Catch exceptions at higher levels where more context is available.
- **Crash vs. Continue**: Crashing is sometimes better than exposing complex error handling to users.

## 9. Design It Twice
- **Practice**: Consider multiple design alternatives before committing to one.
- **Benefits**: Usually leads to a better outcome than the first idea. Even if you pick the first design, you'll have more confidence it's the right choice.

## 10. Comments Should Describe What's Not Obvious
- **Write Comments First**: Write interface comments before implementation. This forces you to think about abstractions.
- **Comments Augment Code**: Comments should describe things you can't easily see from code:
  - High-level behavior and abstraction
  - Intent and reasoning ("why," not "what")
  - Non-obvious dependencies or consequences
- **Avoid Low-Level Comments**: Don't simply repeat what the code says.
- **Precision**: Comments should be precise and complete for interface documentation.

## 11. Choose Names Carefully
- **Precision**: Names should be precise enough that readers can infer behavior/type without reading documentation.
- **Consistency**: Use names consistently. Same thing = same name, different things = different names.
- **Avoid Vague Names**: Names like `data`, `info`, `manager`, `handler` are usually too generic.
- **Red Flag**: If it's hard to name something, it's probably poorly designed.

## 12. Write Comments First (Use Comments as Part of Design)
- **Interface Comments First**: Write the interface comment for each method before implementing it.
- **Forces Better Design**: If the comment is difficult to write, the interface is probably too complex.
- **Delayed Comments Don't Happen**: Comments written later are often skipped or poorly done.

## 13. Consistency
- **Importance**: Consistency reduces cognitive load and makes code more obvious.
- **Apply Broadly**: Naming, coding style, interfaces, design patterns, invariants.
- **Document Conventions**: Make important conventions explicit through documentation or automated enforcement.

## 14. Code Should Be Obvious
- **Obvious Code**: Readers can quickly understand the code, and it's unlikely they'll misunderstand it.
- **Red Flags for Non-Obvious Code**:
  - Event-driven programming (obscures flow of control)
  - Generic containers (lose type information)
  - Different types for declaration and allocation
  - Code that violates reader expectations
- **Make It Obvious**: Use good naming, consistency, judicious use of white space, comments for non-obvious behavior.

## 15. Software Trends (Use Judiciously)
- **Object-Oriented Programming**: Classes are valuable, but don't overuse private methods and inheritance. Too many shallow classes create complexity.
- **Agile Development**: Compatible with strategic programming—incremental development is fine, but always invest in design.
- **Unit Tests**: Valuable, but shouldn't replace design investment. Tests don't improve design; they just verify implementation.
- **Test-Driven Development**: Can work, but interface comments are better than tests for driving design.
- **Design Patterns**: Useful, but don't apply them reflexively. Evaluate whether a pattern actually simplifies your specific problem.
- **Getters/Setters (avoid)**: Usually shallow methods that expose internal state. Violates information hiding.

## Red Flags Summary (Signs of Design Problems)
- Shallow Module
- Information Leakage
- Temporal Decomposition
- Overexposure (API too complex)
- Pass-Through Method/Variable
- Repetition (code duplication)
- Special-General Mixture (mixing general and special-purpose code)
- Conjoined Methods (can't understand one without the other)
- Comment Repeats Code
- Implementation Documentation Contaminates Interface
- Vague Name
- Hard to Pick Name
- Hard to Describe (comment is hard to write)
- Nonobvious Code

## Application to This Repository
- **Before Writing Code**: Write interface comments describing what each module/class/function will do.
- **Module Design**: Favor fewer, deeper modules over many shallow ones.
- **Error Handling**: Handle errors internally when possible; avoid exposing error complexity to API users.
- **Consistency**: Follow existing patterns strictly. Document any new patterns introduced.
- **Continuous Improvement**: Regularly refactor to simplify interfaces and reduce complexity.

## Rules of Thumb for Database Design
- Every table should always have a unique identifier (primary key).
- 90% of the time, that unique identifier will be a single column named `id`.
- Avoid duplicate data.
- Avoid storing data that is completely dependent on other data. Instead, compute it on the fly when you need it.
- Keep your schema as simple as you can. Optimize for a normalized database first. Only denormalize for speed's sake when you start to run into performance problems.

## Livekit thesis product rules

These rules apply to this repository's secure teleconsultation product and take
priority over unrelated product examples elsewhere in this file. Read
`docs/thesis-defense-guide.md`, `docs/invitation-flow-design.md`,
`docs/invitation-access-model.md`, `docs/access-control.md`, and
`docs/production-readiness.md` before changing invitation, consultation,
transcription, summary, or access-control behavior.

### Delivery priority

- First make the existing doctor/patient journey work reliably; then harden it;
  then improve its interaction design. Do not trade a working call for an
  optional AI, attachment, scheduling, analytics, or reviewer feature.
- This is a thesis prototype, not a certified medical device or a HIPAA
  compliance claim. Preserve honest boundaries in UI, documentation, and logs.
- RBAC and `faculty_reviewer` remain backend-only preparation. Do not add a
  professor/faculty route, dashboard, navigation item, or broad clinical-data
  permission until an explicit feature request defines assignment scope and
  review UX.

### Invitation security contract

- Treat an invitation link as a scoped bearer capability, never as proof of the
  patient's identity. Possession proves only access to the signed invitation.
- Every token-issuing request must validate server-side signature, persisted
  invitation id, room binding, status/revocation, expiry, ownership, use policy,
  and applicable capacity. UI state is never the security boundary.
- Only a non-anonymous Firebase identity with a provider-verified email on the
  invitation allowlist may skip the waiting room. Typed/self-declared email,
  token email, device/browser fingerprint, IP address, or geolocation must not
  grant direct admission. Everyone else receives only a waiting-room-scoped
  token until the owning doctor admits them.
- Reserve invitation uses transactionally. For a new waiting visitor, the
  counter update, access audit, and waiting-row creation belong in one atomic
  operation. Reconnects reuse an active row instead of consuming a new visit.
- Store access attempts/violations as bounded subcollection events, not growing
  arrays. Never log or persist raw invitation tokens, raw IP addresses, raw user
  agents, device fingerprints, email allowlists, transcripts, or clinical text.
  Correlation signals use keyed HMAC values and are not authentication factors.
- Keep invitation URLs as first-party HTTPS routes built by the centralized
  link helper. Do not introduce Firebase Dynamic Links; that service shut down
  on 2025-08-25. Do not expose the complete token except where the patient must
  navigate or the doctor explicitly copies it.

### Goal-Directed UI contract

- Follow the About Face-inspired **Goal-Directed, object-centered invitation
  workbench** documented in `docs/invitation-flow-design.md`: the doctor's goal
  is getting the intended patient into the intended consultation safely, not
  managing token internals.
- Make each invitation's lifecycle and currently available actions visible.
  Preview the admission effect before creation. Use progressive disclosure for
  explanation/evidence and modeless inline/toast feedback for copy, loading,
  retry, revoke, and error states.
- A control's label must state its current value or its action unambiguously.
  Sort uses an explicit selected value (`Newest first`/`Oldest first`), never a
  toggle whose visible label can be read as the opposite action.
- Avoid nested page scroll traps. Large archives use an explicit bounded page
  or `Show more`. Do not make a card with nested buttons itself clickable; give
  it a named keyboard-accessible action such as `View queue`.
- Security copy must describe the real policy. Never claim automatic device,
  browser, or location verification. Never display the legacy `999999` reuse
  sentinel; say `reusable until expiry`.
- Preserve responsive LiveKit behavior, device preflight, connection status,
  accessible status messages, and the user's ability to complete a call when
  optional AI/transcription is unavailable.

### AI summary and consent contract

- Prefer consented, session-scoped, speaker-attributed transcript segments.
  Audio is temporary and discarded after transcription; persisted text carries
  provenance. Each participant explicitly opts in, and the call works with
  transcription off. Browser speech recognition is a labeled fallback started
  by the clinician only after confirming verbal patient consent.
- Summaries must be grounded only in transcript or trusted ready attachment
  evidence. Preserve evidence-quality gates, strict structured output,
  deterministic no-show/not-admitted/insufficient-evidence outcomes,
  transcript-revision guards, and clinician edits.
- Lifecycle vocabulary is `processing -> ready -> reviewed`, with `failed` and
  `unavailable` branches. `ready` AI output requires clinician review;
  `reviewed` content must never be overwritten by regeneration. Failed work
  enters the bounded durable retry queue; AI failure must not break the call.
- Never infer low risk, symptoms, diagnoses, recommendations, or follow-up from
  silence, short duration, poor recognition, connection events, or missing
  evidence. Empty arrays and `Unknown` risk are valid outcomes.

### Current-data reconnaissance

- Before data-dependent schema, migration, retention, compatibility, or UI-count
  work, use authorized current production data to run a read-only aggregate and
  schema-shape audit. Inspect counts, lifecycle distributions, missing-field
  rates, and bounded redacted samples needed for the decision.
- Never perform a production write or migration merely to “inspect” data. Never
  print, copy, or place patient names, emails, transcripts, messages, tokens, or
  other clinical content in prompts, logs, screenshots, fixtures, or reports.
  Report only aggregates/redacted shapes. If credentials are unavailable, say
  so and continue from repository contracts rather than inventing data.
- Maintain backward-compatible projections for observed legacy shapes. Prefer
  additive fields and lazy normalization over a destructive deadline-week
  migration. Any approved migration needs a backup, dry-run counts, idempotency,
  rollback, and post-run verification.

### Prepared but disabled capabilities

- File attachments and consultation scheduling have server capability names but
  remain disabled by default and have no UI. Keep
  `ENABLE_FILE_ATTACHMENTS` and `ENABLE_CONSULTATION_SCHEDULING` server-only and
  unset in ordinary deployments.
- Before attachments ship: require session ownership, allowlisted type/size,
  private object storage, malware/content scanning, download authorization,
  audit events, deletion/retention, and cross-session denial tests. Summary code
  consumes only trusted `ready` extraction results.
- Before scheduling ships: add a separate timezone-safe appointment lifecycle,
  participant ownership, availability/conflict policy, idempotent reminders,
  reschedule/cancel commands, and invitation issuance. Do not mix scheduling
  fields directly into invitation documents. FHIR-inspired vocabulary is not a
  claim of FHIR compliance.

### Completion gate

- For invitation, LiveKit, transcription, history, summary, or access changes,
  run typecheck, lint, security/regression tests, and production build. Add or
  update a focused regression for every fixed bug or preserved invariant.
- Before pushing, review the staged diff for secrets, patient data, generated
  artifacts, unrelated local changes, and truthful security/compliance wording.
