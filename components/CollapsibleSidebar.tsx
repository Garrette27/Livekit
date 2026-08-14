'use client';

import React, { useEffect, useState } from 'react';
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport';

const SIDEBAR_Z_INDEX = 10020;

interface CollapsibleSidebarProps {
  children: React.ReactNode;
  title: string;
  icon: string;
  position: 'left' | 'right';
  defaultCollapsed?: boolean;
  width?: number;
  collapsedWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A room side panel that changes arrangement with the viewport.
 *
 * On a laptop it docks beside the video and collapses to a rail. On a phone
 * that arrangement fails outright — a 350px panel covers a 375px screen, and
 * two of them leave no video at all — so it becomes a bottom sheet instead:
 * closed by default, opened from a labelled button, and dismissed by the close
 * control or by tapping the video behind it. That is the arrangement video
 * products converge on for handsets, and it keeps the call itself primary.
 */
export default function CollapsibleSidebar({
  children,
  title,
  icon,
  position,
  defaultCollapsed = false,
  width = 350,
  collapsedWidth = 60,
  className = '',
  style = {}
}: CollapsibleSidebarProps) {
  const isCompact = useIsCompactViewport();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // A sheet covering the video is never the right thing to restore on rotation
  // or when a phone becomes the active layout, so entering compact mode closes
  // it and hands the screen back to the call.
  useEffect(() => {
    if (isCompact) {
      setIsCollapsed(true);
    }
  }, [isCompact]);

  const accentColor = position === 'left' ? '#059669' : '#3b82f6';

  const headerStyle: React.CSSProperties = {
    backgroundColor: accentColor,
    color: 'white',
    padding: '0.875rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    userSelect: 'none',
    minHeight: '3.25rem',
  };

  const closeButtonStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '0.375rem',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '2.75rem',
    minHeight: '2.75rem',
    fontSize: '1rem',
    flexShrink: 0,
  };

  if (isCompact) {
    // Closed: a labelled button, not a rail of sideways text. The label says
    // what it opens, and the target is big enough to hit with a thumb.
    if (isCollapsed) {
      return (
        <button
          className={className}
          onClick={() => setIsCollapsed(false)}
          aria-expanded={false}
          style={{
            position: 'fixed',
            bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
            [position]: '0.75rem',
            zIndex: SIDEBAR_Z_INDEX,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.625rem 0.875rem',
            minHeight: '2.75rem',
            borderRadius: '9999px',
            border: 'none',
            backgroundColor: accentColor,
            color: '#ffffff',
            fontSize: '0.8125rem',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.28)',
            cursor: 'pointer',
          }}
        >
          <span aria-hidden="true">{icon}</span>
          {title}
        </button>
      );
    }

    return (
      <>
        {/* Tapping the video dismisses the sheet, the expected way out. */}
        <div
          onClick={() => setIsCollapsed(true)}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: SIDEBAR_Z_INDEX,
          }}
        />
        <section
          className={className}
          aria-label={title}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '78vh',
            zIndex: SIDEBAR_Z_INDEX + 1,
            backgroundColor: '#ffffff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            boxShadow: '0 -8px 28px rgba(0, 0, 0, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div style={headerStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <span aria-hidden="true">{icon}</span>
              {title}
            </span>
            <button onClick={() => setIsCollapsed(true)} style={closeButtonStyle} aria-label={`Close ${title}`}>
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', WebkitOverflowScrolling: 'touch' }}>
            {children}
          </div>
        </section>
      </>
    );
  }

  // Laptop and larger: docked beside the video, collapsing to a rail.
  return (
    <div
      className={`collapsible-sidebar ${className}`}
      style={{
        position: 'fixed',
        top: style.top || '20px',
        [position]: '20px',
        width: isCollapsed ? collapsedWidth : width,
        height: 'calc(100vh - 40px)',
        backgroundColor: '#ffffff',
        border: `2px solid ${accentColor}`,
        borderRadius: '0.75rem',
        zIndex: SIDEBAR_Z_INDEX,
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.12)',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style
      }}
    >
      <div
        style={{ ...headerStyle, cursor: isCollapsed ? 'pointer' : 'default' }}
        onClick={() => isCollapsed && setIsCollapsed(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }} aria-hidden="true">{icon}</span>
          {!isCollapsed && <span style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</span>}
        </div>

        {!isCollapsed && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              setIsCollapsed(true);
            }}
            style={{ ...closeButtonStyle, minWidth: '2rem', minHeight: '2rem' }}
            title={`Collapse ${title}`}
            aria-label={`Collapse ${title}`}
          >
            {position === 'left' ? '◀' : '▶'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isCollapsed ? 0 : '1rem', display: isCollapsed ? 'none' : 'block' }}>
        {children}
      </div>

      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          aria-label={`Expand ${title}`}
          style={{
            position: 'absolute',
            inset: '3.25rem 0 0 0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: accentColor,
            fontSize: '0.75rem',
            fontWeight: 600,
            writingMode: 'vertical-rl',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {title}
        </button>
      )}
    </div>
  );
}
