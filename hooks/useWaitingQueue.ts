'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WaitingPatient } from '@/lib/types';
import {
  admitWaitingPatient,
  listWaitingPatients,
  rejectWaitingPatient,
} from '@/lib/waiting-room/waiting-queue-client';

interface UseWaitingQueueOptions {
  roomName?: string;
  doctorUserId?: string;
  invitationIds?: string[];
  selectedInvitationId?: string | null;
  autoRefresh?: boolean;
  pollIntervalMs?: number;
}

interface WaitingQueueCounts {
  [invitationId: string]: number;
}

interface UseWaitingQueueResult {
  waitingPatients: WaitingPatient[];
  waitingPatientCounts: WaitingQueueCounts;
  loading: boolean;
  error: string | null;
  admittingId: string | null;
  rejectingId: string | null;
  lastUpdatedAtMs: number | null;
  refresh: (showLoading?: boolean) => Promise<void>;
  admitPatient: (waitingPatientId: string, roomNameOverride?: string) => Promise<boolean>;
  rejectPatient: (waitingPatientId: string) => Promise<boolean>;
}

function shouldIncludeInvitation(invitationIds: Set<string> | null, invitationId?: string): boolean {
  if (!invitationIds) {
    return true;
  }

  if (!invitationId) {
    return false;
  }

  return invitationIds.has(invitationId);
}

function countWaitingPatientsByInvitation(waitingPatients: WaitingPatient[]): WaitingQueueCounts {
  return waitingPatients.reduce<WaitingQueueCounts>((counts, waitingPatient) => {
    if (waitingPatient.status !== 'waiting' || !waitingPatient.invitationId) {
      return counts;
    }

    counts[waitingPatient.invitationId] = (counts[waitingPatient.invitationId] || 0) + 1;
    return counts;
  }, {});
}

export function useWaitingQueue({
  roomName,
  doctorUserId,
  invitationIds,
  selectedInvitationId = null,
  autoRefresh = true,
  pollIntervalMs = 15_000,
}: UseWaitingQueueOptions): UseWaitingQueueResult {
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [waitingPatientCounts, setWaitingPatientCounts] = useState<WaitingQueueCounts>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admittingId, setAdmittingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [lastUpdatedAtMs, setLastUpdatedAtMs] = useState<number | null>(null);
  const isFetchingRef = useRef(false);

  const invitationIdsSet = useMemo(() => {
    if (!invitationIds || invitationIds.length === 0) {
      return null;
    }
    return new Set(invitationIds);
  }, [invitationIds]);

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
        const result = await listWaitingPatients({ roomName, doctorUserId });
        if (!result.success) {
          setWaitingPatients([]);
          setWaitingPatientCounts({});
          setError(result.error || 'Failed to load waiting queue');
          return;
        }

        const scopedPatients = (result.waitingPatients || []).filter((waitingPatient) =>
          shouldIncludeInvitation(invitationIdsSet, waitingPatient.invitationId)
        );

        const counts = countWaitingPatientsByInvitation(scopedPatients);
        const visiblePatients = selectedInvitationId
          ? scopedPatients.filter((waitingPatient) => waitingPatient.invitationId === selectedInvitationId)
          : scopedPatients;

        setWaitingPatientCounts(counts);
        setWaitingPatients(visiblePatients);
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
    [doctorUserId, invitationIdsSet, roomName, selectedInvitationId]
  );

  const admitPatient = useCallback(
    async (waitingPatientId: string, roomNameOverride?: string) => {
      const targetRoomName = roomNameOverride || roomName;
      if (!targetRoomName) {
        setError('Missing room name for admission');
        return false;
      }

      setAdmittingId(waitingPatientId);
      setError(null);

      try {
        const result = await admitWaitingPatient(waitingPatientId, targetRoomName);
        if (!result.success) {
          setError(result.error || 'Failed to admit patient');
          return false;
        }

        await refresh(false);
        return true;
      } catch (admitError) {
        console.error('Failed to admit waiting patient:', admitError);
        setError('Failed to admit patient');
        return false;
      } finally {
        setAdmittingId(null);
      }
    },
    [refresh, roomName]
  );

  const rejectPatient = useCallback(
    async (waitingPatientId: string) => {
      setRejectingId(waitingPatientId);
      setError(null);

      try {
        const result = await rejectWaitingPatient(waitingPatientId);
        if (!result.success) {
          setError(result.error || 'Failed to remove patient');
          return false;
        }

        await refresh(false);
        return true;
      } catch (rejectError) {
        console.error('Failed to reject waiting patient:', rejectError);
        setError('Failed to remove patient');
        return false;
      } finally {
        setRejectingId(null);
      }
    },
    [refresh]
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
      waitingPatientCounts,
      loading,
      error,
      admittingId,
      rejectingId,
      lastUpdatedAtMs,
      refresh,
      admitPatient,
      rejectPatient,
    }),
    [
      waitingPatients,
      waitingPatientCounts,
      loading,
      error,
      admittingId,
      rejectingId,
      lastUpdatedAtMs,
      refresh,
      admitPatient,
      rejectPatient,
    ]
  );
}
