# Presentation risk register (defense day, 28 November 2026)

What could break the live demo, why (architecturally), and the proven practice that contains it. Read with the [one-day guide](one-day-defense-guide.md).

## The most important fact

**`livekit-frontend-tau.vercel.app` still runs `main` (commit `ed4f7a9`).** Everything fixed on 27 November is on PR #9 and its Vercel *preview* URLs only. Your screenshots of the old form, old header and "Low" risk are production. Pick one before tomorrow:

| Option | Do | Risk |
|---|---|---|
| **A. Demo the fixes (recommended if you test today)** | Provision the doctor (below) → open the PR #9 preview URL → run the whole demo script on it → if it passes, merge PR #9 **from GitHub as Garrette27** (Vercel warns that `drakesteritdept-sketch` is not a team member; a merge by the team owner avoids a blocked production build) | New code not yet clicked through in a browser |
| B. Demo current production | Change nothing | Shows the old UI and contains the bugs you will describe as fixed — say so honestly if asked |

Proven practice: **feature freeze + canary (preview) + one-click rollback.** If production misbehaves after merge, Vercel → Deployments → `ed4f7a9` → *Promote to Production* (instant rollback, no rebuild).

## Risk register

| # | Risk during the demo | Cause | Likelihood | Containment (pattern) |
|---|---|---|---|---|
| 1 | Doctor is refused ("not provisioned") after merge | Clinician roles now need an admin-set claim (least privilege / RBAC via identity-provider claims) | **High** if skipped | Today: `vercel env pull .env.local`, then `node --env-file=.env.local scripts/admin/provision-role.mjs audit` and `grant doctor <email> --apply`; doctor signs out/in |
| 2 | Old queue rows appear or count toward the limit | Rows created before 27 Nov were keyed by email; new rows are keyed by account | Medium | Create a **fresh invitation** for the demo (old ones are mostly expired anyway) |
| 3 | Firestore quota exhausted (seen in earlier incidents) | History now loads twice (summaries first, then chat); polling; free tier is 50,000 reads/day | Low for one demo | Don't leave many doctor tabs open overnight; one dashboard tab during the demo |
| 4 | AI summary missing | OpenAI credit/model availability; evidence gate | Medium | Expected behaviour: call still works; record says unavailable/insufficient evidence. Never fabricate |
| 5 | Patient's first device drops when they open a second tab | LiveKit replaces a duplicate identity | Medium | One device per person in the demo; explain it as designed |
| 6 | Patient who closed the tab still shows "waiting" | Departure beacon may not fire on a killed mobile browser; waiting page no longer holds a LiveKit connection | Low | Doctor removes the row; it is an operational list, not attendance |
| 7 | Camera/mic fails | Permission denied, device used by another app, venue Wi-Fi | Medium | Close Zoom/Teams; allow permissions beforehand; phone hotspot as backup; audio-only still works |
| 8 | Venue network blocks WebRTC | Corporate/school firewall | Low–Medium | Test at the venue; hotspot; screenshots/recording as backup |
| 9 | Admit button returns "started a new visit" | Visit-checked admit (expected-version pattern) | Low | Refresh the queue and admit again — this is the protection working |
| 10 | Summary editor showed "Low" for an unknown risk | Select had no Unknown option | Fixed on PR #9 | Merge, or avoid opening Edit on production |

## Where provisioning lives, and the pattern

| Who | How an account becomes that role | Code | Pattern |
|---|---|---|---|
| **Doctor / reviewer / admin** | An administrator grants a Firebase custom claim | `scripts/admin/provision-role.mjs` (grant/revoke/audit); enforced in `lib/services/shared/request-auth.ts` and `firestore.rules` (users create rule); login UI `app/doctor/login/page.tsx` | **Administrator provisioning + claims-based RBAC** (Firebase custom claims), least privilege, separation of duties: no self-service path to a privileged role |
| **Registered patient** | Signs in (Google/email) and accepts the versioned consent; profile role is always `patient` | `app/patient/login`, consent route `app/api/patient/consent/route.ts`, identity resolution in `lib/invitations/validate-service.ts` | **Self-service, just-in-time provisioning** of the lowest-privilege role |
| **Guest patient** | No account; holds an invitation (bearer capability) and waits for the doctor | `app/invite/[token]`, `lib/invitations/*` | **Capability link + human admission** (guest pattern); optional Firebase anonymous session upgradeable later |

## Chat and attachments: do nothing new for tomorrow

Chat is already server-persisted per encounter, length-bounded, retry-safe (hashed idempotency key), shown in history, and deliberately **not** fed to the AI. Attachments exist as a disabled capability (`ENABLE_FILE_ATTACHMENTS`, no UI). Shipping uploads overnight would require private storage, type/size allowlist, malware scanning, download authorization, retention and cross-session denial tests (AGENTS.md "Prepared but disabled capabilities"). Adding it the night before risks the working call and would be untested — exactly what the panel would ask about. Present it as future work.
