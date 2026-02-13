'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';

interface PatientSessionPanelsProps {
  roomName: string;
  patientName: string;
  isInfoPanelCollapsed: boolean;
  onToggleInfoPanel: () => void;
  showFixControlPanel: boolean;
  onHideFixPanel: () => void;
  onLeave: () => void;
  notesPanel: React.ReactNode;
}

export default function PatientSessionPanels({
  roomName,
  patientName,
  isInfoPanelCollapsed,
  onToggleInfoPanel,
  showFixControlPanel,
  onHideFixPanel,
  onLeave,
  notesPanel,
}: PatientSessionPanelsProps) {
  const patientLink = `https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`;

  return (
    <>
      {showFixControlPanel && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#ffffff',
            border: '2px solid #059669',
            borderRadius: '0.75rem',
            padding: '1rem',
            zIndex: 10001,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            maxWidth: isInfoPanelCollapsed ? '60px' : '320px',
            fontSize: '0.875rem',
            transition: 'max-width 0.3s ease',
            minHeight: '50px',
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: '0', color: '#059669', fontSize: '1rem', fontWeight: '600' }}>Room Control</h3>
              <button
                onClick={onToggleInfoPanel}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#059669',
                  padding: '0.25rem',
                }}
              >
                {isInfoPanelCollapsed ? '>' : '<'}
              </button>
            </div>

            {!isInfoPanelCollapsed && (
              <>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Connected as: {patientName || 'Patient'}
                </p>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Room: {roomName}</p>
              </>
            )}
          </div>

          {!isInfoPanelCollapsed && (
            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <div
                style={{
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#374151',
                  wordBreak: 'break-all',
                  marginBottom: '0.5rem',
                }}
              >
                <strong>Patient Link:</strong>
                <br />
                {patientLink}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(patientLink);
                  alert('Patient link copied to clipboard!');
                }}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Copy Patient Link
              </button>

              <button
                onClick={onHideFixPanel}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Hide Panel
              </button>
            </div>
          )}
        </div>
      )}

      {createPortal(
        <CollapsibleSidebar title="Manual Notes" icon="Notes" position="left" defaultCollapsed={false} width={350} collapsedWidth={60}>
          {notesPanel}
        </CollapsibleSidebar>,
        typeof window !== 'undefined' ? document.body : ({} as any)
      )}

      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '2px solid #059669',
          borderRadius: '0.75rem',
          padding: '0.75rem',
          zIndex: 9999,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          maxWidth: isInfoPanelCollapsed ? '60px' : '280px',
          fontSize: '0.875rem',
          transition: 'max-width 0.3s ease',
        }}
      >
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: '0', color: '#047857', fontSize: '1rem', fontWeight: '600' }}>Room Info</h3>
            <button
              onClick={onToggleInfoPanel}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#047857',
                padding: '0.25rem',
              }}
            >
              {isInfoPanelCollapsed ? '>' : '<'}
            </button>
          </div>

          {!isInfoPanelCollapsed && (
            <>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Connected as: {patientName}</p>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Room: {roomName}</p>
            </>
          )}
        </div>

        {!isInfoPanelCollapsed && (
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            <div
              style={{
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                padding: '0.375rem',
                fontSize: '0.7rem',
                color: '#374151',
                wordBreak: 'break-all',
                marginBottom: '0.5rem',
              }}
            >
              {patientLink}
            </div>

            <button
              onClick={onLeave}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Leave Call
            </button>

            <Link
              href={`/room/${roomName}`}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-block',
                textAlign: 'center',
                marginTop: '0.5rem',
              }}
            >
              Join as Doctor
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
