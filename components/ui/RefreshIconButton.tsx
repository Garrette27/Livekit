'use client';

import { useId } from 'react';

/**
 * Icon-only refresh control (the circular-arrow pattern used by browsers and
 * Material/Fluent toolbars). The visible tooltip appears on hover AND keyboard
 * focus, so the meaning is never mouse-only; `label` is also the accessible
 * name, and `hint` says what the refresh actually re-reads. While `busy`, the
 * icon spins (static under reduced motion) and the button is disabled.
 */
export default function RefreshIconButton({ label, hint, busy = false, onClick }: {
  label: string;
  hint: string;
  busy?: boolean;
  onClick: () => void;
}) {
  const tipId = useId();
  return (
    <span className="refresh-wrap">
      <button type="button" className="refresh-button" aria-label={label}
        aria-describedby={tipId} disabled={busy} aria-busy={busy} onClick={onClick}>
        <svg className={busy ? 'spin' : undefined} aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" />
        </svg>
      </button>
      <span id={tipId} className="refresh-tip" role="tooltip"><strong>{label}</strong> {hint}</span>
      <style jsx>{`
        .refresh-wrap { position: relative; display: inline-flex; }
        .refresh-button { width: 2.5rem; height: 2.5rem; padding: 0; display: inline-grid; place-items: center; border-radius: 999px; border: 1px solid #0f766e; background: #fff; color: #0f766e; cursor: pointer; }
        .refresh-button:hover:not(:disabled) { background: #f0fdfa; }
        .refresh-button:disabled { opacity: .6; cursor: progress; }
        .refresh-button:focus-visible { outline: 3px solid #14b8a6; outline-offset: 2px; }
        .refresh-tip { position: absolute; top: calc(100% + .4rem); left: 50%; transform: translateX(-50%); z-index: 20; width: max-content; max-width: 16rem; padding: .45rem .6rem; border-radius: .4rem; background: #153530; color: #fff; font-size: .75rem; font-weight: 400; line-height: 1.35; opacity: 0; pointer-events: none; transition: opacity .12s; }
        .refresh-wrap:hover .refresh-tip, .refresh-button:focus-visible + .refresh-tip { opacity: 1; }
        .spin { animation: spin .9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .spin { animation: none; } .refresh-tip { transition: none; } }
      `}</style>
    </span>
  );
}
