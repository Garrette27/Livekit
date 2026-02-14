# Firebase Logs in CI/CD (Vercel + Functions)

## Goal

Use Firebase Function logs together with Vercel logs so consultation incidents can be traced end-to-end by `roomName`, `invitationId`, and `consultationSessionId`.

## Why this aligns with AGENTS.md

- Keeps observability as a deep module concern (not scattered debug prints).
- Reduces repeated incident triage complexity.
- Preserves clear module boundaries by logging domain events at module edges.

## Options

1. `Cloud Logging as source of truth` (recommended)
- Emit structured logs from Functions with stable keys: `eventDomain`, `eventType`, `consultationSessionId`, `roomName`, `invitationId`, `actorType`, `actorId`.
- Create log-based metrics and alert policies in Google Cloud.
- Keep Vercel logs for Next.js edge/API runtime only.

2. `CI pull of Firebase logs after deploy`
- In GitHub Actions, run `firebase deploy` then `gcloud logging read` for the last N minutes.
- Fail or warn pipeline when high-severity log patterns appear.
- Good for smoke verification after deployment.

3. `Log sink to BigQuery`
- Create a Cloud Logging sink for `resource.type="cloud_function"`.
- Run SQL for incident forensics and trend analysis.
- Best for audit history and long-term analytics.

4. `Log sink to Pub/Sub -> external SIEM`
- Forward logs to Datadog/Elastic/Splunk.
- Best when team already uses centralized observability tooling.

## Minimal implementation plan

1. Standardize structured logs in Functions
- Replace free-form `console.log` with structured payloads.
- Include IDs (`consultationSessionId`, `roomName`, `invitationId`) in every log.

2. Add post-deploy CI log check
- Add workflow step:
```bash
# Example
 gcloud logging read \
  'resource.type="cloud_function" AND severity>=ERROR AND timestamp>="'$START_TS'"' \
  --project "$GCP_PROJECT" \
  --format json
```
- Parse output and mark build unstable/failed based on rules.

3. Add alerting
- Create log-based metric for critical failures (`/api/webhook`, summary generation, invitation validation failures).
- Configure email/Slack alerting.

## Correlation contract

Adopt the same correlation keys in Vercel API logs and Firebase Function logs:

- `eventDomain`
- `eventType`
- `eventVersion`
- `consultationSessionId`
- `roomName`
- `invitationId`
- `requestId`

This lets one incident be traced across invitation, waiting room, session lifecycle, and summary projection.

## Repository Implementation

Implemented artifacts:

- Structured logging utility for Firebase Functions:
  - `functions/structured-logger.js`
- Functions updated to emit structured logs:
  - `functions/index.js`
  - `functions/activity-log-pipeline.js`
- Post-deploy log check script:
  - `scripts/ci/check-firebase-function-logs.js`
- Alert policy + log metric provisioning script:
  - `scripts/observability/provision-firebase-alerts.sh`
- GitHub Actions workflows:
  - `/.github/workflows/firebase-functions-deploy.yml`
  - `/.github/workflows/firebase-observability-bootstrap.yml`

## Required GitHub Secrets

- `GCP_PROJECT_ID`: Google Cloud project id.
- `GCP_SA_KEY`: Service account JSON key with permissions for:
  - Firebase Functions deploy
  - Cloud Logging read
  - Cloud Monitoring policy create/update
  - Logging metric create/update

## How To Run

1. Deploy functions + run post-deploy log check
- Trigger workflow: `Firebase Functions Deploy`
- Optional inputs:
  - `log_lookback_minutes`
  - `log_error_threshold`
  - `log_warning_threshold`

2. Provision log metrics + alert policies
- Trigger workflow: `Firebase Observability Bootstrap`
- Input:
  - `notification_channels`
  - Example: `1234567890123456789,projects/livekit-5eef6/notificationChannels/987654321`

## Correlation Contract (enforced in function logs)

Each structured log includes these keys (nullable when unknown):

- `eventDomain`
- `eventType`
- `consultationSessionId`
- `roomName`
- `invitationId`
