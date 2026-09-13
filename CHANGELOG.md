# Changelog

Notable changes to the secure teleconsultation prototype. Earlier history is in
the git log.

## 0.2.0 — 2026-09-13

### Fixed

- An allowlisted patient could be shown a registration form and then placed in
  the waiting room. After the form, the invite page validated the invitation a
  second time without the patient's ID token, so the server correctly treated
  the request as a guest's. This affected Google and email-and-password
  accounts alike. The page now has one validation request, which always sends
  the token. See `docs/invitation-access-model.md`.

### Changed

- **The account is the registration.** A signed-in patient is identified from
  their verified ID token and `users/{uid}`; invitation validation no longer
  looks people up by email.
- **Consent at the point of care.** The registration form is replaced by a
  one-time "Before you join" statement with a single checkbox. Agreement is
  recorded with the statement's version (`lib/consent/telehealth-consent.ts`),
  and `/api/patient/consent` refuses an out-of-date version. Existing patients
  see the new statement once.
- **Sign in from the waiting room.** The waiting room shows who the patient is
  signed in as and links to sign-in, which returns to the same invitation
  (`/patient/login?next=/invite/...`, invitation paths only).
- A clinician or staff account opening a patient link is told to use a private
  window or sign out, instead of meeting a form it could not complete.

### Removed

- `/api/user/register` and the `PatientRegistration` form.
- Phone number collection from the patient form and from the invitation API
  and screens; network/browser hashes are no longer written to profiles.

### Data

- No migration was run. Phone numbers already stored (2 profiles, 58
  invitations) and old profile hashes (4 profiles) are no longer read or
  written, and remain until an approved, backed-up cleanup.
