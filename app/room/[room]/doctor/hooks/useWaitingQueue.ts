'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdmitPatientResponse, WaitingPatient } from '@/lib/types';

interface WaitingRoomListResponse {
  success: boolean;
  waitingPatients?: WaitingPatient[];
  error?: string;
}

interface UseWaitingQueueOptions {
  roomName: string;
  doctorUserId?: string;
  autoRefresh?: boolean;
  pollIntervalMs?: number;
}

interface UseWaitingQueueResult {
  waitingPatients: WaitingPatient[];
  loading: boolean;
  error: string | null;
  admittingId: string | null;
  lastUpdatedAtMs: number | null;
  refresh: (showLoading?: boolean) => Promise<void>;
  admitPatient: (waitingPatientId: string) => Promise<boolean>;
}

function toTimestampMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof maybeTimestamp.toMillis === 'function') {
      return maybeTimestamp.toMillis();
    }
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().getTime();
    }
  }

  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  return parsed.getTime();
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response but received status ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildListQuery(roomName: string, doctorUserId?: string): string {
  const params = new URLSearchParams({ roomName });
  if (doctorUserId) {
    params.set('doctorUserId', doctorUserId);
  }
  return params.toString();
}

export function useWaitingQueue({
  roomName,
  doctorUserId,
  autoRefresh = true,
  pollIntervalMs = 15_000,
}: UseWaitingQueueOptions): UseWaitingQueueResult {
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admittingId, setAdmittingId] = useState<string | null>(null);
  const [lastUpdatedAtMs, setLastUpdatedAtMs] = useState<number | null>(null);
  const isFetchingRef = useRef(false);

  const refresh = useCallback(
    async (showLoading = false) => {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const query = buildListQuery(roomName, doctorUserId);
        const response = await fetch(`/api/waiting-room/list?${query}`);
        const result = await parseJsonResponse<WaitingRoomListResponse>(response);

        if (!result.success) {
          setWaitingPatients([]);
          setError(result.error || 'Failed to load waiting queue');
          return;
        }

        const nextPatients = [...(result.waitingPatients || [])].sort((a, b) => {
          return toTimestampMillis(a.joinedAt) - toTimestampMillis(b.joinedAt);
        });

        setWaitingPatients(nextPatients);
        setLastUpdatedAtMs(Date.now());
      } catch (fetchError) {
        console.error('Failed to fetch waiting queue:', fetchError);
        setError('Failed to load waiting queue');
      } finally {
        isFetchingRef.current = false;
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [doctorUserId, roomName]
  );

  const admitPatient = useCallback(
    async (waitingPatientId: string) => {
      setAdmittingId(waitingPatientId);
      setError(null);

      try {
        const response = await fetch('/api/waiting-room/admit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waitingPatientId, roomName }),
        });

        const result = await parseJsonResponse<AdmitPatientResponse>(response);
        if (!result.success) {
          setError(result.error || 'Failed to admit patient');
          return false;
        }

        setWaitingPatients((previous) => previous.filter((patient) => patient.id !== waitingPatientId));
        setLastUpdatedAtMs(Date.now());
        return true;
      } catch (admitError) {
        console.error('Failed to admit waiting patient:', admitError);
        setError('Failed to admit patient');
        return false;
      } finally {
        setAdmittingId(null);
      }
    },
    [roomName]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh(false);
    }, pollIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, pollIntervalMs, refresh]);

  return useMemo(
    () => ({
      waitingPatients,
      loading,
      error,
      admittingId,
      lastUpdatedAtMs,
      refresh,
      admitPatient,
    }),
    [admitPatient, admittingId, error, lastUpdatedAtMs, loading, refresh, waitingPatients]
  );
}

