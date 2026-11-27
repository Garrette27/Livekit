'use client';

import React from 'react';

/**
 * Skeleton placeholder shown while a page waits on work the user cannot see
 * (Firebase restoring a session, the server issuing a room credential, a
 * post-sign-in access check). It mirrors the layout that is about to appear,
 * so the wait reads as progress instead of a frozen or wrong screen, and it
 * announces `message` once through a polite live region for screen readers.
 *
 * `layout="call"` sketches the consultation room (side panel, video stage,
 * control bar); `layout="card"` sketches a centred sign-in/status card.
 */
export default function PageSkeleton({
  message,
  detail,
  layout = 'card',
}: {
  message: string;
  detail?: string;
  layout?: 'call' | 'card';
}) {
  const status = (
    <div role="status" aria-live="polite" style={{ textAlign: 'center' }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: '1.05rem', color: layout === 'call' ? '#e2e8f0' : '#1e3a8a' }}>
        {message}
      </p>
      {detail ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: layout === 'call' ? '#94a3b8' : '#64748b' }}>
          {detail}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      {layout === 'call' ? (
        <div style={{ display: 'flex', height: '100dvh', width: '100%', background: '#0f172a', overflow: 'hidden' }}>
          <aside className="tc-skeleton-panel" style={{ width: 'min(300px, 30vw)', padding: '1rem', borderRight: '1px solid #1e293b' }}>
            <div className="tc-bone" style={{ height: '1.5rem', width: '60%', marginBottom: '1rem' }} />
            <div className="tc-bone" style={{ height: '4.5rem', marginBottom: '0.75rem' }} />
            <div className="tc-bone" style={{ height: '4.5rem', marginBottom: '0.75rem' }} />
            <div className="tc-bone" style={{ height: '2.25rem', width: '70%' }} />
          </aside>
          <section style={{ flex: 1, display: 'grid', gridTemplateRows: '1fr auto', padding: '1rem', gap: '1rem', minWidth: 0 }}>
            <div className="tc-bone" style={{ borderRadius: '1rem', display: 'grid', placeItems: 'center' }}>{status}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="tc-bone" style={{ width: '6.5rem', height: '2.5rem', borderRadius: '0.75rem' }} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f0f9ff', padding: '1rem' }}>
          <div style={{ width: 'min(100%, 28rem)', background: '#fff', borderRadius: '1rem', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)' }}>
            <div className="tc-bone tc-bone-light" style={{ width: '4rem', height: '4rem', borderRadius: '50%', margin: '0 auto 1.5rem' }} />
            <div style={{ marginBottom: '1.5rem' }}>{status}</div>
            <div className="tc-bone tc-bone-light" style={{ height: '2.75rem', marginBottom: '0.75rem' }} />
            <div className="tc-bone tc-bone-light" style={{ height: '2.75rem', width: '75%', margin: '0 auto' }} />
          </div>
        </div>
      )}
      <style jsx global>{`
        .tc-bone {
          background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
          background-size: 200% 100%;
          border-radius: 0.5rem;
          animation: tc-shimmer 1.4s ease-in-out infinite;
        }
        .tc-bone-light {
          background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
          background-size: 200% 100%;
        }
        @keyframes tc-shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @media (max-width: 768px) {
          .tc-skeleton-panel { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-bone { animation: none; }
        }
      `}</style>
    </>
  );
}
