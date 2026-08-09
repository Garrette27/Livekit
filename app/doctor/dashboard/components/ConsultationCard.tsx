'use client';

import {
  formatDateTime,
  formatDuration,
  formatTimeOfDay,
  resolveAttendeeLabel,
  resolveConsultationStatus,
  resolveRiskPresentation,
} from '@/lib/consultations/history-presentation';
import { SUMMARY_RETENTION_DAYS } from '@/lib/consultations/retention-policy';

export interface ConsultationCardRecord {
  id: string;
  roomName: string;
  hasGeneratedSummary: boolean;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: string;
  category: string;
  patientEmail?: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  duration: number;
  isEdited?: boolean;
  waitingRoomHistory?: {
    totalParticipants: number;
    registeredParticipantCount: number;
    anonymousParticipantCount: number;
    participantEmails: string[];
    participants: Array<{
      waitingPatientId: string;
      displayName: string;
      patientEmail: string | null;
      isAnonymous: boolean;
      status: 'waiting' | 'admitted' | 'left' | 'rejected';
      joinedAt: string | null;
      admittedAt: string | null;
      leftAt: string | null;
      removedAt: string | null;
      waitingDurationMinutes: number | null;
    }>;
  };
  chatHistory?: {
    totalMessages: number;
    firstMessageAt: string | null;
    lastMessageAt: string | null;
    participants: string[];
    messages: Array<{
      id: string;
      senderName: string;
      senderType: 'doctor' | 'patient' | 'system';
      text: string;
      createdAt: string | null;
    }>;
  };
}

interface ConsultationCardProps {
  record: ConsultationCardRecord;
  isGenerating: boolean;
  onEdit: (record: ConsultationCardRecord) => void;
  onGenerate: (record: ConsultationCardRecord) => void;
}

const chipStyle: React.CSSProperties = {
  padding: '0.125rem 0.625rem',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const disclosureStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
  padding: '0.375rem 0',
  userSelect: 'none',
};

function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * One consultation in the history list. The summary is the payload and stays
 * visible; supporting evidence (key points, waiting room, transcript) is behind
 * disclosures so a doctor can scan many encounters without wading through the
 * detail of each.
 */
export default function ConsultationCard({ record, isGenerating, onEdit, onGenerate }: ConsultationCardProps) {
  const status = resolveConsultationStatus(record);
  const risk = status.status === 'summarized' ? resolveRiskPresentation(record.riskLevel) : null;
  // An unattended consultation has a factual record, not a clinical one, so
  // there is nothing for the doctor to edit.
  const isUnattended = status.status === 'no-show' || status.status === 'not-admitted';
  const attendee = resolveAttendeeLabel(record);
  const hasDetail =
    record.keyPoints.length > 0 ||
    record.recommendations.length > 0 ||
    record.followUpActions.length > 0;

  return (
    <article
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.625rem',
        padding: '1.125rem 1.25rem',
        backgroundColor: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#111827',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {attendee}
          </h3>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
            {formatTimeOfDay(record.startedAt)} · {formatDuration(record.duration)} · Room {record.roomName}
            {record.isEdited && <span style={{ color: '#059669' }}> · Edited</span>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          {risk && (
            <span style={{ ...chipStyle, color: risk.color, backgroundColor: risk.background }}>
              {record.riskLevel} risk
            </span>
          )}
          <span style={{ ...chipStyle, color: status.color, backgroundColor: status.background }}>
            {status.label}
          </span>
          {status.status === 'awaiting-summary' && (
            <button
              onClick={() => onGenerate(record)}
              disabled={isGenerating}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: isGenerating ? '#93c5fd' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: isGenerating ? 'wait' : 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {isGenerating ? 'Generating…' : 'Generate summary'}
            </button>
          )}
          {record.hasGeneratedSummary && !isUnattended && (
            <button
              onClick={() => onEdit(record)}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <p
        style={{
          color: record.hasGeneratedSummary ? '#374151' : '#6b7280',
          fontStyle: record.hasGeneratedSummary ? 'normal' : 'italic',
          lineHeight: 1.6,
          margin: '0.75rem 0 0',
          fontSize: '0.9375rem',
          // Caps the measure at roughly 75 characters. On a wide monitor an
          // unbounded paragraph runs the full window, and the eye loses the
          // start of the next line on every return sweep.
          maxWidth: '68ch',
        }}
      >
        {record.hasGeneratedSummary
          ? record.summary
          : status.status === 'summary-expired'
            ? `The AI summary for this consultation was permanently deleted under the ${SUMMARY_RETENTION_DAYS}-day retention policy. The consultation record itself is kept.`
            : 'No summary has been generated for this consultation yet.'}
      </p>

      {hasDetail && (
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={disclosureStyle}>Clinical detail</summary>
          <div style={{ paddingLeft: '0.25rem', paddingTop: '0.25rem' }}>
            <DetailList title="Key points" items={record.keyPoints} />
            <DetailList title="Recommendations" items={record.recommendations} />
            <DetailList title="Follow-up actions" items={record.followUpActions} />
          </div>
        </details>
      )}

      {record.waitingRoomHistory && record.waitingRoomHistory.totalParticipants > 0 && (
        <details style={{ marginTop: '0.25rem' }}>
          <summary style={disclosureStyle}>
            Waiting room ({record.waitingRoomHistory.totalParticipants} participant
            {record.waitingRoomHistory.totalParticipants === 1 ? '' : 's'})
          </summary>
          <div style={{ paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {record.waitingRoomHistory.participants.map((participant) => (
              <div
                key={participant.waitingPatientId}
                style={{
                  fontSize: '0.75rem',
                  color: '#4b5563',
                  padding: '0.5rem 0.625rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.375rem',
                }}
              >
                <span style={{ fontWeight: 600, color: '#111827' }}>
                  {participant.patientEmail || participant.displayName}
                </span>
                {' — '}
                {participant.status}
                {participant.waitingDurationMinutes !== null && participant.waitingDurationMinutes > 0 && (
                  <> after waiting {participant.waitingDurationMinutes} min</>
                )}
                <div style={{ color: '#6b7280', marginTop: '0.125rem' }}>
                  Joined {formatDateTime(parseIso(participant.joinedAt))}
                  {participant.admittedAt && <> · Admitted {formatDateTime(parseIso(participant.admittedAt))}</>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {record.chatHistory && record.chatHistory.totalMessages > 0 && (
        <details style={{ marginTop: '0.25rem' }}>
          <summary style={disclosureStyle}>
            Chat transcript ({record.chatHistory.totalMessages} message
            {record.chatHistory.totalMessages === 1 ? '' : 's'})
          </summary>
          <div
            style={{
              marginTop: '0.5rem',
              maxHeight: '16rem',
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#f9fafb',
            }}
          >
            {record.chatHistory.messages.map((message) => (
              <div key={message.id} style={{ padding: '0.375rem 0', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ margin: 0, fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600 }}>
                  {message.senderName} · {formatDateTime(parseIso(message.createdAt))}
                </p>
                <p
                  style={{
                    margin: '0.125rem 0 0',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {message.text || <em style={{ color: '#6b7280' }}>(empty message)</em>}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '0.625rem' }}>
      <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {title}
      </h4>
      <ul style={{ fontSize: '0.875rem', color: '#374151', margin: 0, paddingLeft: '1.125rem', maxWidth: '72ch' }}>
        {items.map((item, index) => (
          <li key={index} style={{ marginBottom: '0.1875rem', lineHeight: 1.5 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
