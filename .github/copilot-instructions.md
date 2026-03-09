<!-- .github/copilot-instructions.md -->
# Copilot / AI agent instructions — LiveKit telehealth app

Purpose: give an AI coding agent the minimal, actionable context to be productive in this repo.

- **Big picture:** This is a Next.js (app router) TypeScript frontend that integrates with LiveKit for video, Firebase for auth / Firestore, and OpenAI for post-call summarization. Server work runs as Next API routes in `app/api/` and as Firebase Cloud Functions in `functions/`.

- **Where behavior lives:**
  - Webhooks & AI summarization: [app/api/webhook/route.ts](app/api/webhook/route.ts#L1) (primary AI summarization flow).
  - Scheduled deletion + LiveKit token endpoints: [functions/index.js](functions/index.js#L1).
  - Firebase admin helper: [lib/firebase-admin.ts](lib/firebase-admin.ts#L1).

- **Key dev workflows / commands:**
  - Local dev: `npm install` then `npm run dev` (root). See `package.json` scripts.
  - Firebase functions: `cd functions && npm install` then `firebase deploy --only functions`.
  - Build: `npm run build` and `npm start` for production preview.

- **Important environment variables (set in `.env.local` / Vercel):**
  - `OPENAI_API_KEY` — required for AI summarization (fallback behavior exists if missing).
  - `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WEBHOOK_SECRET` — LiveKit integration and webhook verification.
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — used by `lib/firebase-admin.ts`. Note: code expects escaped `\n` newlines in `FIREBASE_PRIVATE_KEY` and will normalize them.

- **Project-specific patterns & gotchas to follow:**
  - Next app-router + API routes: server code should go under `app/api/<route>/route.ts` and use Next Response / Request (see webhook). Avoid mixing pages/api with app/api.
  - Webhook verification: `app/api/webhook/route.ts` performs HMAC sha256 verification using header `x-livekit-signature` and env `LIVEKIT_WEBHOOK_SECRET`. Preserve timing-safe comparison logic when modifying.
  - Idempotency: webhook checks `call-summaries` doc for existing summary before generating a new one — keep this behavior to avoid duplicates.
  - Firebase admin init: `lib/firebase-admin.ts` returns undefined when envs missing; code often checks for db presence before proceeding — respect that pattern (use defensive checks, do not assume admin is always initialized).
  - Rate-limiting: middleware helper `lib/rate-limit.ts` is used by webhook routes (see `withRateLimit`). Reuse it for public endpoints.

- **AI / OpenAI specifics:**
  - Model used in code: `gpt-4o-mini` (see `functions/index.js` and webhook prompt). Keep prompts structured and concise, follow existing prompt style in `app/api/webhook/route.ts`.
  - Fallback behavior: If `OPENAI_API_KEY` is not set, the webhook returns a non-AI fallback summary. Tests and feature work should respect that branch.

- **LiveKit specifics:**
  - Client libs: `@livekit/components-react`, `livekit-client`. Server token generation occurs in `functions/index.js` using `livekit-server-sdk` and `AccessToken`.
  - Token endpoints may be serverless (functions or API routes). Update both places if changing token generation.

- **Data flows to preserve:**
  1. LiveKit emits webhook -> `app/api/webhook/route.ts` verifies signature -> fetch call/transcript from Firestore -> generate AI summary -> write `call-summaries` and `scheduled-deletions`.
  2. `functions.autoDeleteSummaries` runs daily to clean up `call-summaries` older than 30 days.

- **Where to add features / tests:**
  - API surface: add new server routes to `app/api/<feature>/route.ts`.
  - UI pages: add under `app/` (app-router structure). Follow existing component patterns in `components/` and `app/*` directories.

- **Quick examples:**
  - Add a server-only helper: place it in `lib/` and import from `app/api/...` to keep code sharable with Cloud Functions.
  - To inspect webhook behavior locally, run dev server and POST a signed payload to `http://localhost:3000/api/webhook` with header `x-livekit-signature`.

If anything above is unclear or you want me to expand specific sections (CI, testing, or where to add unit tests), tell me which area to iterate on.
