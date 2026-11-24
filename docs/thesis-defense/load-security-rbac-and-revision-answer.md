# TeleConsole: manuscript revisions, load and security defense

Evidence date: 25 November 2026, Asia/Singapore. Source baseline: `aa041fe`; the accompanying hardening changes are a local tested checkpoint, not proof that production runs them. This is the full answer to the PDF/app/security follow-up. Read [capacity, quality, costs and scripts](capacity-quality-costs-and-team-scripts.md) for the preceding question, including the cost worksheet and 5/20-minute teaching scripts.

## What we can honestly accomplish in one day

We can make the manuscript agree more closely with the implementation, preserve its pagination and reported expenses, reproduce specific security and workload defects locally, fix those defects, and prepare coherent answers. Editing a PDF cannot make a load test pass. Neither a test count nor a cloud subscription establishes clinical safety. No document can guarantee an examination result.

The defensible position is a bounded, consented thesis prototype, not an unrestricted clinic service. One doctor and one patient is the intended encounter. There is no newly measured maximum number of concurrent video calls. Paid AI throughput, complete audiovisual delay, independent penetration resistance, real-clinic operational fitness and clinician time savings remain unestablished. A repeatable test protocol is included; it is not a result.

The source PDF remains untouched. The revised public copy contains 259 pages, retains its existing numbering, and preserves reported expense amounts and the PHP 7,856.69 total. It has 32 bounded substantive corrections on 25 pages. Privacy masks are separate: demo identifiers/link details in four screenshot pages and CV images on the last eleven pages are omitted from the public repository copy. Keep the original for authorized academic submission; do not silently treat that public privacy copy as an approved replacement for required personal appendices. The [page-change register](page-change-register.md) identifies both types of change.

## The capacity answer is a vector, not one magic number

For a CCTV system, camera count is meaningful only with resolution, frame rate, retention and recording throughput. Here we must state simultaneous endpoints, concurrent encounters, media quality, database operations, AI requests/tokens, retained bytes, correctness and failure behavior. These resources can saturate independently.

| Resource | What the team must state | What is established here |
| --- | --- | --- |
| Media concurrency | Separate rooms/pairs, networks, devices, codecs, received quality | Intended one-to-one workflow; no measured maximum |
| Monthly allowance | Participant-minutes and downstream bytes | Published plan arithmetic, not account entitlement or test results |
| Chat | Transport delivery versus durable persistence, message size/rate, retries | Sender-only persistence; atomic keyed retry deduplication; bounded server persistence budget |
| History | Fetch limits, total documents, outstanding enrichment reads | Existing bounded queries; at most six concurrent chat-enrichment tasks per history request |
| AI | Per-endpoint transcription requests plus final-summary tokens and retries | Local authorization, evidence and refusal tests; no paid throughput benchmark |
| Privacy/security | Account role, ownership, visit binding, consent, provider boundaries | Specific local denial tests; remaining unique-visit/replay limitation prevents blanket security acceptance |

The highest *tested passing* concurrent load would be the largest tested row that satisfies predefined criteria across repeated trials. It is not necessarily the failure point, and it cannot be inferred from the provider's connection ceiling. Do not invent a number to satisfy a panelist; offer the intended envelope and the evidence gap precisely.

## What changed in the application, and why

These changes preserve the existing UI and server/repository boundaries rather than introducing another framework or a parallel database layer.

| Reproduced problem | Implemented correction | Local evidence and limit |
| --- | --- | --- |
| Every receiving browser attempted to persist the same room chat | `ChatPersistenceBridge` persists only messages authored by its local participant | Ten synthetic views of 200 total messages produce 200 POST attempts instead of 2,000; this is not ten real media participants |
| Simultaneous keyed retries could all pass an existence check | Message existence check, creation and session activity update are one Firestore transaction | 100 simultaneous same-key attempts: one new message, 99 duplicates, one session touch in a serialized transaction adapter |
| Shared evidence authorization matched a room but not its recorded participant | Require the signed doctor principal or consistent recorded patient UID/transport subject as well as the room | Different patient/doctor denied; recorded guest and registered principal accepted; conflicting legacy UIDs denied |
| A reusable queue row could overwrite the current encounter's patient during departure | Queue departure/removal no longer closes or reattributes a clinical record selected only by room | Delayed old guest/registered queue rows leave current clinical ownership/status unchanged |
| A retained local chat buffer could be posted again when the encounter prop changed | Bind each observed local message id to its first session; do not clear that binding on prop change | Old and new synthetic messages remain in their respective sessions across two renders |
| The alternate patient page restored a cached encounter id before server confirmation | Clear the cached binding and wait for the authenticated tracking result | Type/lint/build checks; cached room identity is no longer a source of evidence ownership |
| Hundreds of history records could start all chat reads at once | Six worker loops enrich history, preserving existing records and sort | 100 records returned, 100 queries, peak six outstanding queries; total read volume is NOT reduced by this change |
| Chat persistence had no specific authenticated operation budget | 60 attempts per fixed minute per verified room principal plus session | Refusal returns 429 before a chat write; separate principals behind one network have separate budgets |
| Repeated manual summary requests could repeatedly reach generation | Three manual generation attempts per fixed minute per authenticated doctor | Refusal prevents generation in the route test; not a global limit on automatic lifecycle jobs |

Source entry points: `app/room/[room]/components/shared/RoomShell.tsx`, `app/room/[room]/patient/page.tsx`, `lib/services/video-chat/chat-message-store.ts`, `lib/services/shared/session-participant-auth.ts`, `lib/services/invitation-access/invitation-access-core.ts`, `lib/services/history-summary/summary-projection-service.ts`, `lib/rate-limit.ts`, `app/api/session-chat/messages/route.ts`, `app/api/summary/generate/route.ts`. Tests execute the real relevant source through synthetic adapters in `tests/defense-load-regressions.test.mjs`.

### Important remaining security boundary: a person is not a visit

The new principal check stops a *different* recorded participant from using a valid same-room credential. It does not establish that every credential names one immutable encounter. Guest transport subjects can derive from reusable queue keys; the same registered account can also make multiple visits. A signed token can therefore identify the same person while not distinguishing their old and new visits. Treat complete unique-visit/replay isolation as **unresolved**, not as a passed test.

A production correction needs a fresh server-owned visit generation, a credential bound to that generation/session, transactional grant closure/revocation, late-event handling, compatibility rules and adversarial old-credential tests. A new database field alone would not solve all those paths. This larger change is deferred rather than rushed into the defense deadline. Use controlled synthetic accounts and one patient per room for demonstrations; this is an operational precaution, not a security fix. Do not invite real patients into an unrestricted pilot on the strength of this checkpoint.

Removing the unsafe room-only departure writer has a tradeoff: authenticated encounter-scoped tracking and verified transport events must finalize the encounter. A reusable queue row is no longer a fallback clinical authority. If both trustworthy completion paths are lost, an encounter may need reconciliation rather than being falsely closed or assigned to another patient. Reconciliation and unique-visit binding are release gates. Doctor removal still changes queue state and disconnects the selected transport participant; it is not evidence that the queue notification independently generated a summary.

## What if many patients send messages at once?

First distinguish *many separate one-to-one encounters* from *many patients inside one room*. The latter is not a validated clinical group workflow. Even if LiveKit can transport the media, one encounter record and one summary are not proof of separate confidential patient contexts. Do not promise individual summaries for each person in a group room.

LiveKit handles real-time chat delivery. TeleConsole separately persists messages in Firestore for history. A message appearing remotely is not proof it has been archived. A refused or failed archive request does not retract the already delivered LiveKit text. Current UI handling logs persistence failures; a durable browser outbox with visible pending/failed/retry states remains future work. Do not describe chat as guaranteed exactly-once delivery or lossless archival.

With ten users and 200 *total* authored messages, the old receiver-side persistence pattern could make 2,000 requests. The sender-only change removes that multiplication. It does not prove server throughput for 200 simultaneous cloud writes. Our 100-retry adapter checks transaction semantics, not real Firestore contention, retry timing or latency. Unique messages still each cost work, and duplicate requests still consume authorization/rate-counter reads and budget. The new budget is 60 persistence attempts/minute/principal/session, including retries, not 60 globally and not a LiveKit transport cap. A fixed window can allow a burst spanning its boundary.

Message text is bounded at 4,000 JavaScript string units in the API. That is not a 4,000-byte network guarantee; Unicode, serialization and transport framing differ. LiveKit's packet documentation distinguishes payload limits from application text handling. Do not claim that all chat uses exactly one packet. [LiveKit data packets](https://docs.livekit.io/transport/data/packets/).

Rate counters are HMAC-keyed, not raw user/IP records. They add database reads/writes and require retention/TTL configuration; TTL itself may require billing. When Firestore cannot enforce the shared counter, the existing in-process fallback is still only per running instance, not a globally coordinated hard ceiling. Nor do these two new endpoint budgets protect every unauthenticated route or constitute a global AI spend cap. Resource-consumption protection requires payload, timeout, frequency, concurrency and spending controls together. [OWASP API4](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).

Defense answer: "We separate chat delivery from historical persistence, avoid receiver-multiplied writes, atomically deduplicate keyed retries and enforce an authenticated persistence budget. We have local operation-count evidence, not an unlimited messaging or cloud-throughput claim. Group clinical confidentiality and durable archive acknowledgments require further work."

## Will consultation history overload?

History is a read projection, not a request to rerun OpenAI. Doctor history combines summary and session records; the current repositories limit each source to 300 records, and enrichment limits each chat query to 500 messages in ascending order. Those are safety bounds, not complete cursor pagination. More old records can be omitted, and more than 500 messages can omit later messages. Do not say "all lifetime history is always loaded" or "the latest 500".

Six-worker enrichment lowers simultaneous query fan-out within one request. It does not change the total queried documents, eliminate all reads, or impose a six-query global limit across every doctor. Several concurrent dashboard requests multiply work again. In the extreme, independently returned summary/session records can approach 600 records before merging; querying 500 messages for many records can still be expensive. An expandable UI disclosure is not necessarily lazy server fetching.

The strategic next step is cursor-based history pages plus explicit per-encounter chat retrieval when opened, with size/time budgets and tests that the newest/oldest navigation neither skips nor duplicates encounters. Keep clinically significant source evidence separate from short card projections. Do not delete clinical evidence merely to make a dashboard fast. Cache only authorization-safe projections; never share one doctor's clinical response across accounts. [Firestore pricing](https://firebase.google.com/docs/firestore/pricing) explains why document reads, empty queries and some index work still matter.

Defense answer: "The history queries are bounded, and this checkpoint caps chat-enrichment concurrency. We have not demonstrated indefinite history scale. Cursor pagination and on-demand transcript/chat loading are the planned product expansion, with preservation of ownership and ordering."

## When does the app actually call OpenAI?

A room name, invitation creation or revocation is not by itself a reason to bill an LLM. Lifecycle handling can request encounter finalization; the finalizer then decides whether a summary is eligible and what evidence is available. A patient's leave, clinician completion/removal and verified transport events can contribute to finalization, but arrival order and valid encounter association matter. Manual regeneration is a separate owner-authorized request for a completed encounter.

The eligibility and evidence-quality gates can produce deterministic no-show, never-admitted or insufficient-evidence outcomes without invoking the model. A doctor alone therefore must not be defended as "always calls OpenAI". Nor should we promise that every patient departure produces exactly one paid request: jobs may retry, new evidence can change a revision, failures may be unavailable, and clinician-reviewed edits are protected. Read `lib/services/consultation-finalization/`, `lib/services/history-summary/summary-projection-service.ts` and the evidence preparation/generation modules for these different decisions.

The current summary prompt is grounded in session transcript evidence and trusted ready attachment evidence. Attachments are disabled by default. Persisted chat shown in a history disclosure is **not automatically incorporated into the current summary prompt**. An accurate-looking summary does not prove every displayed chat message was sent to OpenAI; consented speech can explain the same context. Do not describe room-wide chat as patient-specific clinical evidence. Adding chat to prompts later requires an explicit provenance/consent and isolation design, not a string concatenation.

The record may be `processing`, `ready`, `reviewed`, `failed` or `unavailable`. `ready` is a draft requiring clinician review, not a certified finding. No transcript does not mean no symptoms or low risk. It means evidence is insufficient. No missing evidence should be filled in merely to make the defense look complete.

## Is the OpenAI integration secure, and can its load be scrutinized?

Yes, the panel can scrutinize it. Outsourcing inference shifts a bottleneck and responsibility boundary; it does not remove them. Separate four questions: who can trigger it, what data leaves the app, how output is constrained, and what happens when quota/model/service availability fails.

The app keeps the key server-side, gates clinical operations by authorization/ownership, requires transcription consent, discards temporary audio after transcription, and stores attributed text/provenance. Evidence-quality gates, structured schema, revision guards and clinician review reduce some error risks. They do not prove zero hallucinations, prompt-injection resistance in all cases, end-to-end encryption, legal compliance or secure handling of every provider account. Audio discarded by our route is not proof of every provider's retention behavior.

OpenAI's current API policy says API data is not used for training by default unless opted in. Its endpoint table lists different retention treatment for chat completions and audio transcription. Chat-completion abuse monitoring can retain content up to 30 days under the standard policy; the audio-transcriptions row currently lists no abuse-monitoring or application-state retention. Exceptions and approved controls matter. We have not verified this account's data settings, contracts, Zero Data Retention eligibility or regional deployment. Do not claim "nothing ever leaves the browser" or assume a healthcare contract. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

The source uses `gpt-4o-mini` for summary and defaults to `gpt-4o-transcribe` for transcription, subject to configuration. Current provider model pages label those legacy models deprecated. That is a migration/availability risk, not a claim that the account has already stopped working. Test a replacement on the same synthetic evidence, schema, quality, refusal and latency suite before changing it. A last-minute untested model switch can invalidate the very evidence being defended. [Summary model](https://developers.openai.com/api/docs/models/gpt-4o-mini), [transcription model](https://developers.openai.com/api/docs/models/gpt-4o-transcribe).

At a nominal ten-second audio chunk, each consenting endpoint makes roughly six transcription requests/minute. With both endpoints consenting, N pairs imply approximately `12N` requests/minute before retries: five pairs about 60; fifty pairs about 600. Actual chunk scheduling, silence, processing and cancellation change this. The route's existing general IP budget can become a separate shared-network constraint. Two bounded provider attempts do not mean unlimited throughput. API request/token limits depend on the actual organization, project and model; account limits were not inspected and no paid load was generated here. [OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits).

The new three/minute manual-generation budget is a modest abuse control, not a complete aggregate AI queue. The existing retry worker handles at most five jobs per invocation and is scheduled daily (`0 2 * * *`). A job becoming eligible after minutes does not mean a worker runs then. If only that daily worker drains Q ready jobs, even ideal drain time is about `ceil(Q/5)` daily batches, before failures/new work. Do not promise immediate summaries or a five-minute recovery SLA.

Before clinic operation: measure p50/p95 completion time and errors; verify model quotas/credits; enforce provider concurrency and spend envelopes; use bounded durable jobs with idempotency, leases, exponential backoff/jitter and visible states; alert on queue age; test provider 429/5xx/timeouts without paid calls first. Inference should not sit on the critical path of joining/continuing a call. Clinical review remains required even if generation is fast.

## Can anyone with a Google account become a doctor?

Google sign-in establishes an authenticated account and provider email evidence; it does not establish medical qualification or an application role. Current repository policy requires trusted provisioning of privileged roles. An ordinary new browser user must not self-assign `doctor`, `admin` or reviewer privileges by selecting a button or changing a request.

The API resolves permissions from verified tokens and the server profile. Firestore profile creation rules require trusted elevated claims for elevated profiles and make protected role/identity fields immutable to clients. Existing server-profile compatibility means a clinic must still review previously provisioned profiles, establish clinician verification/approval, and revoke access on offboarding. Authentication success is not evidence that all old role records were legitimately approved. This checkpoint does not audit every production account or newly certify live rules deployment.

The rule must be tested end to end in the intended deployment: fresh unprovisioned account, patient account, provisioned doctor, unrelated doctor, and revoked clinician. Verify both API denials and direct client-rule denials. Client hiding or a doctor's landing page alone is not sufficient. MFA, administrator onboarding, recovery, rate limits and audit trails are operational requirements, not automatically supplied by the Google button.

Defense answer: "Google authenticates the account; trusted provisioning grants the doctor role; server permissions and record ownership authorize each clinical operation. We do not claim Google verifies a medical license. Our local policy tests cover privileged-role restrictions, but real-clinic onboarding, account review and deployment acceptance remain required."

## Design patterns worth naming, not name-dropping

| Pattern | Concrete responsibility | Tradeoff / boundary |
| --- | --- | --- |
| Capability plus RBAC plus ownership | Invitation permits scoped entry; account role permits actions; doctor/session ownership limits records | None alone proves legal identity, qualification or unique visit |
| Server-owned policy and deep service modules | Routes verify credentials; services/repositories hide lifecycle and persistence details | Keep policy in one authority; avoid reimplementing authorization in components |
| Transactional idempotency | Same keyed chat request produces one new persistent record | Atomic persistence does not make transport or paid inference exactly once |
| Bounded concurrency / bulkhead | Six history enrichment workers; manual/chat operation budgets | Protects one path, not a global throughput/SLA guarantee |
| Materialized/read projection | History merges sessions and summaries for user tasks | Needs explicit query bounds, pagination and privacy-safe caching |
| State machine with durable retry | Draft generation and clinician review have explicit states and revision protection | Scheduled retries need service-rate/queue-age monitoring; events may be lost or duplicated |
| Goal-directed, modeless UX | Device preflight, admission state and AI-unavailable feedback keep calls usable | Persistence failure feedback/outbox still needs improvement |

These follow the applicable AGENTS.md preference for information hiding, simple interfaces, comments explaining non-obvious constraints, established patterns and honest evidence. No unrelated CMS/Supabase/RideMax pattern was imported into this product. A broad rewrite is not justified just because it can be called a pattern.

## Where the original understanding needed correction

1. **Free-plan number versus measured capacity.** An entitlement is a ceiling; it does not test the network, receiver device, database, authorization or clinical workflow. State endpoint count, appointment concurrency and monthly usage separately.
2. **One room versus one patient encounter.** A reusable room name is a location, not a medical-record primary key. The remaining unique-visit binding gap is exactly why this distinction matters.
3. **Authentication versus authorization versus professional verification.** Email ownership does not grant doctor privileges or verify a license. Role provisioning and per-record checks are separate controls.
4. **Displayed text versus model evidence.** History can display chat that the summary prompt never consumes. Agreeing text is not a provenance proof.
5. **Deletion versus cascade/retention.** Firestore does not perform SQL-like referential cascades for you; a summary deletion is not a complete encounter purge. Retention settings do not prove enforcement in every store or backup.
6. **Storage versus request load.** A small database can exceed daily operation quotas through polling, fan-out, retries and reconnects. More disk does not repair a request storm.
7. **Fast inference versus clinical truth.** Schema-valid text can still be wrong. Reviewer time savings and clinical adequacy require their own studies.
8. **Transport encryption versus E2EE/compliance.** TLS/SRTP and access controls are useful, but do not establish E2EE key management or a healthcare compliance program.
9. **Development budget versus recurring service cost.** Keep real travel, internet and documentation expenses; identify them as project costs. They are not a per-clinic subscription quote.
10. **Local passes versus release acceptance.** Mocked calls, emulator rules and dependency audits establish narrower facts than authenticated production acceptance. Pushing source does not demonstrate which rules/model/configuration production runs.

The profound learning error is using one success signal as a substitute for several different guarantees. A connected badge cannot stand for quality, identity, confidentiality, archival durability, evidence integrity and unlimited capacity at once.

## Panel questions and concise, coherent answers

| Question | Answer to rehearse |
| --- | --- |
| How many simultaneous consultations can it handle? | One doctor/one patient is the intended encounter; maximum simultaneous pairs is not measured. Provider ceilings and proposed trials are documented separately. |
| Why not answer 50 pairs from 100 LiveKit connections? | That ignores waiting/idle endpoints, device/network quality and application correctness. It is a theoretical ceiling, not our benchmark. |
| Why not stress production now? | It risks shared quota and clinical data. Use isolated synthetic staging and predefined stop conditions. |
| Can many patients share one room with separate summaries? | Not as a validated clinical workflow. Use separate encounters/rooms; group privacy and evidence attribution need explicit design. |
| Does every participant save every message? | No after this fix: only the sender attempts persistence, and keyed retries are transactionally deduplicated. |
| Can chat vanish from history despite appearing in the call? | Yes, transport and persistence differ. Failed/refused archival needs visible retry/outbox work; no guaranteed durable chat claim. |
| Will history always show everything? | No. Current source queries and per-record messages have bounds; cursor pagination and lazy detail loading are future scale work. |
| Does revoke always bill OpenAI? | No. Lifecycle completion, encounter eligibility and sufficient evidence are separate gates. Deterministic outcomes may skip inference. |
| Does chat automatically enter the AI prompt? | No. Current summary evidence uses session transcripts and trusted enabled evidence, not every displayed chat message. |
| Can OpenAI throttle this app? | Yes. Audio-chunk rates, token quotas, credits, model availability and retry-worker service rate are independent limits. |
| What if AI is unavailable? | Continue the call, show failed/unavailable state and preserve evidence for authorized retry/review; no fabricated clinical content. |
| Is AI output a final diagnosis? | No, it is a documentation draft requiring clinician review and source verification. |
| Can any Gmail account become a doctor? | Authentication is not provisioning. Trusted role approval plus API ownership is required; clinician credential review remains operational work. |
| Is complete encounter isolation passed? | Not yet. Different-principal denial improved, but unique-visit credential/replay binding is still a release blocker. |
| Is it ready for a paying clinic tomorrow? | No blanket approval. A controlled pilot needs remaining security, privacy, load, backup, monitoring and clinical acceptance gates. |

## What to do later, and what cannot be dismissed as later

Useful later enhancements include cursor pagination, on-demand chat, a visible durable persistence outbox, tenant membership, scheduling and attachments after their security gates, clinician-assisted workflow studies and a richer administrative onboarding UI. They should be prioritized by observed use, not implemented as a deadline-week rewrite.

Do not defer truthful statements, authorization, unique-visit confidentiality, consent, protected credentials, provider-contract checks, backup/restore and incident responsibility while claiming real-clinic readiness. Those are deployment gates, not cosmetic enhancements. The thesis can state limitations; it cannot transform an unmet security requirement into a pass merely by calling the system a prototype.

Use [Messenger copy and team assignments](messenger-and-three-writer-brief.md), the [page register](page-change-register.md) and the [dated evidence index](evidence/README.md) for the practical handoff. The prior-prompt brief contains transparent provider estimates, alternative hosting choices and the one-day test/rehearsal timetable. Neither document changes the project's reported expenses into a fabricated cheaper budget.
