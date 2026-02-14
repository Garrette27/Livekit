/* eslint-disable @typescript-eslint/no-require-imports */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { logInfo, logError } = require('./structured-logger');

const AUDIT_LOG_COLLECTION = 'audit-logs';
const ADMIN_ACTIVITY_FEED_COLLECTION = 'admin-activity-feed';
const MAX_SNAPSHOT_DEPTH = 4;
const MAX_CHANGED_FIELDS = 40;
const MAX_FEED_CHANGED_FIELDS = 12;
const OMITTED_VALUE_MARKER = '[omitted]';

const SENSITIVE_KEYS = new Set([
  'token',
  'livekittoken',
  'signature',
  'authorization',
  'password',
  'secret',
  'apikey',
  'accessattempts',
]);

const COLLECTION_TRIGGER_CONFIGS = [
  { exportName: 'auditConsultationDocuments', collectionName: 'consultations' },
  { exportName: 'auditConsultationSessions', collectionName: 'consultationSessions' },
  { exportName: 'auditCallSummaries', collectionName: 'call-summaries' },
  { exportName: 'auditInvitations', collectionName: 'invitations' },
  { exportName: 'auditWaitingPatients', collectionName: 'waitingPatients' },
  { exportName: 'auditUsers', collectionName: 'users' },
];

/**
 * Return true for plain object values that can be recursively sanitized.
 */
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Convert Firestore/Date-like values into ISO strings for durable audit snapshots.
 */
function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return null;
}

/**
 * Redact or truncate deeply nested values to keep logs readable and bounded in size.
 */
function sanitizeForLog(value, depth = 0) {
  if (value == null) {
    return value;
  }

  const iso = toIsoString(value);
  if (iso) {
    return iso;
  }

  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_SNAPSHOT_DEPTH) {
      return `[array:${value.length}]`;
    }

    return value.slice(0, 50).map((item) => sanitizeForLog(item, depth + 1));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  if (depth >= MAX_SNAPSHOT_DEPTH) {
    return '[object]';
  }

  const output = {};
  const keys = Object.keys(value).slice(0, 80);
  for (const key of keys) {
    const lowered = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowered)) {
      output[key] = OMITTED_VALUE_MARKER;
      continue;
    }

    output[key] = sanitizeForLog(value[key], depth + 1);
  }

  return output;
}

/**
 * Build a bounded list of changed field paths for update events.
 */
function collectChangedFields(beforeValue, afterValue, path = '') {
  if (beforeValue === afterValue) {
    return [];
  }

  if (beforeValue == null || afterValue == null) {
    return path ? [path] : [];
  }

  const beforeIsObject = isPlainObject(beforeValue);
  const afterIsObject = isPlainObject(afterValue);
  if (beforeIsObject || afterIsObject) {
    if (!beforeIsObject || !afterIsObject) {
      return path ? [path] : [];
    }

    const keys = Array.from(new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)]));
    const changed = [];
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      changed.push(...collectChangedFields(beforeValue[key], afterValue[key], nextPath));
      if (changed.length >= MAX_CHANGED_FIELDS) {
        return changed.slice(0, MAX_CHANGED_FIELDS);
      }
    }

    return changed;
  }

  const beforeIsArray = Array.isArray(beforeValue);
  const afterIsArray = Array.isArray(afterValue);
  if (beforeIsArray || afterIsArray) {
    if (!beforeIsArray || !afterIsArray) {
      return path ? [path] : [];
    }

    return JSON.stringify(beforeValue) === JSON.stringify(afterValue) || !path ? [] : [path];
  }

  return path ? [path] : [];
}

/**
 * Return create/update/delete from Firestore before/after snapshots.
 */
function resolveOperation(change) {
  const existedBefore = change.before.exists;
  const existsAfter = change.after.exists;

  if (!existedBefore && existsAfter) {
    return 'create';
  }

  if (existedBefore && existsAfter) {
    return 'update';
  }

  return 'delete';
}

/**
 * Infer actor identity from standard ownership/metadata fields.
 */
function resolveActor(beforeData, afterData) {
  const source = afterData || beforeData || {};
  const metadata = source.metadata || {};

  const actorUserId =
    metadata.updatedBy ||
    metadata.createdBy ||
    source.updatedBy ||
    source.createdBy ||
    source.userId ||
    source.doctorUserId ||
    source.patientUserId ||
    null;

  const actorEmail =
    source.userEmail ||
    source.doctorEmail ||
    source.patientEmail ||
    metadata.userEmail ||
    metadata.doctorEmail ||
    metadata.patientEmail ||
    null;

  return {
    actorUserId: typeof actorUserId === 'string' ? actorUserId : null,
    actorEmail: typeof actorEmail === 'string' ? actorEmail : null,
  };
}

/**
 * Extract room/session/patient context shared by audit and admin feed docs.
 */
function resolveEntityContext(sourceCollection, params, beforeData, afterData) {
  const source = afterData || beforeData || {};
  const metadata = source.metadata || {};

  const consultationSessionId =
    source.consultationSessionId ||
    metadata.consultationSessionId ||
    params.consultationSessionId ||
    (sourceCollection === 'consultationSessions' ? params.documentId : null) ||
    null;

  const roomName =
    source.roomName ||
    metadata.roomName ||
    (typeof params.roomName === 'string' ? params.roomName : null) ||
    null;

  const doctorUserId =
    source.doctorUserId ||
    source.createdBy ||
    metadata.doctorUserId ||
    metadata.createdBy ||
    null;

  const patientUserId = source.patientUserId || metadata.patientUserId || null;
  const eventType = source.eventType || null;

  return {
    consultationSessionId: typeof consultationSessionId === 'string' ? consultationSessionId : null,
    roomName: typeof roomName === 'string' ? roomName : null,
    doctorUserId: typeof doctorUserId === 'string' ? doctorUserId : null,
    patientUserId: typeof patientUserId === 'string' ? patientUserId : null,
    eventType: typeof eventType === 'string' ? eventType : null,
  };
}

/**
 * Build concise display text for audit entries and admin activity feed rows.
 */
function buildSummary({
  sourceCollection,
  operation,
  documentId,
  changedFields,
  roomName,
  eventType,
}) {
  const collectionLabel = sourceCollection;
  const operationLabel =
    operation === 'create' ? 'created' : operation === 'delete' ? 'deleted' : 'updated';

  if (sourceCollection === 'consultationSessionEvents' && eventType) {
    if (roomName) {
      return `Room ${roomName}: patient ${eventType}`;
    }

    return `Consultation session event recorded: ${eventType}`;
  }

  if (operation === 'update' && changedFields.length > 0) {
    const shortFields = changedFields.slice(0, 3).join(', ');
    const suffix = changedFields.length > 3 ? '...' : '';
    return `${collectionLabel}/${documentId} updated (${shortFields}${suffix})`;
  }

  if (roomName) {
    return `Room ${roomName}: ${collectionLabel}/${documentId} ${operationLabel}`;
  }

  return `${collectionLabel}/${documentId} ${operationLabel}`;
}

/**
 * Persist one immutable audit log row and one admin feed row for each write.
 */
async function writeActivityDocuments({
  eventId,
  occurredAt,
  sourceCollection,
  sourcePath,
  documentId,
  operation,
  changedFields,
  beforeSnapshot,
  afterSnapshot,
  actorUserId,
  actorEmail,
  roomName,
  consultationSessionId,
  doctorUserId,
  patientUserId,
  eventType,
  summary,
}) {
  try {
    const db = admin.firestore();

    const auditRef = db.collection(AUDIT_LOG_COLLECTION).doc(eventId);
    const adminFeedRef = db.collection(ADMIN_ACTIVITY_FEED_COLLECTION).doc(eventId);

    const auditPayload = {
      schemaVersion: 1,
      eventId,
      operation,
      sourceCollection,
      sourcePath,
      sourceDocumentId: documentId,
      roomName: roomName || null,
      consultationSessionId: consultationSessionId || null,
      doctorUserId: doctorUserId || null,
      patientUserId: patientUserId || null,
      actorUserId: actorUserId || null,
      actorEmail: actorEmail || null,
      userId: actorUserId || patientUserId || doctorUserId || null,
      eventType: eventType || null,
      summary,
      changedFields,
      before: beforeSnapshot,
      after: afterSnapshot,
      occurredAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'cloud-function:onWrite',
    };

    const adminFeedPayload = {
      schemaVersion: 1,
      eventId,
      operation,
      sourceCollection,
      sourcePath,
      sourceDocumentId: documentId,
      roomName: roomName || null,
      consultationSessionId: consultationSessionId || null,
      doctorUserId: doctorUserId || null,
      patientUserId: patientUserId || null,
      actorUserId: actorUserId || null,
      actorEmail: actorEmail || null,
      eventType: eventType || null,
      summary,
      changedFields: changedFields.slice(0, MAX_FEED_CHANGED_FIELDS),
      occurredAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      tags: [
        sourceCollection,
        operation,
        roomName || null,
        consultationSessionId || null,
        eventType || null,
      ].filter(Boolean),
    };

    await Promise.all([auditRef.set(auditPayload), adminFeedRef.set(adminFeedPayload)]);

    logInfo({
      message: 'Audit and admin activity documents written.',
      correlation: {
        eventDomain: 'audit.activity',
        eventType: eventType || `firestore_${operation}`,
        consultationSessionId,
        roomName,
      },
      metadata: {
        sourceCollection,
        sourcePath,
        sourceDocumentId: documentId,
        operation,
        eventId,
      },
    });
  } catch (error) {
    logError({
      message: 'Failed to persist audit/admin activity documents.',
      correlation: {
        eventDomain: 'audit.activity',
        eventType: eventType || `firestore_${operation}_failed`,
        consultationSessionId,
        roomName,
      },
      metadata: {
        sourceCollection,
        sourcePath,
        sourceDocumentId: documentId,
        operation,
        eventId,
      },
      error,
    });
    throw error;
  }
}

/**
 * Create a reusable onWrite trigger for a top-level collection.
 */
function createTopLevelCollectionTrigger(collectionName) {
  return functions.firestore.document(`${collectionName}/{documentId}`).onWrite(async (change, context) => {
    try {
      const operation = resolveOperation(change);
      const beforeData = change.before.exists ? change.before.data() : null;
      const afterData = change.after.exists ? change.after.data() : null;

      const beforeSnapshot = sanitizeForLog(beforeData);
      const afterSnapshot = sanitizeForLog(afterData);
      const changedFields =
        operation === 'update'
          ? collectChangedFields(beforeSnapshot, afterSnapshot).slice(0, MAX_CHANGED_FIELDS)
          : [];

      const actor = resolveActor(beforeData, afterData);
      const entityContext = resolveEntityContext(collectionName, context.params || {}, beforeData, afterData);
      const sourcePath = `${collectionName}/${context.params.documentId}`;
      const eventId = `${collectionName}_${context.eventId}`;
      const occurredAt = context.timestamp ? new Date(context.timestamp) : new Date();
      const summary = buildSummary({
        sourceCollection: collectionName,
        operation,
        documentId: context.params.documentId,
        changedFields,
        roomName: entityContext.roomName,
        eventType: entityContext.eventType,
      });

      await writeActivityDocuments({
        eventId,
        occurredAt,
        sourceCollection: collectionName,
        sourcePath,
        documentId: context.params.documentId,
        operation,
        changedFields,
        beforeSnapshot,
        afterSnapshot,
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        roomName: entityContext.roomName,
        consultationSessionId: entityContext.consultationSessionId,
        doctorUserId: entityContext.doctorUserId,
        patientUserId: entityContext.patientUserId,
        eventType: entityContext.eventType,
        summary,
      });
    } catch (error) {
      logError({
        message: 'Top-level activity trigger failed.',
        correlation: {
          eventDomain: 'audit.activity',
          eventType: 'top_level_trigger_failed',
          roomName:
            typeof change.after.data?.()?.roomName === 'string'
              ? change.after.data().roomName
              : null,
        },
        metadata: {
          sourceCollection: collectionName,
          sourceDocumentId: context.params.documentId,
          triggerEventId: context.eventId,
        },
        error,
      });
      throw error;
    }
  });
}

/**
 * Track immutable presence timeline writes from consultationSessions/{id}/events.
 */
function createConsultationEventTrigger() {
  return functions.firestore
    .document('consultationSessions/{consultationSessionId}/events/{eventId}')
    .onWrite(async (change, context) => {
      try {
        const operation = resolveOperation(change);
        const beforeData = change.before.exists ? change.before.data() : null;
        const afterData = change.after.exists ? change.after.data() : null;

        const beforeSnapshot = sanitizeForLog(beforeData);
        const afterSnapshot = sanitizeForLog(afterData);
        const changedFields =
          operation === 'update'
            ? collectChangedFields(beforeSnapshot, afterSnapshot).slice(0, MAX_CHANGED_FIELDS)
            : [];

        const actor = resolveActor(beforeData, afterData);
        const entityContext = resolveEntityContext(
          'consultationSessionEvents',
          context.params || {},
          beforeData,
          afterData
        );
        const sourcePath = `consultationSessions/${context.params.consultationSessionId}/events/${context.params.eventId}`;
        const eventId = `consultationSessionEvents_${context.eventId}`;
        const occurredAt = context.timestamp ? new Date(context.timestamp) : new Date();
        const summary = buildSummary({
          sourceCollection: 'consultationSessionEvents',
          operation,
          documentId: context.params.eventId,
          changedFields,
          roomName: entityContext.roomName,
          eventType: entityContext.eventType,
        });

        await writeActivityDocuments({
          eventId,
          occurredAt,
          sourceCollection: 'consultationSessionEvents',
          sourcePath,
          documentId: context.params.eventId,
          operation,
          changedFields,
          beforeSnapshot,
          afterSnapshot,
          actorUserId: actor.actorUserId,
          actorEmail: actor.actorEmail,
          roomName: entityContext.roomName,
          consultationSessionId:
            entityContext.consultationSessionId || context.params.consultationSessionId || null,
          doctorUserId: entityContext.doctorUserId,
          patientUserId: entityContext.patientUserId,
          eventType: entityContext.eventType,
          summary,
        });
      } catch (error) {
        logError({
          message: 'Consultation session event trigger failed.',
          correlation: {
            eventDomain: 'audit.activity',
            eventType: 'consultation_event_trigger_failed',
            consultationSessionId: context.params.consultationSessionId || null,
          },
          metadata: {
            sourceCollection: 'consultationSessionEvents',
            sourceDocumentId: context.params.eventId,
            triggerEventId: context.eventId,
          },
          error,
        });
        throw error;
      }
    });
}

const exportedTriggers = {};
for (const config of COLLECTION_TRIGGER_CONFIGS) {
  exportedTriggers[config.exportName] = createTopLevelCollectionTrigger(config.collectionName);
}
exportedTriggers.auditConsultationSessionEvents = createConsultationEventTrigger();

module.exports = exportedTriggers;
