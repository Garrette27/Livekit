'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastInput {
  title?: string;
  message: string;
  kind?: ToastKind;
  durationMs?: number;
}

interface ToastEntry extends ToastInput {
  id: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastPalette(kind: ToastKind) {
  if (kind === 'success') {
    return {
      border: '#22c55e',
      background: '#f0fdf4',
      title: '#166534',
      message: '#14532d',
      badgeBackground: '#16a34a',
    };
  }

  if (kind === 'error') {
    return {
      border: '#f87171',
      background: '#fef2f2',
      title: '#991b1b',
      message: '#7f1d1d',
      badgeBackground: '#dc2626',
    };
  }

  return {
    border: '#60a5fa',
    background: '#eff6ff',
    title: '#1e3a8a',
    message: '#1d4ed8',
    badgeBackground: '#2563eb',
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const showToast = useCallback((input: ToastInput) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const durationMs = input.durationMs ?? 2800;
    const nextToast: ToastEntry = {
      id,
      title: input.title,
      message: input.message,
      kind: input.kind ?? 'info',
      durationMs,
    };

    setToasts((previous) => [...previous, nextToast]);

    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, durationMs);
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          pointerEvents: 'none',
          width: 'min(420px, calc(100vw - 2rem))',
        }}
      >
        {toasts.map((toast) => {
          const palette = getToastPalette(toast.kind);
          return (
            <div
              key={toast.id}
              style={{
                border: `1px solid ${palette.border}`,
                backgroundColor: palette.background,
                borderRadius: '0.625rem',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
                padding: '0.75rem 0.875rem',
                pointerEvents: 'auto',
                transform: 'translateY(0)',
                opacity: 1,
                transition: 'all 140ms ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '9999px',
                    backgroundColor: palette.badgeBackground,
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                >
                  {toast.kind === 'success' ? 'OK' : toast.kind === 'error' ? 'ERR' : 'INFO'}
                </span>
                <strong style={{ color: palette.title, fontSize: '0.875rem', lineHeight: 1.2 }}>
                  {toast.title || (toast.kind === 'success' ? 'Done' : toast.kind === 'error' ? 'Action failed' : 'Notice')}
                </strong>
              </div>
              <p style={{ margin: 0, color: palette.message, fontSize: '0.8rem', lineHeight: 1.35 }}>
                {toast.message}
              </p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}
