'use client';

import React from 'react';
import SidebarPortal from '../../components/shared/SidebarPortal';
import { getRoomSessionPolicy } from '../../components/shared/room-session-policy';

interface PatientSessionPanelsProps {
  roomName: string;
  patientName: string;
  onLeave: () => void;
}

export default function PatientSessionPanels({ roomName, patientName, onLeave }: PatientSessionPanelsProps) {
  const policy = getRoomSessionPolicy('patient');

  if (!policy.panels.patientSession.enabled) {
    return null;
  }

  return (
    <SidebarPortal
      title={policy.panels.patientSession.title}
      icon={policy.panels.patientSession.icon}
      position={policy.panels.patientSession.position}
      defaultCollapsed={policy.panels.patientSession.defaultCollapsed}
      width={policy.panels.patientSession.width}
      collapsedWidth={policy.panels.patientSession.collapsedWidth}
    >
      <div style={{ marginBottom: '0.75rem' }}>
        <p
          style={{
            margin: '0',
            color: '#6b7280',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
          }}
        >
          Connected as: {patientName || 'Patient'}
        </p>
        <p
          style={{
            margin: '0',
            color: '#6b7280',
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
          }}
        >
          Room: {roomName}
        </p>
      </div>

      <button
        onClick={onLeave}
        style={{
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Leave Consultation
      </button>
    </SidebarPortal>
  );
}
