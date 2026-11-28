# Vercel agent setup verification — 28 November 2026

Followed the official [Vercel agent setup guide](https://vercel.com/get-started.md),
using the existing Vercel plugin guidance rather than installing a duplicate
standalone skill pack. This is an environment check, not an application release.

| Item | Freshly verified result |
| --- | --- |
| Global CLI | Updated the existing Node 22 installation to Vercel CLI **68.0.0** |
| CLI identity | `vercel whoami` succeeds as `garrette27` |
| Project | `garrette27s-projects/livekit-frontend`; Next.js, repository root, Node 22 |
| Git connection | `Garrette27/Livekit`, production branch `main`; owner GitHub CLI access also verified |
| Guidance | Existing user-wide Vercel plugin and skills available in this chat |
| Shared MCP | Added `vercel` at exactly `https://mcp.vercel.com` to `/home/ret/.codex/config.toml`; unrelated settings preserved |
| MCP authorization | User completed browser OAuth; `codex mcp list --json` reports enabled and `o_auth` |
| MCP functional check | Fresh ephemeral read-only Codex session successfully called `search_vercel_documentation` and `list_teams`; team listing returned **zero teams** |
| Existing production | `dpl_6CzuwRcwweLq4VUZsGwnE8qUCUqP`, Ready; alias `livekit-frontend-tau.vercel.app` |

The global executable is
`/home/ret/.nvm/versions/node/v22.22.2/bin/vercel`. Noninteractive shells in
this environment do not initially load nvm; the checks explicitly selected
that Node installation on `PATH`. Shell startup files were not changed.

The in-chat Vercel connector cannot inspect the owner's project: an explicit
owner-team request returned 403, and its suggested team-authorization request
returned 404. The fresh shared MCP connection authenticated and performed the
two setup checks, but returned no teams, so owner-project access through MCP
is **not asserted**. The authenticated owner CLI remains the verified path for
project operations. Do not substitute a different connector's team or silently
change project ownership. No further authentication is needed for the verified
CLI operations.

No new Vercel project was created or linked locally; explicit project and scope
selectors were sufficient. No deployment, environment-secret pull/change,
production role change, Firebase migration, rule/index deployment, feature
enablement or billing change was performed. The production deployment above
predates this working tree's device-menu and login changes.

Firebase's connected environment is authenticated to `livekit-5eef6` and
reports billing disabled. A purpose-limited, read-only metadata projection
audit is recorded in
[production-metadata-audit.json](evidence/2026-11-28-device-login/production-metadata-audit.json).
It contains aggregates only, with no account identifiers or clinical content.
