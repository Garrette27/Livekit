# 32. Pure decisions, IO adapters and explicit error semantics

## The LiveKit boundary to trace

A pure policy receives evidence and returns a decision without performing
network or database work. This makes its assumptions visible and its
counterexamples inexpensive to test. The admission policy, room-name policy
and reserved reviewer assignment decision are examples. Their callers obtain
trusted evidence, normalize it where necessary and perform IO after the
appropriate decision.

Do not move IO into a policy merely because one caller needs convenience.
That makes tests dependent on timing and infrastructure, and it hides the
source of authority. Conversely, do not pretend a pure decision eliminates
the need for transactional rechecks. A correct decision over stale evidence
can still produce an incorrect commit.

## A worked design review

Examine the reviewer assignment check. A valid record needs exact nonempty
identifiers, meaningful metadata and finite time values. Malformed persisted
data should return denial rather than throw during string trimming or date
comparison. The policy deliberately does not invent a timestamp from an
unknown shape. A future adapter must normalize Firestore data explicitly.

Now compare the shared database-availability classifier. It accepts known
SDK status representations and identifies retryable availability conditions.
It must not infer an outage from any message containing the word quota, or
classify permission denial as temporary service failure. The resulting HTTP
response is an adapter responsibility, while the classifier stays small and
dependency-free.

## Exercise with answer

Why not catch every exception and return false from every module? A denied
authorization decision and an unavailable database have different operational
meanings. The security boundary can fail closed in both cases while still
providing a retry explanation for the latter. Defining error semantics means
preserving useful distinctions, not exposing every internal stack trace.

The AGENTS vocabulary describes commands, facts, decisions and runners.
Apply the conceptual distinction without importing unrelated CMS modules into
this repository. A command expresses intent and may be rejected. A committed
fact must be reflected by read models. An IO adapter performs effects. Use
those ideas to clarify a lifecycle, not to rename every function mechanically.

## Foundational systems reading - adapted companion material

These adapted Python readings offer a comparative model of names, mutation and command meaning. The application uses TypeScript; preserve the reasoning about ownership and omission while checking language-specific details instead of copying syntax blindly.

## Supplied systems reference - page 90

Does saving a Python file change a function object already imported in a long-running process? Usually no. The process must perform an appropriate reload or restart, and references to older objects can remain even after some reload operations.

In Python, assignment binds a name to an object. It does not necessarily copy the object's contents. Multiple names can refer to one mutable object. Rebinding one name changes that binding; mutating the shared object changes what all references to that object can observe. This distinction is essential for caches, command objects, fixtures, and default arguments.

Equality asks whether objects compare as equivalent under their type's rules. Identity asks whether two references address the same object. Use identity for sentinel objects and None, and equality for ordinary value comparisons. Do not infer behavior from incidental integer or string interning in one interpreter. Those optimizations are not a general identity contract for your domain values.

## Supplied systems reference - page 91

Defensive copying, freezing a command, and isolating processes solve different sharing problems. A deep copy can duplicate Python objects, but it does not duplicate an external database or establish transaction isolation. Choose the boundary you intend to protect.

## Supplied systems reference - page 92

Decide what omission means for each field. None can mean missing, clear the value, preserve the value, or no result. Those are different operations. An HTTP serializer, a Python dataclass, and a service must agree about the chosen meaning. Explicit action variants or sentinels can avoid conflating states, but adding variants is useful only when they represent a real distinction.

A default input value is part of the API contract. It is not a harmless convenience if callers use it to request a different operation. A typed command still needs runtime validation and interpretation against current state.

## Supplied systems reference - page 93

The code object does not contain the full world the function operates on. Global names are resolved through runtime bindings. A function calling an ORM manager can execute database queries whose plan is chosen by another engine. A function calling requests or another HTTP library can cross network boundaries. Inspecting Python bytecode does not reveal whether an external service completed its business effect.

Parsing, representation and execution are distinct levels of evidence. Development tools expose them through source syntax in an editor, symbols in a language server, code objects in a debugger, and machine instructions or system calls in lower-level inspection. Choose the representation that can answer the current question.

A line of Python is not an atomic database action or a fixed number of CPU instructions. It can trigger multiple calls, allocate objects, release execution control, and wait on external work. Reason about the effect's actual boundary.

A traceback records stack frames involved in an exception's propagation. It connects the failing operation to the calls that reached it. The final line often names the exception type and message, but reading only that line loses the path that explains context. The line nearest the failure can be a library operation receiving invalid input from application code further up the stack.

## Source trail

Inspect lib/invitations/admission-policy.ts,
lib/auth/review-assignment-policy.ts and
lib/services/shared/database-availability.ts. Tests should exercise accepted
and rejected shapes, including nearby values that look plausible but are not
valid evidence.
