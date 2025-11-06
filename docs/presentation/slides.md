## Title
Secure Telehealth Video Consultation – Data Privacy (Philippines) Focus

## Introduction
- Current practice often uses social messaging (e.g., open links via clinic pages, Messenger) with little access control.
- Pain points from interview: slow back‑and‑forth text, momentum loss, shy patients, blurry video, unrestricted join links.
- Need: a single secure platform with clear audio/video, invitation controls, and automatic summaries to reduce repeat questions and improve follow‑ups.

## Problem Statement
- Ad‑hoc messaging lacks role‑based access and allows unintended listeners; no device/geo/browser restrictions.
- Doctors need clarity first (audio/video quality) and accurate records; transcripts/summaries are manual or missing.
- Conversations stall due to delayed replies; history is scattered; privacy posture relies on informal practices.

## How This App Solves It (solution overview)
- Invitation‑gated access: single‑use, time‑limited links with email/country/browser/device constraints to prevent unintended listeners.
- Clear calls: LiveKit real‑time A/V with our dedicated room flow; no ad‑hoc Messenger links.
- Automatic records: webhook‑triggered AI summaries saved to `call-summaries`; call records removed post‑summary; 30‑day retention scheduled.
- Centralized history: dashboard lists past consultations and summaries for quick review and follow‑ups.
- Privacy posture: input sanitization, IP rate limiting, HMAC‑SHA256 webhook verification, and auditable invitation violations.

## General Objective
- Build a role-based web app for secure video consults with invitation gating, real-time sync, and optional AI summaries, aligned to Philippine data privacy practices.

## Specific Objectives
- Implement invitation-gated room access with single-use/time-limited/geo+device constraints.
- Use LiveKit for real-time audio/video and Firestore for metadata and history.
- Apply security: JWT (HS256), HMAC-SHA256 webhook verification with timing-safe compare, input validation, IP rate limiting.
- Enforce data lifecycle: delete call records after summary; auto-delete summaries after 30 days.
- Provide dashboard history, share links, and minimal-PII summaries.

## Scope
- Roles: doctor (creator) and patient (invited); admin optional.
- Real-time video sessions; transcription optional; AI summary optional.
- Dashboard for history (call-summaries) and cleanup utilities.
- Initial assessments and follow‑ups; not intended to replace in‑person diagnostics (per interview).

## Out of Scope / Limitations
- No end‑to‑end encryption beyond TLS; relies on LiveKit transport security.
- Rate limiting is in‑memory (single instance); no Redis cluster yet.
- AI summaries depend on configured OpenAI key; otherwise fallback text.
- Browser‑first experience; mobile apps not included.
- No payments/billing integration (interview mentioned payment timing; excluded for now).
- Not a diagnostic replacement; image/X‑ray tooling out of scope.

## Architecture Highlights
- Next.js routes with IP sliding-window rate limit and sanitization.
- Webhook: HMAC-SHA256 verification; idempotent summary generation.
- Firestore collections: invitations, rooms, consultations, calls, call-summaries, scheduled-deletions.
- Cloud Function/scheduled cleanup for retention.

## Key Algorithms
- IP-based sliding-window rate limiting with temporary blocking and periodic cleanup.
- HMAC-SHA256 signature verification with timing-safe compare.
- Regex-based input sanitization and validators; SHA-256 device fingerprint hashing.
- Idempotency checks for summary generation.

## Data Lifecycle
- During call: `calls/{roomName}` stores transcription/metadata.
- On end (webhook): generate `call-summaries/{roomName}`, delete `calls/{roomName}`.
- Schedule `scheduled-deletions/{roomName}` for 30 days.

## Diagrams
- See `erd.mmd`, `block-diagram.mmd`, and `flowchart.mmd` in this folder.

## Evaluation Plan
- Usability: SUS.
- Performance: LiveKit/WebRTC metrics; UI timing.
- Security: request rate limiting; webhook signature tests; audit of invitation violations.

## Compliance Posture
- Practices aligned to Data Privacy (Philippines): access control, retention, audit logs, minimization.

## Conclusion
- We translated interview findings into a focused platform: clear audio/video with LiveKit, invitation‑gated access, transcript‑driven summaries, and an auditable dashboard.
- The design addresses momentum loss (live sessions + summaries), privacy concerns (invite constraints), and scattered records (central history), aligning with Data Privacy (Philippines) practices.


## Interview Alignment (doctor insights mapped to existing features)
- Clear audio/video is critical → implemented via LiveKit real‑time sessions.
- Single secure platform preferred → app consolidates calls, transcription, and summaries with a history dashboard.
- Invitation control improves privacy → single‑use, time‑limited, geo/browser/device allowlists.
- Automatic summaries reduce repeat questions → webhook‑triggered AI summaries stored in `call-summaries`.
- Centralized records help review and follow‑ups → dashboard lists summaries and supports cleanup/retention.
- Initial online assessments are acceptable → app supports triage and follow‑ups; not a diagnostic replacement.

## Additions adopted from interview (within current scope)
- Emphasize privacy controls in patient communications to increase confidence (kept within existing invite constraints).
- Position summaries as review aids for both clinicians and patients during follow‑ups (no billing or diagnostic promises).

## Synthesis (from clinician interview)
- Doctors currently rely on ad‑hoc social messaging; links are openly shared and uncontrolled.
- Key needs: clear audio/video, invitation control, accurate transcript/summary, centralized records.
- Patients can be shy; privacy controls improve confidence; summaries reduce repetitive questions.
- A single, secure platform consolidating video, transcription, and history increases efficiency.

## Research Method (interview‑led, not Agile)
- Conducted semi‑structured interview with a practicing clinician to elicit real workflows and pain points.
- Performed quick thematic analysis to derive requirements: clarity, access control, summaries, dashboard.
- Followed a linear path: Interview → Requirements → Design → Implementation → Validation.
- Rationale: the app originated directly from interview findings rather than iterative Agile sprints.

## Development Phases (interview‑led)
1. Requirements Elicitation: capture tasks, constraints, and desired features from the interview.
2. System Design: plan invite gating, data lifecycle, retention, and summary generation.
3. Implementation: Next.js routes, Firestore models, LiveKit integration, OpenAI summaries, rate limits.
4. Validation: functional tests, webhook signature checks, retention scheduling, dashboard review.
5. Deployment & Review: publish prototype, collect clinician feedback for next iteration.

## Conceptual Design
- Inputs: login credentials, invitation tokens, room actions, conversation audio/transcript.
- Processes: authentication, invite validation, rate limiting and sanitization, LiveKit session, webhook summary, retention scheduling, dashboard queries.
- Outputs: real‑time session, call summary with key points, history views, audit/violation records.

## Instrumentation
- Usability: SUS survey with clinician users.
- Performance: session metrics (join time), basic WebRTC indicators via LiveKit, UI timing.
- Security: rate‑limit hit rate, webhook HMAC verification logs, invitation violation audits.
- AI Evaluation: spot‑check summary accuracy and usefulness vs. transcript; user feedback.


