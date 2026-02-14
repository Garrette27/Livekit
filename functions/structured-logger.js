/* eslint-disable @typescript-eslint/no-require-imports */
const logger = require('firebase-functions/logger');

const DEFAULT_EVENT_DOMAIN = 'system.observability';
const DEFAULT_EVENT_TYPE = 'unspecified';

/**
 * Normalize optional correlation fields into nullable strings.
 */
function normalizeCorrelationValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Keep correlation keys stable across all function logs.
 */
function buildCorrelation(correlation = {}) {
  return {
    eventDomain:
      normalizeCorrelationValue(correlation.eventDomain) || DEFAULT_EVENT_DOMAIN,
    eventType:
      normalizeCorrelationValue(correlation.eventType) || DEFAULT_EVENT_TYPE,
    consultationSessionId: normalizeCorrelationValue(
      correlation.consultationSessionId
    ),
    roomName: normalizeCorrelationValue(correlation.roomName),
    invitationId: normalizeCorrelationValue(correlation.invitationId),
  };
}

function safeErrorMessage(error) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function safeErrorStack(error) {
  if (!(error instanceof Error) || !error.stack) {
    return null;
  }

  return error.stack.split('\n').slice(0, 8).join('\n');
}

function buildPayload({ correlation, metadata, error }) {
  return {
    ...buildCorrelation(correlation),
    ...(metadata || {}),
    ...(error
      ? {
          errorMessage: safeErrorMessage(error),
          errorStack: safeErrorStack(error),
        }
      : {}),
  };
}

function logInfo({ message, correlation = {}, metadata = {} }) {
  logger.info(message, buildPayload({ correlation, metadata }));
}

function logWarn({ message, correlation = {}, metadata = {}, error = null }) {
  logger.warn(
    message,
    buildPayload({
      correlation,
      metadata,
      error,
    })
  );
}

function logError({ message, correlation = {}, metadata = {}, error = null }) {
  logger.error(
    message,
    buildPayload({
      correlation,
      metadata,
      error,
    })
  );
}

module.exports = {
  buildCorrelation,
  logInfo,
  logWarn,
  logError,
};
