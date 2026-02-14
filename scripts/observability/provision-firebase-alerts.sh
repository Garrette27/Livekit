#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-${GCP_PROJECT_ID:-livekit-5eef6}}"
NOTIFICATION_CHANNELS_RAW="${NOTIFICATION_CHANNELS:-}"

if [[ -z "${NOTIFICATION_CHANNELS_RAW}" ]]; then
  echo "NOTIFICATION_CHANNELS is required (comma-separated channel IDs or full resource names)." >&2
  exit 1
fi

IFS=',' read -r -a CHANNEL_ITEMS <<< "${NOTIFICATION_CHANNELS_RAW}"
CHANNELS_JSON_ITEMS=()
for ITEM in "${CHANNEL_ITEMS[@]}"; do
  TRIMMED="$(echo "${ITEM}" | xargs)"
  if [[ -z "${TRIMMED}" ]]; then
    continue
  fi

  if [[ "${TRIMMED}" == projects/*/notificationChannels/* ]]; then
    CHANNELS_JSON_ITEMS+=("\"${TRIMMED}\"")
  else
    CHANNELS_JSON_ITEMS+=("\"projects/${PROJECT_ID}/notificationChannels/${TRIMMED}\"")
  fi
done

if [[ "${#CHANNELS_JSON_ITEMS[@]}" -eq 0 ]]; then
  echo "No valid notification channels were provided." >&2
  exit 1
fi

CHANNELS_JSON="[${CHANNELS_JSON_ITEMS[*]}]"
CHANNELS_JSON="${CHANNELS_JSON//\" \"/\",\"}"

create_or_update_metric() {
  local METRIC_NAME="$1"
  local FILTER="$2"
  local DESCRIPTION="$3"

  if gcloud logging metrics describe "${METRIC_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Updating log metric ${METRIC_NAME}"
    gcloud logging metrics update "${METRIC_NAME}" \
      --project "${PROJECT_ID}" \
      --description "${DESCRIPTION}" \
      --log-filter "${FILTER}" >/dev/null
  else
    echo "Creating log metric ${METRIC_NAME}"
    gcloud logging metrics create "${METRIC_NAME}" \
      --project "${PROJECT_ID}" \
      --description "${DESCRIPTION}" \
      --log-filter "${FILTER}" >/dev/null
  fi
}

create_or_replace_policy() {
  local DISPLAY_NAME="$1"
  local METRIC_NAME="$2"
  local CONDITION_DISPLAY="$3"

  local EXISTING_POLICY
  EXISTING_POLICY="$(gcloud monitoring policies list \
    --project "${PROJECT_ID}" \
    --filter "displayName=\"${DISPLAY_NAME}\"" \
    --format "value(name)")"

  if [[ -n "${EXISTING_POLICY}" ]]; then
    echo "Deleting existing alert policy ${DISPLAY_NAME}"
    gcloud monitoring policies delete "${EXISTING_POLICY}" \
      --project "${PROJECT_ID}" \
      --quiet >/dev/null
  fi

  local POLICY_FILE
  POLICY_FILE="$(mktemp)"
  cat > "${POLICY_FILE}" <<EOF
{
  "displayName": "${DISPLAY_NAME}",
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": ${CHANNELS_JSON},
  "alertStrategy": {
    "autoClose": "1800s"
  },
  "conditions": [
    {
      "displayName": "${CONDITION_DISPLAY}",
      "conditionThreshold": {
        "filter": "metric.type=\\"logging.googleapis.com/user/${METRIC_NAME}\\" resource.type=\\"global\\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "trigger": {
          "count": 1
        },
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ]
}
EOF

  echo "Creating alert policy ${DISPLAY_NAME}"
  gcloud monitoring policies create \
    --project "${PROJECT_ID}" \
    --policy-from-file "${POLICY_FILE}" >/dev/null

  rm -f "${POLICY_FILE}"
}

CRITICAL_ERRORS_FILTER='(resource.type="cloud_function" OR resource.type="cloud_run_revision") AND severity>=ERROR'
INVITATION_ERRORS_FILTER='(resource.type="cloud_function" OR resource.type="cloud_run_revision") AND jsonPayload.eventDomain="invitation.audit" AND severity>=ERROR'
SUMMARY_ERRORS_FILTER='(resource.type="cloud_function" OR resource.type="cloud_run_revision") AND jsonPayload.eventDomain="history.summary" AND severity>=ERROR'

create_or_update_metric \
  "livekit_functions_critical_errors" \
  "${CRITICAL_ERRORS_FILTER}" \
  "Critical errors from Firebase Functions and Cloud Run backed Functions."

create_or_update_metric \
  "livekit_invitation_validation_errors" \
  "${INVITATION_ERRORS_FILTER}" \
  "Invitation validation related function errors."

create_or_update_metric \
  "livekit_summary_generation_errors" \
  "${SUMMARY_ERRORS_FILTER}" \
  "Summary generation related function errors."

create_or_replace_policy \
  "Livekit Functions Critical Errors" \
  "livekit_functions_critical_errors" \
  "Critical Firebase Function errors > 0 in 5m"

create_or_replace_policy \
  "Livekit Invitation Validation Errors" \
  "livekit_invitation_validation_errors" \
  "Invitation validation errors > 0 in 5m"

create_or_replace_policy \
  "Livekit Summary Generation Errors" \
  "livekit_summary_generation_errors" \
  "Summary generation errors > 0 in 5m"

echo "Firebase observability metrics and alert policies configured for project ${PROJECT_ID}."
