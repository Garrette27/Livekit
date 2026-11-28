# Vercel agent setup verification

19 November 2026. Followed the official https://vercel.com/get-started.md playbook.

| Setup item | Verified result |
| --- | --- |
| CLI | Global Vercel CLI 66.2.0 installed in the active Node 22.22.2 user installation |
| CLI identity | vercel whoami succeeds as garrette27 |
| Guidance | Existing user-wide Vercel plugin enabled; standalone duplicate skills were not installed |
| Shared MCP | Global server vercel added with URL https://mcp.vercel.com; OAuth completed successfully |
| MCP config | C:/Users/Gar/.codex/config.toml; unrelated settings preserved |
| MCP status | codex mcp list reports enabled and OAuth authentication |
| CLI team access | garrette27s-projects is returned by authenticated team listing |
| Existing application | Project livekit-frontend inspected; Next.js, project root is repository root |
| Active deployment | dpl_4u7etjZyfQijywJD79wm8r9HciuE, READY, production alias livekit-frontend-tau.vercel.app, commit 0be0898 |

The older in-chat Vercel app connection returned no teams and denied the owner's team. Owner CLI access and the new shared MCP entry are separate verified states. Documentation search through the available app tools worked. This chat has not yet loaded/called the new shared MCP server's list_teams tool; verify that read after the client refreshes its MCP tools or starts a new session. No application or Firebase redeployment was performed, no new Vercel project was created, and no environment secrets were pulled.

The CLI global executable is in /home/ret/.nvm/versions/node/v22.22.2/bin/vercel. Shells must load the existing nvm configuration, or select Node 22, to put that installation on PATH. No shell initialization settings were changed.

The repository was not linked during global setup. Explicit project and team selectors were sufficient for the requested reads. Keep production releases, access changes and secret changes subject to deliberate review. This setup does not close the open security finding in the companion verification report.
