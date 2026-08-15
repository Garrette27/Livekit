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
  speechLanguage: string;
  speechStatus: 'idle' | 'listening' | 'error' | 'permission-required';
  onSpeechLanguageChange: (language: string) => void;
  onLeave: () => void;
}

export default function DoctorSessionPanel({
  roomName,
  user,
  doctorName,
  speechLanguage,
  speechStatus,
  onSpeechLanguageChange,
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
          <WaitingRoomPanel
            roomName={roomName}
            doctorUserId={user.uid}
            autoRefresh={policy.panels.waitingQueue.autoRefresh}
            pollIntervalMs={policy.panels.waitingQueue.pollIntervalMs}
            showRefreshButton={policy.panels.waitingQueue.showRefreshButton}
            showAdmitControl={policy.panels.waitingQueue.showAdmitControl}
            showRejectControl={policy.panels.waitingQueue.showRejectControl}
            showRemoveControl={policy.panels.waitingQueue.showRemoveControl}
          />
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
            speechLanguage={speechLanguage}
            speechStatus={speechStatus}
            onSpeechLanguageChange={onSpeechLanguageChange}
            onLeave={onLeave}
            showCopyInvitationLinkControl={policy.panels.doctorSession.showCopyInvitationLinkControl}
            showRefreshInvitationLinkControl={policy.panels.doctorSession.showRefreshInvitationLinkControl}
            showLeaveCallControl={policy.panels.doctorSession.showLeaveCallControl}
          />
        </SidebarPortal>
      )}
    </>
  );
}
