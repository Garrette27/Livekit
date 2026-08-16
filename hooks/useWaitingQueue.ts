'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WaitingPatient } from '@/lib/types';
import {
  admitWaitingPatient,
  listWaitingPatients,
  rejectWaitingPatient,
} from '@/lib/waiting-room/waiting-queue-client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setWaitingQueueSnapshot } from '@/store/slices/waiting-queue-slice';
import {
  fetchWaitingQueueOnce,
  subscribeToDoctorWaitingPatients,
  subscribeToWaitingQueuePoll,
} from '@/lib/waiting-room/waiting-queue-coordinator';

interface UseWaitingQueueOptions {
  roomName?: string;
  doctorUserId?: string;
  invitationIds?: string[];
  selectedInvitationId?: string | null;
  statuses?: Array<'waiting' | 'admitted' | 'left' | 'rejected'>;
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

const EMPTY_WAITING_PATIENTS: WaitingPatient[] = [];
const EMPTY_WAITING_COUNTS: WaitingQueueCounts = {};

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
  statuses,
  autoRefresh = true,
  pollIntervalMs = 15_000,
}: UseWaitingQueueOptions): UseWaitingQueueResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admittingId, setAdmittingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const dispatch = useAppDispatch();

  const invitationIdsSet = useMemo(() => {
    if (typeof invitationIds === 'undefined') {
      return null;
    }

    return new Set(invitationIds);
  }, [invitationIds]);

  const invitationScope = useMemo(
    () => (invitationIds ? [...invitationIds].sort().join('|') : 'all'),
    [invitationIds]
  );
  const statusScope = (
    Array.isArray(statuses) && statuses.length > 0
      ? Array.from(new Set(statuses)).sort()
      : ['waiting']
  ).join('|');
  const normalizedStatuses = useMemo(
    () => statusScope.split('|') as Array<'waiting' | 'admitted' | 'left' | 'rejected'>,
    [statusScope]
  );
  const scopeKey = useMemo(
    () =>
      `${roomName || 'all-rooms'}::${doctorUserId || 'all-doctors'}::${selectedInvitationId || 'all'}::${invitationScope}::${statusScope}`,
    [doctorUserId, invitationScope, roomName, selectedInvitationId, statusScope]
  );
  const requestKey = useMemo(
    () => `${roomName || 'all-rooms'}::${doctorUserId || 'current-doctor'}::${statusScope}::active`,
    [doctorUserId, roomName, statusScope]
  );

  const snapshot = useAppSelector((state) => state.waitingQueue.byScopeKey[scopeKey]);
  const previousScopeKeyRef = useRef(scopeKey);
  const isScopeChanged = previousScopeKeyRef.current !== scopeKey;
  const waitingPatients =
    scopeInitialized && !isScopeChanged
      ? snapshot?.waitingPatients ?? EMPTY_WAITING_PATIENTS
      : EMPTY_WAITING_PATIENTS;
  const waitingPatientCounts =
    scopeInitialized && !isScopeChanged
      ? snapshot?.waitingPatientCounts ?? EMPTY_WAITING_COUNTS
      : EMPTY_WAITING_COUNTS;
  const lastUpdatedAtMs = snapshot?.lastUpdatedAtMs || null;

  useEffect(() => {
    if (previousScopeKeyRef.current !== scopeKey) {
      previousScopeKeyRef.current = scopeKey;
      setScopeInitialized(false);
    }
  }, [scopeKey]);

  /**
   * Applies this hook's invitation and selection scoping, then stores the
   * result. Shared by the realtime stream and the polling fallback so both
   * produce identical state.
   */
  const publishPatients = useCallback(
    (incomingPatients: WaitingPatient[]) => {
      const scopedPatients = incomingPatients.filter((waitingPatient) =>
        shouldIncludeInvitation(invitationIdsSet, waitingPatient.invitationId)
      );

      const counts = countWaitingPatientsByInvitation(scopedPatients);
      const visiblePatients = selectedInvitationId
        ? scopedPatients.filter((waitingPatient) => waitingPatient.invitationId === selectedInvitationId)
        : scopedPatients;

      dispatch(
        setWaitingQueueSnapshot({
          scopeKey,
          waitingPatients: visiblePatients,
          waitingPatientCounts: counts,
          lastUpdatedAtMs: Date.now(),
        })
      );
    },
    [dispatch, invitationIdsSet, scopeKey, selectedInvitationId]
  );

  const refresh = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        if (invitationIdsSet && invitationIdsSet.size === 0) {
          dispatch(
            setWaitingQueueSnapshot({
              scopeKey,
              waitingPatients: [],
              waitingPatientCounts: {},
              lastUpdatedAtMs: Date.now(),
            })
          );
          return;
        }

        // UI selection is applied after the response. Components that ask the
        // server the same question therefore share one request even when each
        // renders a different invitation subset.
        const result = await fetchWaitingQueueOnce(requestKey, () =>
          listWaitingPatients({
            roomName,
            doctorUserId,
            statuses: normalizedStatuses,
          })
        );
        if (!result.success) {
          dispatch(
            setWaitingQueueSnapshot({
              scopeKey,
              waitingPatients: [],
              waitingPatientCounts: {},
              lastUpdatedAtMs: Date.now(),
            })
          );
          setError(result.error || 'Failed to load waiting queue');
          return;
        }

        publishPatients(result.waitingPatients || []);
      } catch (fetchError) {
        console.error('Failed to fetch waiting queue:', fetchError);
        setError('Failed to load waiting queue');
      } finally {
        setScopeInitialized(true);
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [
      dispatch,
      doctorUserId,
      invitationIdsSet,
      normalizedStatuses,
      publishPatients,
      requestKey,
      roomName,
      scopeKey,
    ]
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
        const result = await admitWaitingPatient(waitingPatientId, targetRoomName, doctorUserId);
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
    [doctorUserId, refresh, roomName]
  );

  const rejectPatient = useCallback(
    async (waitingPatientId: string) => {
      setRejectingId(waitingPatientId);
      setError(null);

      try {
        const result = await rejectWaitingPatient(waitingPatientId, doctorUserId);
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
    [doctorUserId, refresh]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  // Prefer Firestore's push stream; fall back to timed refreshes only when it
  // is unavailable, so a rules or connectivity problem degrades to the old
  // behaviour instead of leaving the doctor with an empty queue.
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!autoRefresh || !doctorUserId) {
      setIsStreaming(false);
      return;
    }

    let cancelled = false;
    const unsubscribe = subscribeToDoctorWaitingPatients({
      doctorUserId,
      onPatients: (waitingPatients) => {
        if (cancelled) {
          return;
        }
        setIsStreaming(true);
        setScopeInitialized(true);
        setLoading(false);
        publishPatients(waitingPatients.filter((patient) => normalizedStatuses.includes(patient.status)));
      },
      onUnavailable: (reason) => {
        if (cancelled) {
          return;
        }
        console.warn('Waiting queue live updates unavailable; falling back to polling.', reason);
        setIsStreaming(false);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      setIsStreaming(false);
    };
  }, [autoRefresh, doctorUserId, normalizedStatuses, publishPatients]);

  useEffect(() => {
    if (!autoRefresh || isStreaming) {
      return;
    }

    // One timer per scope regardless of how many panels are mounted.
    return subscribeToWaitingQueuePoll(requestKey, pollIntervalMs, () => {
      void refresh(false);
    });
  }, [autoRefresh, isStreaming, pollIntervalMs, refresh, requestKey]);

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
