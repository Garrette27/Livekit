# Current defense demonstration risks

27 November 2026, source `69f9c85`. Read the [quick answers](PANEL-QA-LATEST.md) and [appointment review and verification limits](../testing/evidence/2026-11-27-appointments/implementation-review.md). Earlier PR9-only deployment advice is superseded; the relevant main-branch changes are already merged. Check the exact deployed frontend commit before rehearsal.

| Risk | Containment and honest boundary |
| --- | --- |
| Administrator opens doctor tools | Both platform and clinic administrators are non-clinical. Use separate approved synthetic doctor and administrator identities. APIs deny combined old admin/doctor claims. |
| Frontend succeeds but Firebase differs | Vercel does not deploy Firestore Rules or Firebase Functions. Local rules passed emulator cases; production deployment must be separately verified. Environment-only bootstrap owners need approved historical-claim migration. |
| Old token retains access | Refresh grants explicitly. Existing Firebase/LiveKit credentials have separate expiry/revocation behavior; do not promise immediate universal revocation. |
| Queue demo identities collapse | Use distinct synthetic browser profiles. Shared Firebase uid is still one principal. Test a fresh invitation with waiting limit2, then raise to3. |
| Tablet panels cover video | Compact layouts use on-demand panels through1200px; desktop panels reserve space. Six Chromium viewport checks passed, not actual iPad/Safari media acceptance. |
| AI unavailable or insufficient evidence | Keep the call working. Show the real unavailable/insufficient state. Never manufacture a successful live generation. |
| Active room shows no draft | Not finalized is intentional. Summary generation requires completion plus evidence/consent gates. A reusable invitation may have several distinct encounter records. |
| Consent appears again | New entry starts unchecked. Do not carry transcription consent across a reused room name. Device preflight is intentional. |
| Older summary missing | Say unavailable unless deletion is independently confirmed. Firebase retention is opt-in; Vercel's cron retries summary work. Do not run destructive cleanup for a demo. |
| Microphone, camera or venue network fails | Run device preflight at the venue, keep audio-only and a backup network available. Use clearly labeled offline evidence if needed. |
| Panel asks about scheduling/uploads | Appointments are implemented but deployment-gated; uploads remain disabled future work. Demonstrate bookings only in an explicitly enabled synthetic environment. Neither feature was evaluated by the original survey. Production rules/indexes, data/retention review and signed-in staging acceptance remain appointment gates. |

## Release and rehearsal discipline

Freeze the source used in the demonstration. Run signed-in acceptance with synthetic accounts before presenting new role behavior as production-tested. Do not change production roles, retention settings or historical records to make the demonstration look successful. Keep a known-good deployment available, but inspect the actual target before promotion/rollback; do not blindly promote an obsolete commit.

Source scanning and regressions do not establish a bug-free app, regulatory compliance, clinical accuracy or a safe maximum number of simultaneous calls. The remaining acceptance work is in the [finding register and Claude handoff](admin-entry-findings-and-claude-handoff.md).
