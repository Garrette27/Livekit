# Doctor-booked Appointments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a separate provisioned doctor book, reschedule and cancel their own appointments without altering invitation admission or encounter evidence.

**Architecture:** A pure appointment policy validates commands and timezone conversion. One server service owns Firestore transactions, serializing each doctor's calendar through a versioned lock document. A responsive doctor workbench uses the existing authenticated route and feedback patterns.

**Tech Stack:** Existing Next.js, TypeScript, Firebase Admin/Firestore, React, Node22 tests and Playwright. No new runtime package or notification provider.

**Spec:** `docs/superpowers/specs/2026-11-27-doctor-booked-appointments-design.md` (approved).

## Global constraints

- Doctor-owned appointments are separate opaque-id documents. Administrators and patients cannot manage the doctor's calendar.
- Booking does not grant room access, consent to transcription, create an encounter or generate a clinical summary.
- No self-booking, recurring appointments, reminders, external calendar sync or billing.
- Keep direct client writes denied. Retain the scheduling flag until deployment prerequisites are verified.
- Builder defaults: patient display name1-100 characters, optional contact email up to320 characters, start within180 days, duration15-120 minutes, IANA timezone shown explicitly. Contact is self-declared scheduling data, not identity proof. These are implementation bounds, not clinical recommendations.

## Review focus

1. Concurrent overlapping bookings: exactly one accepted; adjacent end/start times may coexist.
2. Retries after a lost response: a stable opaque request id must not create duplicate appointments.
3. Timezone gaps/ambiguities: reject invalid or ambiguous local times; display the selected zone explicitly.
4. Cross-doctor ids or stale versions: deny other owners and return409 on stale mutation without changing data.
5. Cancellation and disabled-feature state: release only that booking's slot; do not affect invitations, calls or existing records.

### Task1: Policy and timezone contracts

Files: create `lib/appointments/appointment-policy.ts`; test `tests/appointment-regressions.test.mjs`.

Interfaces: `parseAppointmentCommand(body, now)` returns a validated create/reschedule/cancel command or bounded validation error; `localAppointmentTimeToUtc(local, timezone)` rejects impossible/ambiguous values; `appointmentsOverlap(start,end,otherStart,otherEnd)` uses half-open intervals. Document interfaces before implementation.

- [ ] Write and run failing tests for input bounds, invalid dates, timezone conversion/DST ambiguity, adjacent versus overlapping intervals and stale expected versions.
- [ ] Implement the pure policy and rerun the focused tests until green.

### Task2: Server ownership and transactional booking

Files: create `lib/services/appointments/appointment-service.ts`, `app/api/doctor/appointments/route.ts`; modify `lib/auth/access-policy.ts`, `firestore.indexes.json`, `firestore.rules` only where the new server-owned namespace needs explicit denial.

Interfaces: `AppointmentService.list(doctorUid, cursor?)` returns a bounded page with next cursor; `AppointmentService.execute(doctorUid, command)` returns the committed appointment or a typed conflict. The route authenticates with `appointment:manage-own`, checks the existing capability flag and maps ServiceResult errors.

- [ ] Add failing runtime tests for missing auth, admin/patient denial, wrong owner, malformed/null JSON and disabled flag.
- [ ] Add transactional tests using a per-doctor `appointmentCalendars/{uid}` version lock, reading the appointment and overlap query before writes. A client-generated UUID serves as the opaque create/idempotency key, never as authority. Same-id same-command retries return the existing result; conflicting reuse fails409.
- [ ] Implement create/reschedule/cancel with expected-version checks and bounded list pagination. Store UTC timestamps plus IANA display zone, patient label/contact and ownership. Log no contact values or tokens.
- [ ] Verify concurrent overlap, adjacent booking, cross-doctor independence, replay, cancellation and reschedule conflict in the local Firestore emulator. Record required production indexes separately; do not claim Vercel deployed them.

### Task3: Responsive doctor workbench

Files: create `app/doctor/appointments/page.tsx`; modify `components/doctor/DoctorAppHeader.tsx` and the private account capability projection as needed, keeping admin navigation non-clinical.

Interfaces: authenticated GET/POST to the new endpoint; the page uses explicit timezone, upcoming list, inline pending/error/conflict states, reschedule/cancel and Show more. Do not fetch or display another clinician's patient history.

- [ ] Write failing synthetic browser tests for create, cancel, stale reschedule, disabled state, keyboard navigation and320/820/1280px layouts.
- [ ] Implement the workbench and feature-aware navigation using existing styles/feedback.
- [ ] Verify no invitation token, media or transcription request occurs when booking.

### Task4: Integration, publication and defense alignment

Files: update tests/package chain, capability/readiness/access notes, ranked Q&A, slide notes and bounded manuscript wording only after verified implementation.

- [ ] Run typecheck, lint, complete security regressions with tracked instructions, focused browser tests, emulator cases and production build. Review the diff against the approved scope.
- [ ] Publish a verified code checkpoint to main without private files or production account/secret changes; inspect remote CI and frontend deployment separately.
- [ ] Keep scheduling unavailable in production until its indexes and signed-in acceptance are verified. Explain implemented-but-disabled versus live behavior explicitly.
- [ ] Update the scheduling answer and manuscript only to the measured state, preserving259 pages, objectives, survey findings and budget. Rebuild/verify public downloads and push the artifact checkpoint.

## Self-review

The tasks cover ownership, opaque ids, conflict/version rules, timezone handling, cancellation, responsive feedback and admission separation. They intentionally exclude notification delivery and self-booking. Each review-focus failure has a task-level test. Scheduling later cannot retroactively become a feature evaluated by the original survey respondents.
