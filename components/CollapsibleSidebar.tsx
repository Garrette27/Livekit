'use client';

import React, { useState, useEffect } from 'react';

interface CollapsibleSidebarProps {
  children: React.ReactNode;
  title: string;
  icon: string;
  position: 'left' | 'right';
  defaultCollapsed?: boolean;
  width?: number;
  collapsedWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CollapsibleSidebar({
  children,
  title,
  icon,
  position,
  defaultCollapsed = false,
  width = 350,
  collapsedWidth = 60,
  className = '',
  style = {}
}: CollapsibleSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Handle swipe gestures for mobile
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isSwipe = false;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwipe = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startX || !startY) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = Math.abs(currentX - startX);
      const diffY = Math.abs(currentY - startY);
      
      // Check if it's a horizontal swipe
      if (diffX > diffY && diffX > 50) {
        isSwipe = true;
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwipe || !startX) return;
      
      const currentX = e.changedTouches[0].clientX;
      const diffX = currentX - startX;
      
      // Swipe threshold
      if (Math.abs(diffX) > 50) {
        if (position === 'left' && diffX > 0) {
          // Swipe right to expand left sidebar
          setIsCollapsed(false);
        } else if (position === 'left' && diffX < 0) {
          // Swipe left to collapse left sidebar
          setIsCollapsed(true);
        } else if (position === 'right' && diffX < 0) {
          // Swipe left to expand right sidebar
          setIsCollapsed(false);
        } else if (position === 'right' && diffX > 0) {
          // Swipe right to collapse right sidebar
          setIsCollapsed(true);
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle drag on the header, not on interactive elements
    const target = e.target as HTMLElement;
    // Don't start dragging if clicking on input, button, or other interactive elements
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'BUTTON' || 
        target.closest('input, textarea, button, a, select')) {
      return;
    }
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const diffX = e.clientX - dragStart.x;
      const diffY = e.clientY - dragStart.y;
      
      // Only handle horizontal dragging
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (position === 'left' && diffX > 0) {
          setIsCollapsed(false);
        } else if (position === 'left' && diffX < 0) {
          setIsCollapsed(true);
        } else if (position === 'right' && diffX < 0) {
          setIsCollapsed(false);
        } else if (position === 'right' && diffX > 0) {
          setIsCollapsed(true);
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, position]);

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: style.top || '20px',
    [position]: '20px',
    width: isCollapsed ? collapsedWidth : width,
    height: 'calc(100vh - 40px)',
    backgroundColor: '#ffffff',
    border: `2px solid ${position === 'left' ? '#059669' : '#3b82f6'}`,
    borderRadius: '0.75rem',
    zIndex: 100000,
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.12)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...style
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: position === 'left' ? '#059669' : '#3b82f6',
    color: 'white',
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: isCollapsed ? 'pointer' : 'default',
    userSelect: 'none',
    minHeight: '60px',
    borderBottom: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: isCollapsed ? '0' : '1rem',
    display: isCollapsed ? 'none' : 'block'
  };

  const toggleButtonStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '0.375rem',
    color: 'white',
    padding: '0.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    minWidth: '32px',
    minHeight: '32px'
  };

  return (
    <div
      className={`collapsible-sidebar ${className}`}
      style={sidebarStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div
        style={headerStyle}
        onClick={() => isCollapsed && setIsCollapsed(false)}
        onMouseDown={handleMouseDown}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>{icon}</span>
          {!isCollapsed && (
            <span style={{ fontSize: '1rem', fontWeight: '600' }}>
              {title}
            </span>
          )}
        </div>
        
        {!isCollapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(true);
            }}
            style={toggleButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            title={`Collapse ${title}`}
          >
            {position === 'left' ? '◀' : '▶'}
          </button>
        )}
      </div>

      {/* Content */}
      <div 
        style={contentStyle}
        onMouseDown={(e) => {
          // Stop drag handling when clicking in content area (except on the header)
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || 
              target.tagName === 'TEXTAREA' || 
              target.tagName === 'BUTTON' || 
              target.closest('input, textarea, button, a, select')) {
            e.stopPropagation();
          }
        }}
      >
        {children}
      </div>

      {/* Collapsed state indicator */}
      {isCollapsed && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: position === 'left' ? '50%' : '50%',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            color: position === 'left' ? '#059669' : '#3b82f6',
            fontSize: '0.75rem',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={() => setIsCollapsed(false)}
        >
          {title}
        </div>
      )}

      {/* Drag handle for collapsed state */}
      {isCollapsed && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            [position]: '0',
            transform: 'translateY(-50%)',
            width: '4px',
            height: '60px',
            backgroundColor: position === 'left' ? '#059669' : '#3b82f6',
            cursor: 'ew-resize',
            borderRadius: position === 'left' ? '0 2px 2px 0' : '2px 0 0 2px',
            opacity: isHovered ? 1 : 0.6,
            transition: 'opacity 0.2s ease'
          }}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
}
