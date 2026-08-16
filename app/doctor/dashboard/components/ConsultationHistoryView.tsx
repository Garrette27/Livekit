'use client';

import { useMemo, useState } from 'react';
import ConsultationCard, { type ConsultationCardRecord } from './ConsultationCard';
import {
  groupByDateBucket,
  matchesSearch,
  resolveConsultationStatus,
  sortConsultationRecords,
  type ConsultationSortOrder,
  type ConsultationStatus,
} from '@/lib/consultations/history-presentation';
import { SUMMARY_RETENTION_DAYS } from '@/lib/consultations/retention-policy';

type StatusFilter = 'all' | ConsultationStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'summarized', label: 'Summarized' },
  { value: 'awaiting-summary', label: 'Awaiting summary' },
  { value: 'summary-expired', label: 'Summary expired' },
  { value: 'not-admitted', label: 'Not admitted' },
  { value: 'no-show', label: 'No-shows' },
];

interface ConsultationHistoryViewProps {
  records: ConsultationCardRecord[];
  loading: boolean;
  sortOrder: ConsultationSortOrder;
  onSortOrderChange: (order: ConsultationSortOrder) => void;
  generatingSummaryId: string | null;
  onEdit: (record: ConsultationCardRecord) => void;
  onGenerate: (record: ConsultationCardRecord) => void;
}

/**
 * Consultation history: an overview of the caseload, then the encounters
 * themselves grouped by when they happened. Search and status filters exist so
 * finding one consultation among hundreds does not mean scrolling through all
 * of them.
 */
export default function ConsultationHistoryView({
  records,
  loading,
  sortOrder,
  onSortOrderChange,
  generatingSummaryId,
  onEdit,
  onGenerate,
}: ConsultationHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => {
    const tally = { total: records.length, summarized: 0, awaiting: 0, expired: 0, notAdmitted: 0, noShow: 0 };
    for (const record of records) {
      const { status } = resolveConsultationStatus(record);
      if (status === 'summarized') tally.summarized += 1;
      else if (status === 'awaiting-summary') tally.awaiting += 1;
      else if (status === 'summary-expired') tally.expired += 1;
      else if (status === 'not-admitted') tally.notAdmitted += 1;
      else tally.noShow += 1;
    }
    return tally;
  }, [records]);

  const visibleRecords = useMemo(
    () =>
      sortConsultationRecords(
        records.filter((record) => {
          if (!matchesSearch(record, searchQuery)) {
            return false;
          }
          if (statusFilter === 'all') {
            return true;
          }
          return resolveConsultationStatus(record).status === statusFilter;
        }),
        sortOrder
      ),
    [records, searchQuery, sortOrder, statusFilter]
  );

  const groups = useMemo(
    () => groupByDateBucket(visibleRecords, (record) => record.startedAt),
    [visibleRecords]
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            border: '2px solid #dbeafe',
            borderTop: '2px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
          }}
        />
        <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading consultations…</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
        <p style={{ fontSize: '1.125rem', color: '#374151', marginBottom: '0.5rem' }}>No consultations yet</p>
        <p style={{ margin: 0 }}>
          Once you finish a video call, its summary and transcript appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'grid',
          // Tiles reflow from one row on a laptop down to two columns on a
          // phone without needing a breakpoint of their own.
          gridTemplateColumns: 'repeat(auto-fit, minmax(7.5rem, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatTile label="Consultations" value={counts.total} />
        <StatTile label="Summarized" value={counts.summarized} accent="#059669" />
        <StatTile label="Awaiting summary" value={counts.awaiting} accent="#b45309" />
        <StatTile
          label={`Summary expired (${SUMMARY_RETENTION_DAYS}d)`}
          value={counts.expired}
          accent="#6b7280"
        />
        <StatTile label="Patient not admitted" value={counts.notAdmitted} accent="#b45309" />
        <StatTile label="No-shows" value={counts.noShow} accent="#6b7280" />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by patient, room, or summary text"
          aria-label="Search consultations"
          style={{
            flex: '1 1 18rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            color: '#111827',
            backgroundColor: '#ffffff',
          }}
        />
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={isActive}
                style={{
                  padding: '0.4375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${isActive ? '#2563eb' : '#d1d5db'}`,
                  backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                  color: isActive ? '#1d4ed8' : '#4b5563',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8125rem',
            color: '#4b5563',
          }}
        >
          <span>Sort</span>
          <select
            aria-label="Sort consultations"
            value={sortOrder}
            onChange={(event) => onSortOrderChange(event.target.value as ConsultationSortOrder)}
            style={{
              padding: '0.4375rem 2rem 0.4375rem 0.75rem',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              color: '#374151',
            }}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
      </div>

      {visibleRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
          <p style={{ color: '#374151', marginBottom: '0.5rem' }}>No consultations match these filters</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            style={{
              padding: '0.4375rem 0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              color: '#374151',
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={`${group.label}-${group.records[0]?.id}`} style={{ marginBottom: '1.75rem' }}>
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '0 0 0.625rem',
              }}
            >
              {group.label}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {group.records.map((record) => (
                <ConsultationCard
                  key={record.id}
                  record={record}
                  isGenerating={generatingSummaryId === record.id}
                  onEdit={onEdit}
                  onGenerate={onGenerate}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function StatTile({ label, value, accent = '#111827' }: { label: string; value: number; accent?: string }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '0.75rem 0.875rem',
        backgroundColor: '#ffffff',
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>{label}</div>
    </div>
  );
}
