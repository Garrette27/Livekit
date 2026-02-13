# Agent Instructions: Software Design Principles

Follow these principles derived from "A Philosophy of Software Design" (2nd Edition) during code generation and review.

## 1. Complexity is Incremental

- **Problem:** Complexity accumulates from many small decisions, not a single catastrophic mistake.
- **Solution:** Make continuous small investments to prevent complexity from building up. Complexity is what makes software hard to understand and modify.

## 2. Working Code Isn't Enough (Strategic vs. Tactical Programming)

- **Tactical Programming (avoid):** Focus only on getting features working quickly. Creates complexity debt.
- **Strategic Programming (adopt):** Invest 10-20% of total development time in good design. Your primary goal is a great design that happens to work, not just working code.
- **Mindset:** Take pride in continuously improving the system's design.

## 3. Modules Should Be Deep

- **Deep Modules:** Provide powerful functionality behind a simple interface. The best modules have a high benefit-to-cost ratio (lots of functionality, minimal interface complexity).
- **Shallow Modules (avoid):** Modules where the interface is nearly as complex as the implementation provide little value.
- **Example:** Unix I/O has just 5 simple calls (open, read, write, lseek, close) but enables complex file operations.

## 4. Information Hiding

- **Core Principle:** Each module should encapsulate knowledge that represents design decisions. Hide implementation details.
- **Information Leakage (avoid):** When a design decision is reflected in multiple modules. This creates dependencies and makes changes difficult.
- **Temporal Decomposition (avoid):** Don't structure modules around the order of execution (e.g., separate read/parse/analyze modules). Instead, hide temporal dependencies inside modules.

## 5. General-Purpose Modules Are Deeper

- **Approach:** Make interfaces somewhat general-purpose rather than specialized for particular use cases.
- **Benefits:** Simpler interfaces, reduced cognitive load, easier to reuse.
- **Balance:** Don't over-engineer for hypothetical future needs, but avoid designing solely for today's narrow requirements.

## 6. Different Layer, Different Abstraction

- **Red Flag:** Pass-through methods/variables that simply pass information to another layer without adding value.
- **Solution:** Each layer should provide a meaningful abstraction different from adjacent layers.
- **Dispatcher Methods Exception:** A dispatcher that uses its own logic to select among multiple implementations is acceptable.

## 7. Pull Complexity Downwards

- **Principle:** It's more important for a module to have a simple interface than a simple implementation.
- **Practice:** Handle complexity inside modules rather than exposing it to users. Most modules have more users than developers.
- **Configuration Parameters (use sparingly):** Each configuration parameter adds complexity to the interface. Only expose what users truly need to control.

## 8. Define Errors Out of Existence

- **Best Approach:** Design APIs so normal operation handles "exceptional" cases (e.g., deleting a nonexistent file succeeds silently).
- **Mask Exceptions:** Handle exceptions internally when possible rather than propagating them.
- **Exception Aggregation:** Catch exceptions at higher levels where more context is available.
- **Crash vs. Continue:** Crashing is sometimes better than exposing complex error handling to users.

## 9. Design It Twice

- **Practice:** Consider multiple design alternatives before committing to one.
- **Benefits:** Usually leads to a better outcome than the first idea. Even if you pick the first design, you'll have more confidence it's the right choice.

## 10. Comments Should Describe What's Not Obvious

- **Write Comments First:** Write interface comments before implementation. This forces you to think about abstractions.
- **Comments Augment Code:** Comments should describe things you can't easily see from code:
  - High-level behavior and abstraction
  - Intent and reasoning ("why," not "what")
  - Non-obvious dependencies or consequences
- **Avoid Low-Level Comments:** Don't simply repeat what the code says.
- **Precision:** Comments should be precise and complete for interface documentation.

## 11. Choose Names Carefully

- **Precision:** Names should be precise enough that readers can infer behavior/type without reading documentation.
- **Consistency:** Use names consistently. Same thing = same name, different things = different names.
- **Avoid Vague Names:** Names like `data`, `info`, `manager`, `handler` are usually too generic.
- **Red Flag:** If it's hard to name something, it's probably poorly designed.

## 12. Write Comments First (Use Comments as Part of Design)

- **Interface Comments First:** Write the interface comment for each method before implementing it.
- **Forces Better Design:** If the comment is difficult to write, the interface is probably too complex.
- **Delayed Comments Don't Happen:** Comments written later are often skipped or poorly done.

## 13. Consistency

- **Importance:** Consistency reduces cognitive load and makes code more obvious.
- **Apply Broadly:** Naming, coding style, interfaces, design patterns, invariants.
- **Document Conventions:** Make important conventions explicit through documentation or automated enforcement.

## 14. Code Should Be Obvious

- **Obvious Code:** Readers can quickly understand the code, and it's unlikely they'll misunderstand it.
- **Red Flags for Non-Obvious Code:**
  - Event-driven programming (obscures flow of control)
  - Generic containers (lose type information)
  - Different types for declaration and allocation
  - Code that violates reader expectations
- **Make It Obvious:** Use good naming, consistency, judicious use of white space, comments for non-obvious behavior.

## 15. Software Trends (Use Judiciously)

- **Object-Oriented Programming:** Classes are valuable, but don't overuse private methods and inheritance. Too many shallow classes create complexity.
- **Agile Development:** Compatible with strategic programming—incremental development is fine, but always invest in design.
- **Unit Tests:** Valuable, but shouldn't replace design investment. Tests don't improve design; they just verify implementation.
- **Test-Driven Development:** Can work, but interface comments are better than tests for driving design.
- **Design Patterns:** Useful, but don't apply them reflexively. Evaluate whether a pattern actually simplifies your specific problem.
- **Getters/Setters (avoid):** Usually shallow methods that expose internal state. Violates information hiding.

## Red Flags Summary (Signs of Design Problems)

1. Shallow Module
2. Information Leakage
3. Temporal Decomposition
4. Overexposure (API too complex)
5. Pass-Through Method/Variable
6. Repetition (code duplication)
7. Special-General Mixture (mixing general and special-purpose code)
8. Conjoined Methods (can't understand one without the other)
9. Comment Repeats Code
10. Implementation Documentation Contaminates Interface
11. Vague Name
12. Hard to Pick Name
13. Hard to Describe (comment is hard to write)
14. Nonobvious Code

## Application to This Repository

- **Before Writing Code:** Write interface comments describing what each module/class/function will do.
- **Module Design:** Favor fewer, deeper modules over many shallow ones.
- **Error Handling:** Handle errors internally when possible; avoid exposing error complexity to API users.
- **Consistency:** Follow existing patterns strictly. Document any new patterns introduced.
- **Continuous Improvement:** Regularly refactor to simplify interfaces and reduce complexity.
