'use client';

import React from 'react';
import { User } from 'firebase/auth';
import DoctorControlsPanel from './DoctorControlsPanel';
import WaitingRoomPanel from './WaitingRoomPanel';
import SidebarPortal from '../../components/shared/SidebarPortal';
import { getRoomSessionPolicy } from '../../components/shared/room-session-policy';

interface DoctorSessionPanelProps {
  roomName: string;
  user: User;
  doctorName: string;
  onLeave: () => void;
}

export default function DoctorSessionPanel({
  roomName,
  user,
  doctorName,
  onLeave,
}: DoctorSessionPanelProps) {
  const policy = getRoomSessionPolicy('doctor');

  return (
    <>
      {policy.panels.waitingQueue.enabled && (
        <SidebarPortal
          title={policy.panels.waitingQueue.title}
          icon={policy.panels.waitingQueue.icon}
          position={policy.panels.waitingQueue.position}
          defaultCollapsed={policy.panels.waitingQueue.defaultCollapsed}
          width={policy.panels.waitingQueue.width}
          collapsedWidth={policy.panels.waitingQueue.collapsedWidth}
        >
          <WaitingRoomPanel roomName={roomName} />
        </SidebarPortal>
      )}

      {policy.panels.doctorSession.enabled && (
        <SidebarPortal
          title={policy.panels.doctorSession.title}
          icon={policy.panels.doctorSession.icon}
          position={policy.panels.doctorSession.position}
          defaultCollapsed={policy.panels.doctorSession.defaultCollapsed}
          width={policy.panels.doctorSession.width}
          collapsedWidth={policy.panels.doctorSession.collapsedWidth}
        >
          <DoctorControlsPanel
            doctorName={doctorName || user.displayName || user.email || 'Doctor'}
            roomName={roomName}
            onLeave={onLeave}
          />
        </SidebarPortal>
      )}
    </>
  );
}
