# 60. Explain, defend and safely improve a new commit without AI

## A final practical examination

The purpose of this book is not to memorize file names or depend on an assistant to translate every error. It is to build a repeatable way of forming and testing explanations. In this final exercise, another student gives you a new commit that changes consultation behavior. You have the repository, its documentation, your local tools and permission to work in an isolated environment. You do not have permission to modify production data, deploy rules or spend a provider budget. Explain what the change does, identify its risks and propose a verified improvement within that boundary.

Begin by reading the task and the applicable AGENTS instructions. Distinguish general software-design principles from unrelated product examples. This repository's teleconsultation rules take priority over marketing or HR patterns copied into the same instruction file. Do not invent a faculty dashboard because a role name exists. Do not enable attachments or scheduling merely because backend capability names are present. Prepared interfaces are not automatically requested features, and an audit is not authorization to expand the product.

Establish repository state before changing it. Identify the current branch, commit, remote and dirty paths. Read the diff rather than treating every local modification as yours. A changed AGENTS file may contain the user's instructions; an untracked archive may be their evidence. Preserve them. Fetching remote information is different from merging it, and merging is different from deploying it. If the branch cannot fast-forward safely, explain the conflict rather than discarding work to obtain a clean-looking status.

## Read the change through its contracts

Describe the externally visible behavior in one paragraph before discussing implementation. Who is the actor? What object is affected? What command expresses intent? Which server boundary decides whether that actor may perform it? What durable fact changes? What projection informs the browser afterward? If those questions require reading fifteen callbacks, the design may be leaking complexity. Your explanation should reveal that leakage rather than hide it behind a list of functions.

For a hypothetical invitation change, trace the signed capability to the persisted invitation, then the authenticated principal, admission decision, waiting row, room grant and encounter binding. For a history change, trace stable account ownership through the server query and browser projection. For a summary change, trace consented evidence, transcript revision, output validation and clinician review. The correct route depends on the object, but every route needs a coherent authority story.

Name the invariants that must survive the change. A non-allowlisted visitor cannot gain consultation media rights merely by knowing a room label. A stale leave event cannot end a newer encounter. A replaced browser page cannot overwrite the continuing participant's lifecycle. A reviewed note cannot be silently regenerated. An unavailable optional provider cannot prevent an otherwise valid call. These invariants are stronger and more useful than saying that the code “uses best practices.”

## Design twice before editing

Consider at least two plausible repairs. Suppose several components duplicate queue refresh logic. One option is a larger component that owns all consumers directly. Another is a shared projection service that owns the polling and subscription lifetime behind a small interface. Compare information hiding, cleanup responsibility, testability and the number of callers that must understand timing. The correct choice is not whichever option has the fewest lines. It is the one that makes future correct use simpler without inventing abstractions for hypothetical requirements.

Write the interface comment first. State what the operation guarantees, who owns its lifetime, what errors mean and which facts it does not establish. If you cannot describe the interface without exposing every timer or repository query, the module may be too shallow. Pull complexity downward where it can be tested once. Keep pure policy free from IO, but do not split a cohesive transaction into disconnected steps merely to create more files.

Patterns should earn their place. A transaction is valuable when several durable effects must commit together. An adapter is valuable when provider mechanics should not leak into policy. An idempotency key is valuable when retries can repeat an intent. A state machine is valuable when legal transitions and stale commands must be explicit. Naming a pattern does not prove that the implementation satisfies it; locate the actual invariant and failure schedule the pattern controls.

## Build the discriminating test first

Construct a synthetic counterexample that fails for the suspected reason. If the bug concerns stale asynchronous work, force the response order. If it concerns authorization, make the forbidden request directly and keep the allowed owner's case as a positive control. If it concerns a namespace collision, use two principals and names that exercise the collision. If it concerns payload bounds, test just below, at and above the intended boundary without sending oversized data to production.

Check that the test is capable of failing. A security assertion that receives denial because no test principal authenticated has not reached the authorization decision. A lifecycle test that never delivers the late event does not exercise stale-event handling. A performance test with real timers and uncontrolled network delays may be flaky rather than discriminating. Use deterministic dependencies where the claim permits them, then reserve realistic staging measurements for the effects those dependencies cannot model.

Preserve the failed baseline separately from the repaired result. State the exact command, runtime, fixture scope and exit status. A test that did not start because of a missing emulator is blocked, not a failed application assertion and not a pass. A successful local test remains local evidence. Do not let the pressure to finish a thesis turn an environment problem into a fabricated success.

## Implement the narrow correction

Change the owner of the violated contract rather than patching every visible symptom. If several clients mishandle the same service error, a shared API response parser may be the appropriate depth. If the server trusts a caller-supplied UID, hiding the input in the browser is not a correction. If a transaction lacks the exact encounter guard, a UI debounce is not a substitute. Align the repair with the lowest authoritative boundary that can enforce the invariant reliably.

Avoid unrelated cleanup in the same patch. Renaming half the repository while changing ownership logic makes review and rollback harder. Preserve existing conventions unless they are the problem under investigation. Where a new convention is justified, document its purpose and migration boundary. Remove dead affordances when a renderer ignores them, but do not silently delete a supported fallback merely because a newer path exists. Compatibility is a contract too.

Review error behavior as part of the design. Expected conflicts and missing optional evidence should have explicit outcomes. Unexpected failures need safe generic client messages and bounded operational correlation, not raw exception text. Do not return success simply to make a red banner disappear. A clinician needs to distinguish no waiting patients from an unavailable queue, and no transcript evidence from a completed reviewed note.

## Verify and release only within permission

Run the focused regression, then the relevant broader checks required by AGENTS. For changes to invitation, consultation, history, transcription, summary or access behavior, that includes the project's type, lint, security/regression and production-build gates. Record the declared and actual runtime. Dependency inventory, compilation, policy emulation and browser flow verification answer different questions; retain all relevant outcomes without treating one as a universal certificate.

Before a push, inspect the intended diff for secrets, patient data, generated noise and unrelated user work. Documentation should travel with changes to test status. If a local rule test passes but the active production rules are older, retain the production-not-passed status. If remote CI is still running, say so. A commit on main, a successful build and an active production deployment are different states. Release instructions must name the application, rule and index artifacts separately.

Do not perform a production write to demonstrate that you can. A read-only audit can produce a complete report without a deployment. An implementation request may authorize code changes but still require explicit release scope. Rollback should be planned before an irreversible migration, and restoration should be tested rather than assumed from an export file's existence. The safest workflow is not the one with the most cautious language; it is the one whose actual actions match its authority and evidence.

## Defend the result orally

Prepare a five-minute explanation organized around the user's goal. Start with the observed failure and its consequence. Show the boundary that should have prevented it. Describe the smallest reproduction, the alternative explanations it ruled out, the chosen repair and its tradeoff. Finish with the passing evidence and remaining limits. An examiner should be able to ask “How do you know?” after any sentence and receive a concrete artifact rather than a slogan.

Practice answering a deliberately skeptical question: “Your tests pass, so why is production acceptance still incomplete?” The answer is that tests establish the exercised implementation under their declared environment, while production acceptance also depends on deployed artifact identity, configuration and the complete journey. That is not a weakness in the tests. It is a correct separation of evidence. The appropriate next action is a scoped release verification, not an inflated local claim.

Another question asks why the team did not add more sophisticated patterns. Explain that information hiding and contract ownership matter more than pattern count. The prototype should let the intended clinician and patient complete the existing journey reliably. Optional analytics, reviewer roles, attachments and scheduling introduce new authority, privacy and lifecycle questions. Leaving them disabled is a deliberate scope boundary until a request and acceptance criteria justify them.

## A personal working standard

After finishing the exercise, write a short handoff that another student can use tomorrow. Include the last completed step, current revision, changed paths, verification results, unresolved risks and next safe action. Do not make them rediscover completed work. Include enough context to continue, but not raw credentials or sensitive records. A handoff is a compact interface between investigators: it should hide incidental tool history while preserving decisions and evidence.

Keep a learning log of mistaken hypotheses as well as successful ones. Perhaps a presumed database error was a browser parsing failure, a supposed media problem was an unrelated selected peer, or a suspected authorization leak was stale client state. The value is not embarrassment or blame. It is learning which observation would have discriminated the alternatives sooner. Better engineering often means asking a sharper question before running another command.

Finally, return to the human goal. The intended patient should reach the intended consultation safely. The clinician should understand admission, connection and documentation state without decoding token internals. The thesis should explain what was implemented and measured without claiming certification or unsupported performance. Tools, patterns and tests serve those outcomes. When you can preserve that alignment while investigating an unfamiliar commit, you have learned a transferable engineering method rather than a collection of recipes.

## Foundational systems reading - adapted companion material

These adapted engineering readings close the book with transferable methods for tool choice, evidence and knowledge preservation. They support independent reasoning rather than an instruction to trust an assistant, a dashboard or a successful command uncritically.

## Supplied systems reference - page 167

A more convenient representation can be less informative. Do not ask a rounded duration to recover seconds, a normalized identifier to recover original spelling, or a screenshot to prove which backend process handled a request.

When should you preserve an original representation alongside a canonical one? When normalization is useful for operations but the original spelling or precision has audit, reconciliation, or interpretation value.

An AI assistant can search, explain, draft code, and suggest experiments. Its fluent explanation is a claim, not an execution trace. Treat it as a tool whose proposals need to be tied to files, commands, observations, and contracts. Your strongest use of it is to accelerate a question you can state precisely and a result you can assess.

## Supplied systems reference - page 168

Tools can have consequential effects. Distinguish a source-reading command, a fixture mutation, a database restore, a remote push, and a deployment. A successful tool call establishes that action's reported result, not every downstream effect. The same discipline you apply to HTTP and queues applies to automation interfaces.

A tool's value depends on the task, its interfaces, and your ability to maintain it. Vim can make repeated text transformations concise. A browser's DevTools can expose actual events and requests. A graphical diff can improve review. A database client can make query plans readable. The appropriate choice follows the information you need and the recurring work you perform.

Record one friction point for a week before changing the environment. Count how often it occurs, what information is missing, and how much attention it costs. If project navigation repeatedly takes several searches, tags or an LSP may help. If remote diagnostics disappear on disconnection, tmux may help. If a page behaves incorrectly, a faster editor does not substitute for observing its requests.

## Supplied systems reference - page 169

Evaluate replaceability. Stable text, JSON, Git patches, and documented commands are easier to carry across environments than an unexplained plugin state. A proprietary interface can still be worthwhile, but preserve the meaningful artifact or procedure where possible. Your note should survive a tool replacement even when exact shortcuts change.

There is no general need to reject graphical interfaces to learn computing deeply. A GUI can reveal structured state that a terminal command obscures. A CLI can expose a composable interface that a GUI hides. Learning improves when you can identify the underlying representation and choose the interface that answers your question.

What justifies replacing a tool that already works? A concrete benefit in recurring work or a needed capability, weighed against migration, learning, maintenance, and recovery cost, with a way to verify the improvement.

## Supplied systems reference - page 170

Return to the question you asked: which omissions would block advanced learning? The most consequential omissions are usually boundaries you collapsed. A name became an identity, a displayed value became authoritative state, one process became the whole system, an accepted request became completed work, or one example became proof of every case. The remedy is a precise distinction and an experiment that makes it visible.

A lifelong note is not a permanently correct command. Preserve the principle, scope, evidence, and version so the command can be re-evaluated. Durability comes from explainability and renewal.

## Source trail

Use AGENTS.md and docs/thesis-defense-guide.md as the local delivery contract.
Cross-check docs/production-readiness.md, docs/access-control.md,
docs/consultation-modular-architecture.md and the dated verification checklist.
This final examination is a proposed independent exercise. It is not a claim
that every release, restoration or performance study described here has run.
