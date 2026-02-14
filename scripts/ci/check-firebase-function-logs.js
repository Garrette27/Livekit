#!/usr/bin/env node

const { execFileSync } = require('child_process');

const REQUIRED_CORRELATION_KEYS = [
  'eventDomain',
  'eventType',
  'consultationSessionId',
  'roomName',
  'invitationId',
];

function parseIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getJsonPayload(entry) {
  if (!entry || typeof entry !== 'object') {
    return {};
  }

  if (entry.jsonPayload && typeof entry.jsonPayload === 'object') {
    return entry.jsonPayload;
  }

  return {};
}

function getCorrelation(entry) {
  const payload = getJsonPayload(entry);
  const correlation = payload.correlation && typeof payload.correlation === 'object'
    ? payload.correlation
    : {};

  return {
    eventDomain: normalizeString(payload.eventDomain) || normalizeString(correlation.eventDomain),
    eventType: normalizeString(payload.eventType) || normalizeString(correlation.eventType),
    consultationSessionId:
      normalizeString(payload.consultationSessionId) || normalizeString(correlation.consultationSessionId),
    roomName: normalizeString(payload.roomName) || normalizeString(correlation.roomName),
    invitationId: normalizeString(payload.invitationId) || normalizeString(correlation.invitationId),
  };
}

function getSeverity(entry) {
  return normalizeString(entry && entry.severity) || 'DEFAULT';
}

function getMessage(entry) {
  const payload = getJsonPayload(entry);
  if (normalizeString(payload.message)) {
    return normalizeString(payload.message);
  }
  if (normalizeString(entry.textPayload)) {
    return normalizeString(entry.textPayload);
  }
  if (normalizeString(entry.protoPayload && entry.protoPayload.status && entry.protoPayload.status.message)) {
    return normalizeString(entry.protoPayload.status.message);
  }
  return null;
}

function formatCorrelation(correlation) {
  return REQUIRED_CORRELATION_KEYS.map((key) => `${key}=${correlation[key] || 'null'}`).join(', ');
}

function readLogs({ projectId, lookbackMinutes, limit, filterOverride }) {
  const startTimestamp = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  const filter =
    filterOverride ||
    [
      '(resource.type="cloud_function" OR resource.type="cloud_run_revision")',
      `timestamp>="${startTimestamp}"`,
      'severity>=ERROR',
    ].join(' AND ');

  const args = [
    'logging',
    'read',
    filter,
    '--project',
    projectId,
    '--format',
    'json',
    '--limit',
    String(limit),
  ];

  const rawOutput = execFileSync('gcloud', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    filter,
    entries: rawOutput && rawOutput.trim() ? JSON.parse(rawOutput) : [],
  };
}

function main() {
  const projectId =
    process.env.GCP_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'livekit-5eef6';
  const lookbackMinutes = parseIntEnv('LOG_LOOKBACK_MINUTES', 30);
  const limit = parseIntEnv('LOG_READ_LIMIT', 250);
  const failThreshold = parseIntEnv('LOG_ERROR_THRESHOLD', 1);
  const warnThreshold = parseIntEnv('LOG_WARNING_THRESHOLD', 1);
  const strictCorrelation = String(process.env.LOG_STRICT_CORRELATION || 'false').toLowerCase() === 'true';
  const filterOverride = normalizeString(process.env.LOG_FILTER);

  const { filter, entries } = readLogs({
    projectId,
    lookbackMinutes,
    limit,
    filterOverride,
  });

  const enriched = entries.map((entry) => {
    const correlation = getCorrelation(entry);
    const missingCorrelationKeys = REQUIRED_CORRELATION_KEYS.filter((key) => !correlation[key]);

    return {
      severity: getSeverity(entry),
      message: getMessage(entry),
      correlation,
      missingCorrelationKeys,
      timestamp: normalizeString(entry.timestamp),
      raw: entry,
    };
  });

  const criticalEntries = enriched;
  const missingCorrelationEntries = enriched.filter((entry) => entry.missingCorrelationKeys.length > 0);

  console.log(
    `Checked ${criticalEntries.length} Firebase function error log(s) in project ${projectId} over the last ${lookbackMinutes} minute(s).`
  );
  console.log(`Log filter: ${filter}`);

  if (criticalEntries.length > 0) {
    console.log('Sample critical logs:');
    criticalEntries.slice(0, 10).forEach((entry, index) => {
      console.log(
        `[${index + 1}] severity=${entry.severity} timestamp=${entry.timestamp || 'n/a'} ${formatCorrelation(
          entry.correlation
        )} message="${entry.message || 'n/a'}"`
      );
    });
  }

  if (missingCorrelationEntries.length > 0) {
    const missingSummary = missingCorrelationEntries
      .slice(0, 10)
      .map((entry) => `${entry.missingCorrelationKeys.join('|')} @ ${entry.timestamp || 'n/a'}`)
      .join('; ');
    console.log(
      `Missing correlation keys detected in ${missingCorrelationEntries.length} log(s): ${missingSummary}`
    );
    console.log('::warning::Some Firebase function logs are missing required correlation keys.');
  }

  if (strictCorrelation && missingCorrelationEntries.length > 0) {
    console.error('::error::Strict correlation mode is enabled and missing keys were detected.');
    process.exit(1);
  }

  if (criticalEntries.length >= failThreshold) {
    console.error(
      `::error::Critical Firebase function errors (${criticalEntries.length}) exceeded fail threshold (${failThreshold}).`
    );
    process.exit(1);
  }

  if (criticalEntries.length >= warnThreshold) {
    console.log(
      `::warning::Critical Firebase function errors (${criticalEntries.length}) reached warning threshold (${warnThreshold}).`
    );
  }

  console.log('Firebase function log check completed.');
}

try {
  main();
} catch (error) {
  console.error('::error::Failed to run Firebase function log check.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
