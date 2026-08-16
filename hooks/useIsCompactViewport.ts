'use client';

import { useEffect, useState } from 'react';

/** Phones and small tablets in portrait. Matches the room's other breakpoints. */
const COMPACT_VIEWPORT_QUERY = '(max-width: 768px)';

/**
 * Whether the viewport is too narrow for side-docked panels.
 *
 * Layout on a phone is a different arrangement, not a smaller one: a panel
 * docked beside the video works on a laptop and covers it entirely on a
 * handset. Components read this to choose an arrangement rather than to scale
 * one down.
 *
 * Returns false during server rendering and the first paint, so the desktop
 * arrangement is the default and mobile is applied once the width is known.
 */
export function useIsCompactViewport(): boolean {
  const [isCompact, setIsCompact] = useState(false);

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
