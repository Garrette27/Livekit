'use client';

import { useMaybeLayoutContext } from '@livekit/components-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseRoomChatControllerArgs {
  enabled: boolean;
  defaultOpen?: boolean;
}

export interface RoomChatController {
  enabled: boolean;
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export function useRoomChatController({
  enabled,
  defaultOpen = false,
}: UseRoomChatControllerArgs): RoomChatController {
  const layoutContext = useMaybeLayoutContext();
  const dispatch = layoutContext?.widget.dispatch;
  const layoutIsOpen = Boolean(layoutContext?.widget.state?.showChat);

  const [fallbackIsOpen, setFallbackIsOpen] = useState(false);
  const defaultAppliedRef = useRef(false);

  const open = useCallback(() => {
    if (!enabled) {
      return;
    }

    if (dispatch) {
      dispatch({ msg: 'show_chat' });
      return;
    }

    setFallbackIsOpen(true);
  }, [dispatch, enabled]);

  const close = useCallback(() => {
    if (dispatch) {
      dispatch({ msg: 'hide_chat' });
    }

    setFallbackIsOpen(false);
  }, [dispatch]);

  const toggle = useCallback(() => {
    if (!enabled) {
      return;
    }

    if (dispatch) {
      dispatch({ msg: 'toggle_chat' });
      return;
    }

    setFallbackIsOpen((previous) => !previous);
  }, [dispatch, enabled]);

  useEffect(() => {
    if (!enabled) {
      defaultAppliedRef.current = false;
      close();
      return;
    }

    if (defaultAppliedRef.current) {
      return;
    }

    defaultAppliedRef.current = true;
    if (defaultOpen) {
      open();
    }
  }, [close, defaultOpen, enabled, open]);

  const isOpen = enabled && (layoutContext ? layoutIsOpen : fallbackIsOpen);

  return useMemo(
    () => ({
      enabled,
      isOpen,
      toggle,
      close,
    }),
    [close, enabled, isOpen, toggle]
  );
}
