# Agent Instructions: Software Design Principles

Follow these principles derived from "A Philosophy of Software Design" during code generation and review.

## 1. Strategic vs. Tactical Programming

- **Priority:** Prioritize "Strategic Programming" (investing in a clean design) over "Tactical Programming" (getting a feature working quickly).
- **Investment:** Spend ~10-20% of development time on small design improvements to prevent complexity "creep."

## 2. Module Design (Deep vs. Shallow)

- **Deep Modules:** Aim for modules that provide powerful functionality through a simple, tiny interface.
- **Information Hiding:** Hide implementation details (e.g., specific data structures or internal protocols) within the module. Avoid "Information Leakage."
- **General-Purpose:** Make classes "somewhat" general-purpose. They should solve the current problem but be flexible enough for future use without redesign.

## 3. Layering & Abstractions

- **Different Abstractions:** Each layer should provide a different abstraction than the layer above/below it. Avoid "Pass-through methods" (methods that do nothing but call another method with the same signature).
- **Pull Complexity Down:** If a task is complex, handle it inside the module so the user of the module doesn't have to deal with it.

## 4. Error Handling

- **Define Errors Out of Existence:** Design APIs so that "error" cases are handled naturally (e.g., deleting a non-existent file should do nothing rather than throw an exception).
- **Exception Aggregation:** Handle exceptions at a high level rather than sprinkling `try-catch` blocks everywhere.

## 5. Documentation & Naming

- **Comments:** Write comments _before_ writing code. Use comments to describe things that are not obvious from the code (the "Why," not the "How").
- **Naming:** Variable and method names must be precise and consistent. Avoid generic names like `data` or `value` unless the scope is very small.

## 6. Consistency

- Follow established patterns in this repository for UI, naming, and architecture. If a change is made, apply it consistently across the entire scope.
