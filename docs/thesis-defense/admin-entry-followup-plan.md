# Administrator entry and defense alignment plan

27 November 2026. Source baseline: `eb3b187`. Continue the requested direct-main workflow; preserve unrelated AGENTS.md edits and private appendices. The manuscript remains **259 pages**, not 256; no objectives, survey results, title or expense amounts are changed.

## Design and scope

Repair the existing role system rather than invent a second login identity store. Dedicated `/admin/login` and `/admin/signup` pages use Firebase Authentication; account creation establishes identity only. A verified server access projection decides the default workspace and never grants roles. Administrators land on `/admin`; doctors retain their existing workflow. An explicit refresh picks up newly granted claims. The existing server-only bootstrap is displayed as `Super administrator / Server bootstrap`, separately from doctor provisioning. Clinic administration remains metadata-only and does not grant shared clinical-record access.

Alternatives: a public self-granted administrator signup violates least privilege; redirecting every administrator through the doctor UI repeats the reported routing failure. A dedicated entry surface using the existing identity provider and server authority is the bounded repair. Preserve object-centered navigation, responsive form reflow and inline feedback, not a decorative clickable title with an unrelated effect.

## Tasks

- [x] Write and run failing regressions for effective workspace resolution, bootstrap identity labels/protection, ordinary doctor versus admin grants and malformed/unauthorized outcomes.
- [x] Implement the access projection, dedicated identity-only administrator entry, admin-first doctor-login redirect, responsive grant form and honest account authority labels. No production role/account mutations.
- [x] Verify rendered administrator entry and synthetic role/layout states, plus full typecheck, lint, regressions and production build. Distinguish local fixtures from signed-in production acceptance.
- [ ] Rank all existing detailed panel questions by defense importance, retain every topic and an old-to-new number map; correct overstatements, add admin entry cases and a follow-up prompt for Claude.
- [ ] Rebuild the public/private 259-page manuscripts, Q&A PDF and demo-tailored editable slides with notes; inspect changed pages/slides. Update downloads, privacy-safe archive and evidence.
- [ ] Fresh review, scoped commit/push and remote CI receipt. Private copies remain local.

## Review focus

1. A typed email, route query or signup never supplies an administrator role.
2. A verified configured bootstrap identity works even without a doctor profile; unverified lookalikes do not.
3. A doctor-only grant remains doctor-only; no UI repair silently promotes a real account.
4. Clinic grant controls reflow at 320 CSS pixels and long identifiers wrap without hiding actions.
5. Q&A separates demonstrated workflow, local regression/emulator evidence, provider allowances and unmeasured media/clinical results. No claim about other theses failing without evidence.

## Progress and decisions

- Pulled and fast-forwarded main to `eb3b187`; preserved the existing modified AGENTS.md.
- Root causes: hard-coded `/doctor/login` entry and `/doctor/invitations` post-login destination; list projection conflates doctor claim provisioning with bootstrap authority; fixed grant-grid widths exceed the narrow content area.
- Screenshot evidence names a **doctor** grant, not an administrator grant. Do not infer or mutate the live account's current claims from a screenshot.
- Account signup is identity-only and explains that an authorized owner must grant privileges; it is not open administrator enrollment.
- App checkpoint: 91 local behavior/policy regressions and both source contracts pass using working source with the tracked AGENTS.md in a separate verification snapshot. The root command fails on the user's unrelated local AGENTS.md scope content; that file is preserved and excluded. Typecheck, lint, production build and 3 signed-out local browser cases pass. Source-derived form/header fixtures fit 320/700/1000px as applicable. No signed-in production acceptance or role mutation performed.
- Fresh review identified full-document header navigation, long clinic-title clipping and false missing-account labels on Auth outages; all were addressed. The Auth-outage regression was observed failing (200 instead of 503) before the correction.
