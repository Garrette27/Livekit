import { useEffect } from 'react';

interface UseLiveKitControlsFixOptions {
  enabled: boolean;
  cleanupOrphanedMenus: () => void;
}

const LIVEKIT_CONTROLS_STYLE_ID = 'livekit-controls-fix';

const LIVEKIT_CONTROLS_STYLE = `
  /* Ensure LiveKit controls are always visible */
  .lk-control-bar {
    position: fixed !important;
    bottom: 20px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 1000 !important;
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    background-color: rgba(0, 0, 0, 0.8) !important;
    border-radius: 12px !important;
    padding: 12px !important;
    gap: 8px !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 400px !important;
    max-width: 90vw !important;
  }

  .lk-control-bar button {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    background-color: rgba(255, 255, 255, 0.1) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
    color: white !important;
    font-size: 14px !important;
    min-width: 60px !important;
    height: 40px !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    transition: all 0.2s ease !important;
    position: relative !important;
    pointer-events: auto !important;
    cursor: pointer !important;
  }

  .lk-control-bar button:hover {
    background-color: rgba(255, 255, 255, 0.2) !important;
    transform: translateY(-1px) !important;
  }

  .lk-device-menu,
  .lk-device-menu-item,
  .lk-dropdown,
  .lk-menu {
    position: absolute !important;
    z-index: 1001 !important;
    background-color: #ffffff !important;
    border: 1px solid #d1d5db !important;
    border-radius: 8px !important;
    padding: 8px 0 !important;
    min-width: 200px !important;
    max-width: 300px !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
    backdrop-filter: blur(10px) !important;
    pointer-events: auto !important;
  }

  .lk-device-menu-item {
    padding: 12px 16px !important;
    color: #374151 !important;
    cursor: pointer !important;
    border: none !important;
    background: transparent !important;
    width: 100% !important;
    text-align: left !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    transition: background-color 0.2s ease !important;
    border-bottom: 1px solid #f3f4f6 !important;
    pointer-events: auto !important;
    user-select: none !important;
  }

  .lk-device-menu-item:last-child {
    border-bottom: none !important;
  }

  .lk-device-menu-item:hover {
    background-color: #f3f4f6 !important;
    color: #111827 !important;
  }

  .lk-device-menu-item:focus {
    background-color: #dbeafe !important;
    color: #1e40af !important;
    outline: 2px solid #3b82f6 !important;
    outline-offset: -2px !important;
  }

  .lk-device-menu,
  .lk-dropdown,
  .lk-menu {
    pointer-events: auto !important;
    z-index: 1001 !important;
  }

  .lk-device-menu-item span,
  .lk-device-menu-item div {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 100% !important;
    display: block !important;
    color: #374151 !important;
    font-weight: 500 !important;
  }

  .lk-device-menu-item:hover span,
  .lk-device-menu-item:hover div {
    color: #111827 !important;
  }

  .lk-device-menu-item:focus span,
  .lk-device-menu-item:focus div {
    color: #1e40af !important;
  }

  .lk-device-menu[style*="background"],
  .lk-dropdown[style*="background"],
  .lk-menu[style*="background"] {
    background-color: #ffffff !important;
  }

  .lk-device-menu-item[style*="color"],
  .lk-dropdown-item[style*="color"],
  .lk-menu-item[style*="color"] {
    color: #374151 !important;
  }

  .lk-device-menu button,
  .lk-dropdown button {
    background-color: #ffffff !important;
    color: #374151 !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    transition: all 0.2s ease !important;
  }

  .lk-device-menu button:hover,
  .lk-dropdown button:hover {
    background-color: #f3f4f6 !important;
    color: #111827 !important;
    border-color: #9ca3af !important;
  }

  .lk-device-menu button svg,
  .lk-dropdown button svg {
    color: #6b7280 !important;
    fill: #6b7280 !important;
  }

  .lk-device-menu button:hover svg,
  .lk-dropdown button:hover svg {
    color: #374151 !important;
    fill: #374151 !important;
  }

  .lk-chat {
    background-color: white !important;
    color: black !important;
  }

  .lk-chat-message {
    background-color: #f8f9fa !important;
    color: black !important;
    border: 1px solid #e9ecef !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
    margin: 4px 0 !important;
  }

  .lk-chat-input {
    background-color: white !important;
    color: black !important;
    border: 1px solid #ced4da !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
  }

  .lk-chat-input::placeholder {
    color: #6c757d !important;
  }

  .lk-video-conference {
    width: 100vw !important;
    height: 100vh !important;
    position: relative !important;
    background-color: #000 !important;
  }

  .lk-participant-video {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  }

  .lk-room-container {
    width: 100vw !important;
    height: 100vh !important;
    position: relative !important;
    overflow: hidden !important;
  }

  .fix-control-panel {
    z-index: 10001 !important;
    pointer-events: auto !important;
  }

  .back-to-home,
  .back-to-dashboard {
    z-index: 9999 !important;
    pointer-events: auto !important;
  }

  @media (max-width: 768px) {
    .lk-control-bar {
      min-width: 90vw !important;
      padding: 8px !important;
      gap: 4px !important;
    }

    .lk-control-bar button {
      min-width: 50px !important;
      padding: 6px 8px !important;
      font-size: 12px !important;
      height: 36px !important;
    }
  }
`;

export function useLiveKitControlsFix({
  enabled,
  cleanupOrphanedMenus,
}: UseLiveKitControlsFixOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const populateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === 'audioinput');
        const videoInputs = devices.filter((device) => device.kind === 'videoinput');

        const micSelect = document.getElementById('microphone-select') as HTMLSelectElement | null;
        const camSelect = document.getElementById('camera-select') as HTMLSelectElement | null;

        if (micSelect) {
          micSelect.innerHTML = '<option value="">Select Microphone</option>';
          audioInputs.forEach((device) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
            micSelect.appendChild(option);
          });
        }

        if (camSelect) {
          camSelect.innerHTML = '<option value="">Select Camera</option>';
          videoInputs.forEach((device) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${device.deviceId.slice(0, 8)}`;
            camSelect.appendChild(option);
          });
        }

        console.log('Device dropdowns populated:', { audio: audioInputs.length, video: videoInputs.length });
      } catch (error) {
        console.error('Error populating devices:', error);
      }
    };

    populateDevices();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (document.getElementById(LIVEKIT_CONTROLS_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = LIVEKIT_CONTROLS_STYLE_ID;
    style.textContent = LIVEKIT_CONTROLS_STYLE;
    document.head.appendChild(style);
    console.log('LiveKit controls fix applied');

    const forceShowControls = () => {
      const controlBar = document.querySelector('.lk-control-bar') as HTMLElement | null;
      if (controlBar) {
        controlBar.style.setProperty('display', 'flex', 'important');
        controlBar.style.setProperty('visibility', 'visible', 'important');
        controlBar.style.setProperty('opacity', '1', 'important');
        controlBar.style.setProperty('position', 'fixed', 'important');
        controlBar.style.setProperty('bottom', '20px', 'important');
        controlBar.style.setProperty('left', '50%', 'important');
        controlBar.style.setProperty('transform', 'translateX(-50%)', 'important');
        controlBar.style.setProperty('z-index', '1000', 'important');
      }

      const dropdowns = document.querySelectorAll('.lk-device-menu, .lk-dropdown, .lk-menu');
      dropdowns.forEach((dropdown) => {
        const element = dropdown as HTMLElement;
        element.style.setProperty('pointer-events', 'auto', 'important');
        element.style.setProperty('z-index', '1001', 'important');
      });

      const dropdownItems = document.querySelectorAll('.lk-device-menu-item');
      dropdownItems.forEach((item) => {
        const element = item as HTMLElement;
        element.style.setProperty('cursor', 'pointer', 'important');
      });
    };

    forceShowControls();
    const interval = window.setInterval(forceShowControls, 1000);

    const initializeDropdowns = () => {
      const allDropdowns = document.querySelectorAll('.lk-device-menu, .lk-dropdown, .lk-menu');
      allDropdowns.forEach((dropdown) => {
        const element = dropdown as HTMLElement;
        element.style.setProperty('pointer-events', 'auto', 'important');
        element.style.setProperty('z-index', '1001', 'important');

        element.style.removeProperty('display');
        element.style.removeProperty('visibility');
        element.style.removeProperty('opacity');
        element.style.removeProperty('background-color');
        element.style.removeProperty('border');
        element.style.removeProperty('border-radius');
        element.style.removeProperty('box-shadow');
        element.style.removeProperty('backdrop-filter');

        if (!element.getAttribute('data-escape-handler')) {
          element.setAttribute('data-escape-handler', 'true');
          let hoverTimeout: number | undefined;
          element.addEventListener('mouseleave', () => {
            window.clearTimeout(hoverTimeout);
            hoverTimeout = window.setTimeout(() => {
              if (!element.matches(':hover')) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                console.log('Requested dropdown close via Escape (mouseleave)');
              }
            }, 600);
          });
        }
      });
    };

    initializeDropdowns();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isControlBar = target.closest('.lk-control-bar');
      const isMenu = target.closest('.lk-device-menu, .lk-dropdown, .lk-menu');

      if (!isControlBar && !isMenu) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        setTimeout(() => {
          cleanupOrphanedMenus();
        }, 100);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('Escape key pressed - LiveKit will handle dropdown closing');
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      const styleToRemove = document.getElementById(LIVEKIT_CONTROLS_STYLE_ID);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [enabled, cleanupOrphanedMenus]);
}
