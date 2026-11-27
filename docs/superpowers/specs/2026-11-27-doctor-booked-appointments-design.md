# Doctor-booked appointments: proposed first release

Status: design approved by the user on 27 November 2026. Scheduling remains disabled until implementation and verification are complete.

## Intent and alternatives

The user selected doctor-booked appointments rather than patient self-booking. Keep scheduling separate from invitation admission and encounter evidence. A link-expiry-only calendar shortcut was rejected because it cannot represent booking, cancellation or conflicts. Patient self-booking was deferred because it additionally needs availability publishing, slot holds and abuse controls.

## Proposed bounded design

- Only a provisioned, non-administrative doctor creates, lists, cancels or reschedules their own appointments. Administrators cannot conduct consultations or book as a doctor.
- A separate opaque-id appointment stores doctor ownership, patient display/contact information, UTC start/end, the selected IANA timezone, booked/cancelled state and timestamps. Patient contact is scheduling information, never verified identity or direct-admission authority. No clinical notes belong in this record.
- The server validates duration and dates and prevents overlapping booked appointments for the same doctor transactionally. Rescheduling updates the same appointment with expected-version conflict checks. Cancellation preserves the record and releases its slot.
- A compact upcoming list and date/time form use explicit timezone labels, inline pending/error/conflict feedback and keyboard-accessible controls. Phone/tablet layouts use the same workbench, not a second calendar UI.
- At appointment time the doctor separately creates or selects an invitation. Booking does not issue a LiveKit token, bypass the waiting room, start transcription, create a no-show encounter or generate an AI summary.
- Server endpoints own mutations. Direct client writes remain denied. Test ownership, administrator denial, double booking under concurrent requests, cancellation, rescheduling, timezone conversion, stale versions and input bounds before enabling the capability.

## Not in this release

Patient self-booking, recurring appointments, reminders/email/SMS sending, billing, external calendar sync, automatic clinical no-show classification and cross-clinic scheduling.

## Evidence and thesis boundary

HL7 FHIR separates the planned appointment from the actual encounter and defines booked/cancelled lifecycle states: https://hl7.org/fhir/appointment.html . This is design precedent only; implementing this small workflow would not establish FHIR interoperability or certification. Later engineering work is not part of the original respondents' evaluation. Keep scheduling labeled future work in the manuscript and defense pack until the implemented release has its own dated evidence.
