# TeleConsole: capacity, video quality and clinic economics

Defense briefing | 25 November 2026 | repository aa041fe

This is a researched planning brief, not a new experimental result, a clinic quotation, legal advice, or a guarantee of passing a defense. Read the core briefing in about 25-30 minutes; the speaking material at the end supports a five-minute explanation or a timed twenty-minute team session. The original survey findings are unchanged. Provider rates are public list prices checked today, in USD before taxes and currency conversion. Current account-specific subscriptions, remaining allowances, invoices, active deployment SHA and active rules were not independently verified in this task.

## The answer to the CCTV question

For TeleConsole, the equivalent question is: **How many simultaneous doctor-patient consultations can the complete deployed system sustain, at a stated delivered quality, on stated devices and networks, without access failures or mixed encounter records?**

There is no measured maximum in the existing research evidence. The intended workflow is one doctor and one patient per encounter. Ordinary demonstrations show that journey, but do not establish a maximum concurrent-call capacity. The appropriate defense answer is not a guessed number. It is a clear separation of intended use, provider ceiling, observed demonstration, and the test still needed.

Use this answer: "Our prototype targets one doctor and one patient per encounter. We have not established a maximum number of simultaneous consultations. LiveKit's published allowance is a service ceiling, not an application benchmark. We would qualify a deployment using repeated paired-call tests and report only the highest load that meets our predefined quality and correctness criteria."

The thesis already states that its formal findings concern respondent-perceived quality. Do not convert favorable questionnaire ratings into a throughput, latency, clinical-accuracy, or security-certification result. ISO/IEC 25010 provides a quality vocabulary; it does not transform a survey score into a laboratory measurement.

## One mental model: four responsibilities and four meters

The browsers display the interface and capture/play media. Vercel serves the Next.js interface and authorized API routes. Firebase supplies identity, structured records and background operations. LiveKit routes media. Optional OpenAI requests process eligible evidence. The media plane is not the same as the application control plane or the clinical record store.

| Responsibility | What it does here | What increases its demand |
| --- | --- | --- |
| LiveKit media | Audio, video, screen-sharing transport | Connected time, receivers, bitrate, concurrent endpoints |
| Vercel application | Pages, token issuance, history and other API work | Requests, active computation, memory duration, application traffic |
| Firebase persistence | Accounts, invitations, sessions, text, audits | Document operations, listeners, stored data, indexes and background jobs |
| Optional AI | Transcription and evidence-grounded draft summaries | Consented audio processed, input/output tokens, attempts and retries |

Think of four meters: **people connected now; participant-minutes this month; media bytes delivered; record operations and retained bytes.** A clinic can exhaust one while having plenty of another. An empty waiting queue does not imply unused video quota, and a small database does not imply low read traffic.

A waiting-room limit of ten is an admission-policy setting, not a ten-person video benchmark. The source's `maxParticipants: 40` is used to choose grid columns in `participant-grid-policy.ts`; it is not an enforced service quota or a measured forty-person capacity. Similarly, a history query limit controls one retrieval window, not how many consultations can ever be stored.

## What the current provider allowances mean

| Service/plan | Public allowance or starting price | Interpretation |
| --- | --- | --- |
| LiveKit Build | $0; 100 concurrent connections; 5,000 WebRTC participant-minutes/month; 50 GB downstream/month | Public transport ceiling and usage caps, not TeleConsole capacity |
| LiveKit Ship | Starts $50/month; 1,000 concurrent connections; 150,000 participant-minutes and 250 GB downstream included | Additional transport minutes $0.0005/min; downstream $0.12/GB |
| Firestore Standard default free database | 1 GiB stored; 50,000 reads, 20,000 writes and 20,000 deletes/day; 10 GiB outbound/month | Daily quotas are not a monthly bank; existing project activity shares them |
| Vercel Hobby | $0, personal/non-commercial restriction | Not the commercial clinic operating plan |
| Vercel Pro | $20/month platform fee, one deploying seat, $20 infrastructure usage credit | Extra deploying seats $20/month each; usage/add-ons can add charges |

Sources: [LiveKit pricing](https://livekit.com/pricing), [LiveKit quota policy](https://docs.livekit.io/deploy/admin/quotas-and-limits/), [Firestore quotas](https://firebase.google.com/docs/firestore/quotas), [Vercel terms](https://vercel.com/legal/terms), [Vercel Pro](https://vercel.com/docs/plans/pro-plan). The current dashboard and signed agreement take precedence over this dated snapshot.

On Build, monthly allowances are hard caps; creating more free projects is not an allowance-multiplication strategy. Count every connected endpoint, including a doctor left online between visits and any waiting-room endpoint that actually connects to LiveKit. Merely issuing a token does not equal a media connection. The arithmetic ceiling of 100 divided by two is 50 pairs, **not evidence that fifty encounters are safe**, nor a recommendation to run that load. Leave headroom for other connections and account limits.

Ship is a practical growth scenario, not a claim that LiveKit requires every small commercial project to buy it. A low-volume project may fit Build's public allowances, subject to its terms and account status. However, relying on hard free caps is an availability risk for a clinic. A real service needs a planned upgrade path and an operator who monitors remaining resources.

## Participant-minutes: the calculation everyone must know

For equal-duration two-person calls:

`participant-minutes = visits × minutes per visit × 2`

One twenty-minute consultation consumes approximately forty participant-minutes when both people are connected for the full twenty minutes. Thus 5,000 minutes covers at most 125 such visits **from the time allowance alone**. If the doctor remains connected while idle, the allowance covers fewer consultations. Three people connected for twenty minutes consume sixty participant-minutes; call duration has not tripled, but the time-based resource has.

Do not confuse simultaneous calls with monthly visits. A single clinician could conduct many sequential appointments while never exceeding two media endpoints. Several clinicians could exceed a concurrency limit during one busy hour despite low monthly usage. Registered patients do not consume LiveKit participant-minutes while signed out. A Vercel deploying seat is a developer/administrator seat, not a paid seat for every doctor or patient using the application.

For rooms containing more than two people, subscription topology matters. If everyone receives everyone else's camera, delivered streams can grow roughly as `n × (n - 1)`. Selective forwarding avoids sending every publisher directly to every receiver from the publisher's own uplink, but it does not make downstream bytes or receiver decoding free. TeleConsole's current encounter-binding and summary workflow must not be advertised as a validated multi-patient group consultation service.

## Bandwidth can run out before minutes

For planning only, let `b` be average downstream Mbps delivered to each of two receivers, including the media budget you choose to model. Using decimal GB:

`monthly downstream GB ≈ visits × duration_minutes × 2 × b × 60 / 8,000`

This assumes two active receivers for the whole visit, no extra screen-share stream, and no idle overhead. Use actual metering for invoicing. The current SDK includes a 720p preset with a 1.7 Mbps encoding target, but TeleConsole does not force that preset and actual bitrate differs with codec, scene, network, audio and retransmissions. Therefore 1.7 Mbps below is a transparent scenario, not an observation or a guaranteed 720p cost.

| Twenty-minute visit scenario | Data per two-person visit | Visits from 50 GB alone |
| --- | --- | --- |
| 1.0 Mbps per receiver | 0.30 GB | About 166 |
| 1.7 Mbps per receiver | 0.51 GB | About 98 |
| 2.0 Mbps per receiver | 0.60 GB | About 83 |

At 1.7 Mbps, transfer would bind before the 125-visit time-only calculation. These are theoretical budgets with no safety margin, other traffic or per-session rounding. They must never be called observed free-plan capacity. Higher video quality can increase the bill even if appointment counts are unchanged. Turning cameras off changes bytes, but connected participant time can still be metered. Screen sharing may add another track rather than replacing a camera.

## A transparent small-clinic monthly estimate

The reproducible model is `scripts/thesis/defense-cost-model.py`; its output is `docs/testing/evidence/2026-11-25-defense-planning/cost-model.json`. These scenarios assume twenty-minute two-person visits and average 1.7 Mbps delivered to each receiver. For Firestore, they deliberately assume 2,000 billable document reads and 1,000 writes per visit, evenly spread over the operating days shown. Those operation budgets are **not measured app costs**. They include a planning allowance for transcript and workflow work but do not replace instrumentation.

| Scenario | Visits / operating days | Participant-min | Downstream GB | LiveKit Ship | Firestore document operations | Vercel base | Modeled subtotal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Low-volume planning | 80 / 20 | 3,200 | 40.8 | $50.00 | $0.00 | $20.00 | $70.00 |
| Small clinic | 440 / 22 | 17,600 | 224.4 | $50.00 | $0.00 | $20.00 | $70.00 |
| Busier clinic | 1,000 / 20 | 40,000 | 510.0 | $81.20 | $1.03 | $20.00 | $102.23 |

The low-volume case could fit Build's modeled transport allowance instead, yielding a $20 rather than $70 three-service subtotal, if all other conditions permit. This is not the recommended availability guarantee for a real clinic. In the small-clinic case, increasing the downstream assumption to 2 Mbps gives 264 GB and a Ship estimate of $51.68; the three-service subtotal becomes $71.68. That sensitivity is more useful than presenting one falsely exact price.

**These subtotals are not the complete cost of running a clinic service.** They exclude AI/transcription, Vercel usage beyond credit, extra developer seats, retained-data overage, database egress, backups/PITR, TTL, Cloud Functions, Cloud Run, Scheduler, build/container storage, logs, authentication charges where applicable, domain, internet, devices, support, privacy work, taxes, FX, previous balances and contingency. A planning reserve is a reserve, not a measured provider charge. Obtain a current quote/account preview and observe a pilot month before selling a fixed-price package.

The Singapore Firestore Standard on-demand list prices retrieved from the public pricing page's regional data were $0.0369 per 100,000 reads, $0.1107 per 100,000 writes, $0.0123 per 100,000 deletes and $0.1846/GiB-month stored. This is not the Iowa default displayed by some text-only views. Recheck region and edition before procurement. [Regional pricing](https://cloud.google.com/firestore/pricing?hl=en).

For the 1,000-visit case over twenty days: 100,000 reads/day leaves 50,000/day above free; 50,000 writes/day leaves 30,000/day above free. Reads cost `20 × 50,000 / 100,000 × 0.0369 = $0.369`. Writes cost `20 × 30,000 / 100,000 × 0.1107 = $0.6642`. Total document operations are $1.0332. Other project usage can consume the free allowance first. At twenty visits/day, the example already reaches the entire 20,000-write daily allowance, so it has no write headroom.

Use USD as the source currency. A PHP estimate should state `USD total × chosen PHP/USD rate`, the rate date, taxes and card/conversion fees. Do not hard-code an exchange rate into the thesis and imply a future clinic invoice is guaranteed.

## Why a small Firestore database can still hit a quota

A query returning twenty documents generally entails document reads, not one inexpensive "API request." Repeatedly retrieving the same documents can be billed again. Listeners also have billed initial/reconnect and changed-document behavior. Additional index-entry reads, security-rule dependent reads and retries may apply. There is a minimum read charge even for an empty query. Use [Firestore billing guidance](https://firebase.google.com/docs/firestore/pricing) and Query Explain for the actual query shape.

A simple counterexample: one query every fifteen seconds over an eight-hour day gives 1,920 query executions. If each returns twenty documents, that is 38,400 returned-document reads before any other activity. Five independent tabs doing that pattern produce 192,000. This illustrates amplification; it is not a measurement of the present coordinator. Current source shares requests within a browser scope, pauses background polling, and uses queue changes to invalidate and re-query the filtered server projection. Separate browsers remain separate consumers.

Write counts likewise exceed the number of visits. A twenty-minute visit has 120 ten-second intervals per endpoint. Two consenting endpoints can submit up to 240 chunk requests before speech/activity gating and failures. A persisted segment may also update revision/session metadata or cause audit work. Chat, admission, rate counters, finalization and retry state add operations. Inspect `SessionTranscriptionBridge.tsx`, `lib/repositories/consultation-transcript-repository.ts` and background triggers rather than equating one chunk with exactly one total write.

Daily usage must be calculated day by day: `sum(max(actual_day - free_day, 0))`, not monthly total minus thirty daily allowances. A quiet Sunday does not bank unused quota for Monday. Blaze enables usage-based billing; it does not mean an unavoidable fixed Firebase subscription fee. Deploying Firebase Cloud Functions and using current Firebase Storage have billing-plan requirements. Outbound OpenAI requests from Vercel do not themselves require Firebase Blaze; avoid confusing the location of computation with the database's plan. [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Storage requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

Investigate Google bills by service and SKU, not just database size. Idle minimum Cloud Run instances, build artifacts, backups and logs can cost money while users are absent. A budget email is not a guaranteed spending stop. Any automatic shutdown must be deliberately designed because stopping a clinic's access also has operational consequences.

## How many clinic records fit in storage?

There is no universal "patients per gigabyte." One patient can have several encounters, and one encounter spans multiple documents. Store session-bound transcripts, messages, summaries, events and metadata; include indexes and the clinic's other records in the footprint. The reviewed app does not routinely save the full video call. Audio chunks are temporary for transcription. Binary attachments are disabled. Consequently a video-transfer allowance is not a video-archive allowance.

| Assumed total retained footprint per encounter | Encounters in an otherwise empty 1 GiB |
| --- | --- |
| 50 KiB, including overhead | About 20,971 |
| 100 KiB, including overhead | About 10,485 |
| 1 MiB, including overhead | 1,024 |

These are arithmetic illustrations, not measured averages or promised patient counts. With 440 encounters/month, the 1 MiB scenario adds 440 MiB/month and reaches 1 GiB in about 2.3 months without deletion or other data. One year adds about 5.16 GiB; at a constant end-of-year size the excess above the free GiB would be about $0.77/month at the cited storage rate, before backups and other charges. That small storage cost does not prove the whole system is inexpensive. At 100 KiB, the same annual encounter count is about 0.50 GiB.

Firestore's maximum individual document size is 1 MiB. Do not try to put a whole expanding transcript or clinical archive into one document. Subcollections help document-size management but create lifecycle dependencies. Measure a representative, authorized, de-identified sample and actual storage/index usage before a storage commitment. Do not collect new patient content merely to make this estimate.

The retention worker is opt-in and covers summaries, not a complete encounter purge. Deleting `call-summaries/{sessionId}` does not automatically remove `consultationSessions/{sessionId}`, nested messages/transcripts, jobs or independent room records. History can still show the underlying visit. Backups have their own lifecycle. A real clinic needs an approved record-class policy, a reviewed deletion workflow, legal-hold handling and a tested restore process. Do not promise that every record disappears after thirty days, and do not select a retention period merely because free storage is small.

## What to say about video quality

Separate **requested capture**, **published encoding**, and **delivered receiver quality**. A camera can capture 720p while the remote device receives a lower layer or freezes frames. A clear self-preview proves neither remote receipt nor clinical visual adequacy. Resolution describes pixel dimensions, FPS describes delivered temporal updates, bitrate describes data flow, and latency describes time. They are related but not interchangeable.

`RoomShell.tsx` currently passes the selected device ID and enabled audio/video choices to LiveKit, without an application-enforced fixed resolution/FPS profile. The installed SDK has common presets, but a preset's existence does not prove its use. The inspected SDK defaults have `adaptiveStream: false` and `dynacast: false`; TeleConsole does not explicitly enable them here. Simulcast and WebRTC congestion behavior must not be confused with those two named options. Confirm negotiated codec and receiver statistics in the tested deployment. [LiveKit media controls](https://docs.livekit.io/transport/media/advanced/), [subscription behavior](https://docs.livekit.io/transport/media/subscribe/).

The honest answer is: "Video quality depends on the negotiated codec, actual camera, browser, CPU and available network. Our present study does not establish guaranteed 720p/30 FPS or a clinical-image accuracy threshold. We would report receiver resolution, FPS, bitrate, loss and delay for a stated test condition. Audio-only continuation remains available when video cannot be used."

For defense preparation, choose a **proposed** test condition, such as a 720p/30 capture target if the device permits it. Then measure delivered output; do not label all calls 720p merely because that was requested. Example engineering targets in the existing protocol include admission-to-media p95 no more than five seconds, transport RTT p95 no more than 300 ms, jitter p95 no more than 30 ms, interval loss no more than 1%, and median delivered FPS at least 24 in the specified baseline condition. These are proposed project budgets, **not ISO requirements, passed results, or clinical certification thresholds**.

Use selected ICE-pair RTT, inbound jitter, interval loss, resolution/FPS, received bytes, freeze behavior and reconnect events. Convert second-valued RTT and jitter to milliseconds. Compute interval bitrate from byte deltas, and reject counter resets. Selected-pair RTT measures the endpoint-to-connected-peer/SFU transport path, not necessarily the complete doctor-to-patient round trip, and never automatically mouth-to-ear delay. End-to-end audiovisual delay needs a separate synchronized stimulus/capture method. W3C defines the statistics; the application chooses and justifies its acceptance thresholds. [WebRTC stats](https://www.w3.org/TR/webrtc-stats/).

For ordinary baseline planning, reserve several Mbps each way per endpoint and then verify with statistics under the real scene and codec; this is headroom, not a guaranteed provider requirement. A 5 Mbps symmetric test link may be a useful declared baseline, not proof every 5 Mbps connection succeeds. Upload quality, Wi-Fi contention, jitter, packet loss, CPU load, lighting, focus and camera quality matter. For a dental examination, visual limitations can require an in-person visit even when network metrics pass. Small text screen-sharing needs a separate legibility task.

## Dental clinic scope versus a commercial product

The thesis beneficiary and evaluation setting are dental-clinic oriented. The communication primitives are not inherently dental-only; a future general outpatient clinic could reuse them. That does not validate other specialties, emergencies, diagnosis, prescribing, accessibility populations or clinical outcomes. The safe claim is technical reuse potential, followed by specialty-specific workflow and clinical validation.

Single-clinic software is not automatically multi-tenant SaaS. Existing doctor ownership does not by itself provide a clinic membership model, clinic-wide record policies, billing isolation, administrator delegation, offboarding and audit boundaries. Two clinics sharing room names, records or credentials is not an acceptable tenant boundary. For initial real use, consider an isolated, controlled pilot with approved clinicians and separate staging. A shared commercial service needs explicit clinic-scoped authorization and cross-clinic denial tests; it is not a configuration-only expansion that this brief approves.

Patient health information is sensitive personal information under Philippine law. A small business is not exempt simply because it is small. A responsible launch requires review of lawful processing, transparency and consent, appropriate security, processor arrangements, cross-border handling and incident obligations. Obtain current clinic/legal/privacy guidance for the actual business model. Do not claim that buying a cloud plan, encrypting transport or adding a consent checkbox establishes compliance. [Data Privacy Act](https://privacy.gov.ph/data-privacy-act/). Telemedicine also has examination and consent limitations; a communication tool does not confer a professional license or clinical authorization. [DOH guidance](https://privacy.gov.ph/wp-content/uploads/2020/10/DOH-mc2020-0016.pdf).

Before real patients: verify the active frontend/rules/functions release, least privilege and secret rotation; approve clinical intended use and escalation procedures; secure and test backups/restoration; define retention and deletion; review AI processor settings and consent; establish monitoring, incident response, outage fallback and support ownership; fund commercial hosting and overages; and complete paired-call, record-integrity and cross-account tests. These gates are separate from the thesis survey and are not reported passed by this document.

## AI is a separate cost and safety dependency

The summary source uses `gpt-4o-mini`; transcription defaults to `gpt-4o-transcribe`, with an environment override. The provider's current model pages mark both legacy model families deprecated. This is an additional release-planning risk, not proof that this particular account has stopped working. Verify the configured model, availability and migration guidance before relying on it; do not swap models untested the night before defense. [Current transcription model status](https://developers.openai.com/api/docs/models/gpt-4o-transcribe), [summary model status](https://developers.openai.com/api/docs/models/gpt-4o-mini?site_locale=en).

For a text-only illustrative summary with 4,000 input tokens and 800 output tokens, the listed GPT-4o-mini rates give `4,000/1M × $0.15 + 800/1M × $0.60 = $0.00108` per attempt. At 440 such attempts that is about $0.48. This excludes transcription, retries and actual prompt-size variation. It is not the total AI bill. [Model pricing](https://developers.openai.com/api/docs/models/gpt-4o-mini?site_locale=en).

Budget transcription separately using actual audio-token/model billing or a verified account-specific per-minute estimate. If, solely for sensitivity analysis, an operator budgets `a` dollars per processed endpoint-minute, twenty minutes at both endpoints costs `40a` per visit. At an **assumed**, not quoted, $0.006/endpoint-minute, 440 visits would be $105.60 before summaries. Replace that assumption with the selected current model's rate and measured usage. This illustrates why a cheap final text summary does not mean the entire audio pipeline is cheap. Browser speech notes are a distinct clinician-started fallback, not a free, complete, guaranteed two-speaker transcript.

Leaving a call, revoking an invitation and other finalization events can request generation. Guards check evidence, availability, revisions and reviewed content. A trigger is not proof of a paid provider call. A missing-evidence placeholder or a ready/status marker alone is not an invoice. Chat is displayed in history but is not currently fed into the clinical prompt. AI drafts require clinician review; no patient, short duration or silent transcript must be used to invent clinical findings.

## Misunderstandings that would hurt later learning

| Hand-wavy statement | More precise replacement |
| --- | --- |
| "LiveKit supports 100, so we support 100." | A transport quota is an upper bound; application capacity requires an end-to-end workload and correctness result. |
| "One twenty-minute call costs twenty minutes." | With two connected endpoints it uses about forty participant-minutes. |
| "We have many registered patients, so concurrency is high." | Registered population, monthly encounters and simultaneous connections are distinct quantities. |
| "Free means there is no operating cost." | Free usage is conditional; commercial terms, overage, AI, operations and support remain. |
| "Firestore has very few documents, so it cannot cost money." | Reads, writes, retries, indexes, network and other Google services have separate meters. |
| "A query is one read; a chunk is one write." | Count returned documents, dependent reads, segment/state writes and triggered work. |
| "We store video in Firebase because we use Firebase." | This app transports media with LiveKit and retains structured text/metadata; routine call recording is not implemented. |
| "Thirty days means all evidence is automatically gone." | Summary retention is opt-in and not an encounter-wide purge or backup deletion. |
| "720p, fast page load and low RTT prove good clinical video." | Delivered resolution, freezes, complete-path delay and task adequacy need separate measurements. |
| "Encrypted JWT means only the patient can use the link." | A signed bearer capability is not patient identity or encrypted clinical data. |
| "RBAC or cloud compliance means our clinic is compliant." | Roles, deployed rules, ownership, operations, agreements and clinical/legal responsibilities must work together. |
| "More patients in one room create isolated encounters automatically." | Room membership and patient-bound record isolation are different contracts; group clinical use is not validated. |

The deeper lesson is to keep **units, scope, mechanism and evidence** attached to every claim. Autoscaling does not erase quotas; an SDK feature is not an enabled feature; a repository rule is not necessarily the active rule; an observed call is not a capacity curve; and technical reusability is not demonstrated clinical suitability.

## A realistic one-day defense preparation plan

| Time block | Action | Evidence or output |
| --- | --- | --- |
| First hour | Freeze the app version, check provider dashboards and remaining quotas, assign speakers | SHA, environment, dated plan screenshots without tokens or patient data |
| Hours 2-3 | Review the targeted manuscript edits and this briefing with the adviser | Same 259 pages; no changed survey numbers; agreed claim boundaries |
| Hours 3-5 | If authorized and equipped, run isolated synthetic paired-call trials | Raw numeric measurements, failures retained, no invented maxima |
| Hour 6 | Check record ownership, consent-off behavior, interruption and AI-unavailable journey | One encounter per intended patient; no exposed clinical content |
| Hour 7 | Prepare five slides and a short backup demo | Problem, architecture, evidence, limits/cost model, next steps |
| Hour 8 | Rehearse adversarial questions with all teammates | Consistent units and answers; named owner for each question |

Do not spend the day adding new specialties, tenants, uploads, E2EE, an AI model replacement or a risky architecture rewrite. Do not buy a plan or run production load without owner approval. Do not edit survey responses or insert an unperformed experiment into Chapter IV. If trials cannot be completed, state the capacity limitation plainly and explain the next experiment. That is more defensible than an invented limit, but the panel decides whether the study's scope is sufficient.

For an optional capacity pilot, use separate physical devices and at least two independently recorded network conditions. Normal and incognito tabs on one PC separate authentication, not hardware or network bottlenecks. Test separate rooms for separate pairs. Run 1, then 3, then 5 simultaneous pairs; repeat each ten-minute measured level three times after two-minute warm-ups. At the modeled bitrate, all levels including warm-ups use about 648 participant-minutes and 8.26 GB downstream. This is a budget forecast only; verify remaining allowance and allow overhead before starting.

Freeze thresholds before testing; retain warm-up data separately. Stop on cross-encounter contamination, access failure, sustained unexpected errors, exhausted quota or unrecovered media loss. Record failures and stop reasons. A highest passing load is a demonstrated lower bound under those conditions, not proof that the next level is impossible or that more is safe. The proposed protocol has **not been executed in this task**.

Open WebRTC Internals before test calls and export after them. Keep only numeric/pseudonymous evidence for the report. Raw dumps can contain addresses, URLs, session IDs or credentials. Do not enable diagnostic audio or DataChannel-message recording without explicit participant consent and a handling/deletion plan. A blank dump or a connection state of "new" is not a successful media measurement. A connected badge alone does not prove remote frames or intelligible audio.

## Minimal manuscript changes and what is deliberately unchanged

The revised copy preserves 259 physical pages, page sizes, existing printed numbering and bookmarks/page labels. Targeted paragraphs/table cells clarify capacity, current enabled features, signed links, optional retention, development versus clinic costs, and stale appendix excerpts. Chapter IV survey tables, sample sizes and weighted means are not recalculated or replaced. No new load-test result is inserted. The GitHub copy additionally masks demo identifiers/invitation information and omits personal CV images; those public-copy privacy redactions are listed separately from substantive revisions. The supplied original remains untouched.

The development budget is retained as a reported estimate, not independently audited expenditure. The original zero-cost rows are not a promise of free clinic operation. The AI expense's "Productivity Benefit" label is corrected because an expense does not measure time savings. Legacy diagrams and source excerpts remain for pagination, with explicit status limitations in the surrounding text and appendix introduction. For final publication, replace stale excerpts/diagrams in the editable source when the adviser permits a larger revision.

There is a pre-existing contents/page-reference inconsistency: for example, the contents lists development cost at printed page 83 while the supplied document places its heading at printed page 80 (PDF page 92). This task preserves existing numbering and does not silently regenerate the contents. Have the adviser review cross-references before submission. Keep the supplied PDF as the original and do not publish manuscript screenshots, identities or raw extracts to a public repository.

## Five-minute explanation: read aloud and rehearse

"Our system is TeleConsole, a thesis prototype for a dental clinic. The equivalent of asking a CCTV project how many cameras it supports is asking us how many doctor-patient consultations can run at the same time, at an acceptable delivered quality, without broken access or mixed records. We should not answer that with a provider advertisement.

Our intended workflow is one doctor and one patient per encounter. Our existing formal evaluation measures respondents' perceived software quality. It does not establish a maximum concurrent-call capacity, guaranteed video quality or clinical accuracy. That is our first shared boundary.

There are three infrastructure responsibilities. Vercel serves the application and API routes. Firebase provides identities and structured records. LiveKit carries the audio and video. Optional AI is another processing service. These have different meters, so one limit cannot describe the whole system.

The current free transport plan lists one hundred concurrent connections, but that is not proof of fifty safe consultations in our app. Its time allowance is counted per participant. A twenty-minute visit with a doctor and patient uses about forty participant-minutes. Its five-thousand-minute allowance therefore covers at most one hundred twenty-five such visits from time alone. Video data can run out first. At our illustrative bitrate, the transfer allowance would cover roughly ninety-eight visits, with no margin or other traffic. These are planning calculations, not measured capacity.

For a small clinic example, imagine twenty visits a day for twenty-two days, each lasting twenty minutes. That produces seventeen thousand six hundred participant-minutes and, under our stated bitrate assumption, about two hundred twenty-four gigabytes of downstream media. The modeled three-service baseline is about seventy US dollars a month: a fifty-dollar LiveKit Ship plan and a twenty-dollar Vercel Pro base, with document operations within the assumed Firestore allowance. This excludes AI, backups, usage overages, support, taxes and other costs. It is not a clinic quote.

We also do not store the full video call in Firestore. We store session records, text, summaries and metadata. How many records fit depends on their measured size, indexes and retention. Deleting a summary does not erase the complete encounter. The thirty-day summary worker is optional, so we must not promise that everything automatically disappears.

For quality, requested camera resolution is different from what the other person receives. We need remote resolution and frames per second, freezes, packet loss and measured delay on stated networks. A clear local preview or fast website does not prove those. Dental clinical suitability still needs clinician judgment.

Our communication components may be reusable for other clinics, but our evaluation is dental-oriented. Commercial service requires more than buying cloud plans: active-rule verification, isolation, consent, retention, backups, support and clinical/privacy review. To establish capacity, we would test one, three and five simultaneous pairs on separate devices, retain failures, and report only the highest passing level under those conditions.

The message we must all keep consistent is this: provider quota, measured application capacity and clinical readiness are three different claims. We can explain our architecture and calculate a budget now. We will not invent a performance number that our evidence does not contain."

## Twenty-minute team explanation: timed speaking guide

Use the following as a facilitated explanation, not a promise that reading it quickly lasts twenty minutes. The pauses and teach-back exercises are part of the timing. At about 120 spoken words/minute, the five-minute script above is a useful opening rehearsal; adjust after timing your own speech.

### Minutes 0-3: the question behind the question

Open with: "The panel is not asking us to memorize a cloud plan. They are asking whether we understand the operating envelope of our own system. A capacity answer needs a workload, a quality level, a failure criterion and evidence."

Explain that one dental appointment is a room/encounter interaction, while two browsers are media endpoints. An endpoint can stay connected outside an appointment. A record can remain after both endpoints leave. These objects have different lifetimes and costs. Say explicitly that the survey evaluates perceptions and does not produce the missing capacity measurement.

Pause and ask a teammate: "If there are five doctors each consulting one patient at the same time, how many consultations and how many endpoints are there?" Expected answer: five consultations, ten endpoints. Then ask whether ten registered patients mean ten simultaneous connections. They should answer no. Correct the units before moving on.

### Minutes 3-6: follow the responsibilities

Say: "The browser asks the application for authorized access. The server checks identity and invitation policy, then issues a room-scoped credential. Media goes through LiveKit. Firebase stores the encounter records. When evidence and lifecycle conditions allow, optional AI produces a draft for clinician review."

Use the four-responsibility table. Ask which service should be investigated if video freezes while the history API remains fast. The answer is not automatically Firebase: inspect client CPU, network, codec and media transport. Ask which service to inspect if history fails but an existing media connection continues. The application/database path is now relevant. This separation makes debugging and cost estimation less vague.

Remind everyone that the signed invitation is a bearer capability. It does not identify the patient by itself. A verified allowlisted account can skip waiting; other visitors require admission. Do not describe device or location as identity verification. A correct graph should show authorization before credentials, not a direct public database-to-AI pipeline.

### Minutes 6-9: calculate allowances together

Write `20 × 2 = 40 participant-minutes`. Then write `5,000 / 40 = 125 visits from time alone`. Ask why that is not the number of simultaneous calls. Someone should explain that it is a monthly time budget, not a concurrency measurement.

Next introduce downstream data. Use the worked 0.51 GB per visit scenario and divide fifty by that value. Ask which modeled resource binds first. The answer is transfer at roughly ninety-eight visits, before the time-only estimate. Emphasize that actual metering includes the actual tracks, bitrate, idle time and rounding. We have not measured these scenario values in a real clinic.

Finally ask: "Can we answer fifty simultaneous appointments because one hundred divided by two is fifty?" The answer must be no. That is a provider arithmetic ceiling before other bottlenecks, not a tested workload. A grid constant of forty or queue limit of ten is also not the answer.

### Minutes 9-12: price a small clinic without hiding exclusions

Use the 440-visit row. State the assumed duration, two endpoints, bitrate and operating days before giving the subtotal. Explain that Vercel's fee is not charged per patient, and Firebase Blaze is not simply a fixed monthly seat subscription. The source prices and the workload model serve different roles.

Ask a teammate to list five excluded costs. Good answers include transcription, AI retries, backup/restore, provider usage beyond included amounts, staff support, domain, internet, taxes and privacy work. If they say "seventy dollars is the full business cost," stop and revisit the assumptions.

Show why database size is not read volume. A repeated query can bill repeatedly even when the underlying documents never change. The app has optimizations, but their presence is not a measured cloud savings percentage. Describe instrumentation as the next step: record operations and metered storage during representative synthetic workflows, then reconcile with provider usage by service and SKU.

### Minutes 12-15: explain quality and stored records

Say: "720p is not the same as thirty delivered frames per second, and neither is a complete clinical-quality assessment." Ask the team to identify local preview versus remote video. Explain that low bandwidth, packet loss, CPU load, poor lighting and camera focus have different symptoms. A speed test alone does not distinguish them.

Use the list of receiver metrics and the separate end-to-end delay method. Do not call SFU transport RTT a measurement of patient-to-doctor mouth-to-ear delay. Do not call a provider's latency description the app's result. If screen sharing is demonstrated, have someone read small text at the remote endpoint rather than judging the sender's screen.

Then distinguish transport from retention. We have structured text records, not a routine video archive. A summary is one document among related session evidence and jobs. Deleting it does not automatically erase all other evidence. Ask: "What must we decide before promising a clinic thirty-day deletion?" Expected answers include record classes, approved periods, complete worker scope, legal holds, backups and verification.

### Minutes 15-18: rehearse the hard questions

Panel: "Can you deploy to a medical clinic tomorrow?" Answer: "The prototype is dental-oriented. Its components could be adapted, but routine clinical service needs deployment, privacy, support, reliability and specialty-specific validation. We have not established those simply through our questionnaire."

Panel: "Why can you not give us a maximum?" Answer: "Because we have not executed the controlled concurrency experiment. We can give a provider ceiling and an explicit proposed protocol, but claiming that ceiling as our own would misrepresent the evidence."

Panel: "What if OpenAI is unavailable?" Answer: "The call remains usable. AI is optional; the record should show unavailable or insufficient evidence rather than fabricate clinical content. A draft requires professional review."

Panel: "Is the link encrypted and bound to the patient's location?" Answer: "It is signed, not proof of identity or location. Server validation and verified-account/admission policy control access."

Give each teammate one question without letting the main developer answer first. Coherence means shared reasoning, not identical memorized words. If someone knows only the numerical answer but cannot name its units, repeat the worked example.

### Minutes 18-20: agree on the evidence boundary

End with four sentences everyone can defend: "We built the specified prototype. Our formal study reports respondent-perceived quality. Our present evidence does not establish a maximum concurrent-call capacity or certified clinical performance. We have a concrete, budgeted method for measuring the next operating envelope."

For three writers: writer one owns scope/methodology and limitations; writer two owns architecture/security and the demonstration; writer three owns capacity/cost calculations and evidence navigation. Keep a single dated fact sheet. If a test is subsequently run, update the environment, SHA, conditions and result for everyone together; do not have one teammate claiming a proposed target while another calls it a passed result.

## Evidence and source notes

Repository verification in this task: safe fast-forward from 54633bb to aa041fe; local AGENTS.md edits preserved. Source checks include `RoomShell.tsx`, grid policy, the ten-second transcription chunk interval, summary/transcription model constants, opt-in retention and the dated verification ledger. The follow-up hardening and new local tests are documented in [the security/load answer](load-security-rbac-and-revision-answer.md) and [evidence index](evidence/README.md). Historical passes remain dated; no authenticated production acceptance or rules release was performed in this checkpoint.

The separate revision manifest records every target page and replacement reason. The PDF verification checks all 259 page sizes, existing labels/bookmarks, every untouched page's render, and pixels outside the approved changed regions. These are **document checks**, not security or capacity tests. The regional pricing snapshot and model assertions verify arithmetic, not future invoices. Recheck public sources and the actual account before procurement or presenting time-sensitive prices.
