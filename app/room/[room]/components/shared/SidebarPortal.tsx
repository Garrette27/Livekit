'use client';

import React from 'react';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';

interface SidebarPortalProps {
  title: string;
  icon: string;
  position: 'left' | 'right';
  defaultCollapsed?: boolean;
  width?: number;
  collapsedWidth?: number;
  children: React.ReactNode;
}

export default function SidebarPortal({
  title,
  icon,
  position,
  defaultCollapsed = false,
  width = 350,
  collapsedWidth = 60,
  children,
}: SidebarPortalProps) {
  // Keep desktop panels in the room workspace so they reserve video space.
  // The sidebar itself owns fixed positioning only for compact sheets.
  return (
    <CollapsibleSidebar
      title={title}
      icon={icon}
      position={position}
      defaultCollapsed={defaultCollapsed}
      width={width}
      collapsedWidth={collapsedWidth}
    >
      {children}
    </CollapsibleSidebar>
  );
}
