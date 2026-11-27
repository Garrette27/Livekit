'use client';

import { useEffect, useState } from 'react';

/** Below this width two panels leave too little space for the consultation. */
const COMPACT_VIEWPORT_QUERY = '(max-width: 1200px)';

/**
 * Whether the viewport is too narrow for side-docked panels.
 *
 * Layout on a phone is a different arrangement, not a smaller one: a panel
 * docked beside the video works on a laptop and covers it entirely on a
 * handset. Components read this to choose an arrangement rather than to scale
 * one down.
 *
 * Starts compact until the viewport is known, so hydration never opens two
 * desktop panels over a phone's video or device preflight.
 */
export function useIsCompactViewport(): boolean {
  const [isCompact, setIsCompact] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const sync = () => setIsCompact(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  return isCompact;
}
