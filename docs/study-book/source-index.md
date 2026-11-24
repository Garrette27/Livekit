# Source index and evidence boundaries

## Edition identity

This single-volume study edition was prepared on 24 November 2026. Its
application baseline is commit c43b76f08886e8fc329d815c3ae3254d185656dd in
Garrette27/Livekit. The remote was fetched again during final preparation; it
still contained the earlier documentation checkpoint, not a newer application
implementation. This book is not a claim that a production service was tested
on the edition date.

The sixty chapters contain exactly 60,000 words under the stated body-prose
count. The source index, front matter, headings, contents, code fences, tables
and chapter source trails are outside that count. The manuscript source,
progress record, provenance record and document verification script are retained
in docs/study-book and scripts/thesis. The single PDF is the reading deliverable.

## Supplied reference material and attribution

Developer Tools and Computer Systems, user-supplied PDF, 200 pages, is the source
for the groups labeled Supplied systems reference in the chapters. The selected
readings are adapted, not represented as newly authored LiveKit text. Page
numbers refer to the supplied PDF's physical pages. The original reference's
internal bibliography labels were removed rather than left as dangling citations.
Command listings, unrelated product cases and unsupported cross-references were
excluded. Some paragraphs were edited to stand alone or make their comparative
scope explicit. The original supplied PDF was not copied into the repository.

Its SHA-256 is
546084919b80bbb8c2bb8659d2d0070c6e2021e0fe2063660479aae8e98e9a0f.
The provenance record identifies the selected source-paragraph IDs, page groups
and adapted word totals by chapter. The counted split is 43,902 words of original
LiveKit instruction and transfer commentary, and 16,098 words of adapted systems
readings. The comparative examples do not claim a Python, SQL, Django or Docker
production backend for this application.

Getting the Basics Right: RideMax, 40 Chapters; RideMax Editorial Implementation
Study, Edition 5; and RideMax DevTools Field Manual were also supplied by the user.
Their progression, worked-case approach and practical-study format informed this
book's structure. Their product requirements, implementation details and test
outcomes were not adopted as LiveKit facts. This book does not reproduce those
three books as appendices or claim their work as its own application evidence.

## Product and design contracts

AGENTS.md supplies the local software-design and teleconsultation delivery
instructions. Its unrelated product examples are not a request to add marketing,
HR or faculty functionality. The working copy's unrelated edits were preserved.

docs/thesis-defense-guide.md explains the thesis scope and defensible claims.
docs/invitation-flow-design.md and docs/invitation-access-model.md define the
object-centered workbench, invitation capability and admission policy.
docs/access-control.md defines identity, authorization and prepared backend roles.
docs/production-readiness.md distinguishes implementation from governance,
operations, compliance and remaining acceptance work.

docs/identity-and-record-integrity.md and docs/data-model-readiness.md explain
account, guest and encounter relationships. docs/consultation-modular-architecture.md
maps the service and adapter boundaries. Historical architecture prose can lag
later integrity hardening; implementation and dated regression evidence take
precedence where an older snapshot describes a weaker identity rule.

docs/ai-summary-status.md explains optional AI availability and evidence limits.
docs/cost-control-and-migration.md explains operational tradeoffs and recovery
planning. These notes are source navigation, not authorization to mutate data.

## Implementation entry points

The invitation policy is traced through lib/invitations/admission-policy.ts,
lib/invitations/email-allowlist.ts, lib/invitations/invitation-use-reservation.ts,
lib/invitations/validate-service.ts and
lib/services/invitation-access/invitation-access-core.ts. The app/api/invite and
app/api/waiting-room routes adapt requests to that service boundary.

Identity and request policy are traced through
lib/services/shared/request-auth.ts,
lib/services/shared/session-participant-auth.ts and
lib/services/shared/waiting-room-auth.ts. Room ownership and reserved namespaces
are traced through lib/services/room-access/doctor-room-access.ts and
lib/rooms/room-name-policy.ts. lib/firebase-admin.ts owns the trusted Firebase
runtime boundary rather than the browser's public configuration.

Consultation state and provider adaptation are traced through
lib/services/video-chat/consultation-session-core.ts,
lib/services/video-chat/rtc-transport-adapter.ts,
lib/services/consultation-tracking/consultation-tracking-core.ts and
lib/services/consultation-finalization/consultation-finalization-core.ts.
Chat persistence is in lib/services/video-chat/chat-message-store.ts.
History projections are in
lib/services/history-summary/summary-projection-service.ts.

Summary review policy and commands are traced through
lib/services/summary-management/summary-edit-policy.ts and
lib/services/summary-management/summary-management-core.ts. The provider-facing
transcription adapter is lib/services/transcription/openai-audio-transcriber.ts;
its existence is not a statement that provider entitlement was available or that
paid calls were made for this book.

Client hooks such as hooks/useWaitingQueue.ts, hooks/useSessionChat.ts and
hooks/useTranscription.ts connect projections and optional capture to browser
lifetimes. Read their actual dependencies rather than inferring authority from
the hook name. firestore.rules and storage.rules are separate policy artifacts
from the application release.

## Historical verification, not newly executed acceptance

docs/testing/verification-status.md is the status index. The dated reports retain
failed baselines, repaired results, environment limits and unresolved work.
docs/testing/defense-readiness-2026-11-22.md records the fifty-two application
cases, thirteen emulator cases and the local runtime caveat. Those counts are
historical, not a new suite run during book production.

docs/testing/rules-release-2026-11-19.md records the earlier reviewed Firestore
release and retrieved-source verification. It must not be confused with the later
clinician-only room/call creation change, which the cited November 22 report
still marks as awaiting release. No new rule release occurred for this book.

docs/testing/performance-assessment.md defines the performance protocols and
limits. A public HTTP pilot, deterministic polling budget, actual media trial
and clinician study answer different questions. Media latency, concurrent-call
capacity and clinician efficiency remain unmeasured in the cited baseline.

tests/security-policies.test.mjs and tests/queue-and-auth-regressions.test.mjs
contain synthetic policy and lifecycle regressions. A proposed exercise in this
book is not automatically one of those executed cases. Test intent, observed
execution, active deployment and complete production acceptance remain separate.

## Primary documentation for checking tool semantics

Chrome DevTools, Inspect network activity:
https://developer.chrome.com/docs/devtools/network/

Microsoft, Working across Windows and Linux file systems:
https://learn.microsoft.com/en-us/windows/wsl/filesystems

Firebase, Transactions and batched writes:
https://firebase.google.com/docs/firestore/manage-data/transactions

Firebase, Build unit tests for Security Rules:
https://firebase.google.com/docs/rules/unit-tests

LiveKit, Authentication:
https://docs.livekit.io/frontends/build/authentication/

W3C, Identifiers for WebRTC's Statistics API:
https://www.w3.org/TR/webrtc-stats/

Git, git-diff reference:
https://git-scm.com/docs/git-diff

These primary pages were opened during final source checking. Browser and SDK
interfaces can change; consult the documentation for the version being tested.
The linked W3C statistics publication is a Candidate Recommendation Draft, not a
claim that every browser implements every field identically. The adapted systems
readings remain attributable to the supplied study text rather than to these
web pages; the primary links are verification aids, not an invented bibliography
for material copied from elsewhere.

## A final boundary

The book teaches how to investigate, test and explain a thesis prototype. It
does not certify a medical service, prove clinical accuracy, grant access to
patient records or authorize production experiments. A useful next study begins
with a precise question, an approved environment and an evidence plan. Keeping
that boundary explicit is part of the engineering method, not an omission.
