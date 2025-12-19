'use client';

import React from 'react';
import { createPortal } from 'react-dom';
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
  children
}: SidebarPortalProps) {
  return createPortal(
    <CollapsibleSidebar
      title={title}
      icon={icon}
      position={position}
      defaultCollapsed={defaultCollapsed}
      width={width}
      collapsedWidth={collapsedWidth}
    >
      {children}
    </CollapsibleSidebar>,
    typeof window !== 'undefined' ? document.body : ({} as any)
  );
}

