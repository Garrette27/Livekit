'use client';

import React from 'react';

interface ErrorToastProps {
  error: string | null;
  onDismiss: () => void;
}

export default function ErrorToast({ error, onDismiss }: ErrorToastProps) {
  if (!error) return null;

  return (
    // Top-anchored above the call chrome: a bottom toast sat behind the
    // LiveKit control bar (z-index 10000) and could not be read or dismissed.
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: '4.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '0.5rem',
        padding: '1rem',
        color: '#dc2626',
        zIndex: 10070,
        maxWidth: '400px',
        textAlign: 'center'
      }}
    >
      {error}
      <button
        type="button"
        aria-label="Dismiss error"
        onClick={onDismiss}
        style={{
          marginLeft: '1rem',
          backgroundColor: 'transparent',
          border: 'none',
          color: '#dc2626',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        ×
      </button>
    </div>
  );
}

