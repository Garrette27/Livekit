'use client';

import React from 'react';

interface ErrorToastProps {
  error: string | null;
  onDismiss: () => void;
}

export default function ErrorToast({ error, onDismiss }: ErrorToastProps) {
  if (!error) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '0.5rem',
        padding: '1rem',
        color: '#dc2626',
        zIndex: 9999,
        maxWidth: '400px',
        textAlign: 'center'
      }}
    >
      {error}
      <button
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

