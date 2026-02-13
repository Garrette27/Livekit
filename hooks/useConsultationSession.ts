'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setSessionError,
  setSessionLoading,
  setSessionReady,
} from '@/store/slices/session-runtime-slice';

interface ConsultationSessionApiResponse {
  success: boolean;
  session?: {
    consultationSessionId?: string;
    status?: string;
  } | null;
  error?: string;
}

interface UseConsultationSessionOptions {
  roomName?: string;
  doctorUserId?: string;
  patientUserId?: string;
  autoRefresh?: boolean;
  pollIntervalMs?: number;
}

interface UseConsultationSessionResult {
  consultationSessionId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function buildSessionQuery({
  roomName,
  doctorUserId,
  patientUserId,
}: UseConsultationSessionOptions): string | null {
  if (!roomName) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('roomName', roomName);

  if (doctorUserId) {
    params.set('doctorUserId', doctorUserId);
  }
  if (patientUserId) {
    params.set('patientUserId', patientUserId);
  }

  return params.toString();
}

export function useConsultationSession({
  roomName,
  doctorUserId,
  patientUserId,
  autoRefresh = true,
  pollIntervalMs = 10_000,
}: UseConsultationSessionOptions): UseConsultationSessionResult {
  const dispatch = useAppDispatch();
  const runtimeEntry = useAppSelector((state) =>
    roomName ? state.sessionRuntime.byRoomName[roomName] : undefined
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const query = buildSessionQuery({ roomName, doctorUserId, patientUserId });
    if (!query || !roomName) {
      return;
    }

    dispatch(setSessionLoading({ roomName }));
    setLocalError(null);

    try {
      const response = await fetch(`/api/consultation-session/current?${query}`);
      const result = (await response.json()) as ConsultationSessionApiResponse;

      if (!response.ok || !result.success) {
        const errorMessage = result.error || 'Failed to fetch consultation session';
        dispatch(setSessionError({ roomName, error: errorMessage }));
        setLocalError(errorMessage);
        return;
      }

      dispatch(
        setSessionReady({
          roomName,
          consultationSessionId: result.session?.consultationSessionId || null,
        })
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch consultation session';
      dispatch(setSessionError({ roomName, error: errorMessage }));
      setLocalError(errorMessage);
    }
  }, [dispatch, doctorUserId, patientUserId, roomName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || !roomName) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, pollIntervalMs, refresh, roomName]);

  return useMemo(
    () => ({
      consultationSessionId: runtimeEntry?.consultationSessionId || null,
      loading: runtimeEntry?.status === 'loading',
      error: runtimeEntry?.error || localError,
      refresh,
    }),
    [localError, refresh, runtimeEntry]
  );
}
