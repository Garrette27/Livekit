'use client';

import React from 'react';
import { User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import NotesPanel from './NotesPanel';
import DoctorControlsPanel from './DoctorControlsPanel';
import WaitingRoomPanel from './WaitingRoomPanel';
import InvitationManagementPanel from './InvitationManagementPanel';
import SidebarPortal from './shared/SidebarPortal';

interface DoctorSessionPanelProps {
  roomName: string;
  user: User;
  doctorName: string;
  db: Firestore | null;
  storage: FirebaseStorage | null;
  onLeave: () => void;
}

export default function DoctorSessionPanel({
  roomName,
  user,
  doctorName,
  db,
  storage,
  onLeave,
}: DoctorSessionPanelProps) {
  return (
    <>
      <SidebarPortal
        title="Waiting Room"
        icon="🚪"
        position="left"
        defaultCollapsed={true}
        width={350}
        collapsedWidth={60}
      >
        <WaitingRoomPanel roomName={roomName} />
      </SidebarPortal>

      <SidebarPortal
        title="Invitation Management"
        icon="📧"
        position="left"
        defaultCollapsed={true}
        width={400}
        collapsedWidth={60}
      >
        <InvitationManagementPanel user={user} roomName={roomName} />
      </SidebarPortal>

      <SidebarPortal
        title="Manual Notes"
        icon="📝"
        position="left"
        defaultCollapsed={false}
        width={350}
        collapsedWidth={60}
      >
        <NotesPanel roomName={roomName} db={db} storage={storage} />
      </SidebarPortal>

      <SidebarPortal
        title="Doctor Session Panel"
        icon="🛠️"
        position="right"
        defaultCollapsed={false}
        width={300}
        collapsedWidth={60}
      >
        <DoctorControlsPanel
          doctorName={doctorName || user.displayName || user.email || 'Doctor'}
          roomName={roomName}
          onLeave={onLeave}
        />
      </SidebarPortal>
    </>
  );
}
