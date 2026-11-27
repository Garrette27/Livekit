# Appointment implementation review and decisions

27 November 2026. Approved doctor-booked design; synthetic local evidence only. Independent reviewer requested changes; the implementing agent addressed them in one regression-backed fix pass. This is not signed-in production acceptance.

## Findings addressed

- Shared-browser identity transition: authorization is cleared while a new identity is checked; the workbench is keyed to the verified UID, requests pin that UID, and obsolete responses are ignored. Direct A-to-B switches with drafts and delayed A responses are covered.
- Create idempotency: an immutable original-intent receipt is stored separately from mutable booking state. Matching retries return the current record after reschedule/cancel or the original start time. Changed intent cannot borrow the receipt. A new past booking remains rejected.
- Cancellation confirms the selected version, and list refresh disarms it. A stale409 cannot silently adopt a newer appointment version.
- Numeric timezone offsets are rejected; supported named zones and UTC remain available.
- Disabled POST responses hide booking actions just like disabled GET responses.
- Obsolete list responses cannot replace post-command facts. The reviewer marked this Minor; it was re-graded Important because incorrect visible state can mislead a later action.

Observed baseline failures: three new unit failures, four browser failures and the immutable-receipt emulator failure. After the fixes:128 security regressions, seven appointment browser cases, typecheck, lint, production build and the expanded real-emulator cases passed.

## Rulings made

1. Continue in the shared main checkout under the user's explicit direct-main checkpoint workflow. Cost if wrong: unrelated work could be published; mitigation is explicit reviewed index paths, expected remote-head checks and private-file exclusion.
2. The old prepared schema was a suggestion, not a live migration contract. Use booked/cancelled from the approved spec; rescheduling preserves the id and increments version. Cost if wrong: pre-existing appointment documents could be incompatible; scheduling stays disabled pending deployment/data reconnaissance.
3. A create retry must reach its immutable receipt even after the start time. Enforce future time for a new create inside the transaction, rather than rejecting every past create-shaped command before lookup. Cost if wrong: a new past booking could be admitted; the emulator regression proves that it is denied.
4. Deployment/index readiness and real signed-in acceptance remain release gates. No production flag, role, retention setting or data was changed. Cost if wrong: an enabled deployment might have missing indexes or untested behavior; the feature is opt-in and the prerequisites are explicit.
5. The root agent verified complete local suites/build separately from the reviewer's eight focused cases. Pending defense wording is updated from actual implementation evidence, never attributed to the original respondents. Unrelated historical clinical behavior is not certified by this review. Cost if wrong: readers could overgeneralize; dated evidence and limits remain attached.

## Deferred minor

The list starts30 days in the past. A busy clinician may need Show more before upcoming bookings appear. The current label states the window and bounded pagination is tested; an explicit upcoming-first/history view is deferred rather than silently expanding this release.

## Remaining release boundaries

Deploy the appointment indexes and client rules through the Firebase release workflow, inspect any existing appointment data, run signed-in staging acceptance with separate synthetic roles, approve appointment-contact retention and then deliberately configure `ENABLE_CONSULTATION_SCHEDULING=true` for the intended environment. Vercel frontend readiness alone does not perform these steps. Browser sizing does not establish real iPad/Safari media compatibility or clinical fitness.
