# LiveKit: Understanding, Investigating and Defending a Teleconsultation System

One comprehensive book commissioned on 24 November 2026. Target: at least
60,000 words of authored chapter prose, excluding code listings, contents and
source index. This directory is a manuscript in progress, not the final book.

Source baseline: c43b76f08886e8fc329d815c3ae3254d185656dd. Repository behavior,
historical evidence, observed deployment state and proposed exercises must be
distinguished explicitly. No new live test or deployment is authorized by the
writing task. The four supplied books inform teaching format only: their
RideMax/HRMS rules, endpoints and outcomes are not LiveKit implementation facts.

## Planned reading path

### Part I - How to know what happened

1. A green build and a broken consultation
2. Map the systems before following the request
3. Evidence, authority and the smallest useful experiment
4. Read the repository as a set of decisions
5. Keep an investigation notebook that another person can use

### Part II - Your Windows and WSL laboratory

6. Know which computer and shell owns your command
7. Files, paths, permissions and executable identity
8. Compose safe commands and inspect their exit status
9. Processes, ports and environment boundaries
10. Git as a model of history, working state and release evidence

### Part III - Browser mechanics and DevTools

11. From URL to HTML, JavaScript and pixels
12. Read Network without mistaking one response for the whole feature
13. Use Elements and accessibility state to inspect the actual interface
14. Follow a callback in Sources without losing its authority boundary
15. Inspect browser storage without collecting credentials

### Part IV - Identity and invitation admission

16. Account identity is not a room identity
17. Follow verified Firebase claims into server permissions
18. An invitation is a bearer capability, not a patient identity
19. Trace direct admission and manual waiting-room admission
20. Consent versions, account refresh and stale asynchronous responses

### Part V - Firestore and durable state

21. Read Firestore safely through bounded masked observations
22. Distinguish collections, references, projections and authoritative records
23. Transactions, use reservation and concurrent invitation redemption
24. Rules and server commands are separate security boundaries
25. Preserve legacy data without silently adopting another person's records

### Part VI - Consultation lifecycle and transport

26. Trace the consultation session from admission to completion
27. Reconnect, duplicate identities and the difference between a tab and a visit
28. Bind late leave and finalization to the correct encounter
29. LiveKit adapters, media grants and least privilege
30. Chat identity, message keys, retries and bounded payloads

### Part VII - Architecture and interaction design

31. Deep modules, information hiding and contract ownership
32. Pure decisions, IO adapters and explicit error semantics
33. Object-centered invitation workbench and modeless feedback
34. Realtime invalidates; authenticated projections supply the rows
35. Resource ownership, shared polling and cleanup under repeated lifecycles

### Part VIII - Security investigations

36. Reproduce profile read and role-escalation failures in an emulator
37. Prove consultation write denial while preserving allowed reads
38. Trace room-name ownership and reserved waiting-room namespaces
39. Review account enumeration, input bounds and error disclosure
40. Secrets, logs, webhook verification and disabled capability boundaries

### Part IX - Performance investigations

41. Define a metric before collecting numbers
42. Separate browser main-thread work, network time and database reads
43. Measure authenticated API performance without contaminating production
44. Read WebRTC statistics and compute interval metrics correctly
45. Design simultaneous-call capacity and reconnection experiments

### Part X - Optional AI and clinical evidence

46. Transcript consent, provenance and speaker attribution
47. Conservative summaries and deterministic insufficient-evidence outcomes
48. Retryable failures, exhausted entitlement and durable work queues
49. Preserve clinician edits and reject stale summary revisions
50. Measure documentation efficiency with an actual reviewer

### Part XI - Verification, release and operations

51. Test design: positive controls, negative controls and mutation checks
52. Read CI, package inventories and runtime compatibility separately
53. Coordinate application, rule and index releases
54. Quota incidents, read budgets and operational recovery
55. Rollback, retention, backups and the limits of prototype readiness

### Part XII - Independent capstones

56. Capstone: an allowlisted patient is still waiting
57. Capstone: history appears under the wrong person
58. Capstone: a long-lived doctor tab spends reads overnight
59. Capstone: the call connects but the thesis performance claim is unsupported
60. Explain, defend and safely improve a new commit without relying on AI

## Completion checks

- [ ] All 60 chapters contain substantive original instruction and worked labs.
- [ ] Body prose count reaches 60,000; machine-readable count retained.
- [ ] Source paths and historical claims checked against the pinned baseline.
- [ ] Proposed exercises are never reported as executed test results.
- [ ] No patient identifiers, tokens, transcripts or raw media dumps included.
- [ ] One final searchable PDF has contents, bookmarks, page numbers and sources.
- [ ] All final pages rendered and inspected before final delivery.

Current checkpoint: Part I, chapters 1-5, authored and rendered. Counted prose:
6,049 words; remaining minimum 53,951. Preview: 17 searchable pages with five
chapter bookmarks. The build script reports actual counts and refuses final
output below the threshold; its final gate was exercised and correctly blocked.

Run `python scripts/thesis/build-study-book.py --render` for a DRAFT preview.
Run with `--final` only when all 60 chapters and the prose threshold are met.
`progress.json` records the counting method and chapter source hashes. Draft
PDF and editable combined Markdown are generated under output/. No application
behavior, patient records or production rules were changed for this book.

Next authoring task: Part II, chapters 6-10, Windows/WSL laboratory. Continue
from this checkpoint rather than regenerate Part I or inflate the word count.
