import { useEffect, useState } from 'react';

interface UseLiveKitSpeechUiGuardOptions {
  enabled: boolean;
  recognitionInstance: any;
  cleanupOrphanedMenus: () => void;
}

export function useLiveKitSpeechUiGuard({
  enabled,
  recognitionInstance,
  cleanupOrphanedMenus,
}: UseLiveKitSpeechUiGuardOptions) {
  const [isUIActive, setIsUIActive] = useState<boolean>(false);
  const [speechPaused, setSpeechPaused] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleUIActivity = () => {
      setIsUIActive(true);
      setSpeechPaused(true);

      if (recognitionInstance && recognitionInstance.state === 'recording') {
        try {
          recognitionInstance.stop();
          console.log('Speech recognition paused for UI interaction');
        } catch (error) {
          console.log('Error pausing speech recognition:', error);
        }
      }
    };

    const handleUIInactivity = () => {
      setIsUIActive(false);
      setSpeechPaused(false);
      console.log('UI interaction ended, speech recognition can resume');
    };

    const controlBar = document.querySelector('.lk-control-bar');

    const handleControlBarClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      if (
        button &&
        (button.querySelector('[aria-haspopup="true"]') ||
          button.getAttribute('aria-haspopup') === 'true')
      ) {
        console.log('Dropdown button clicked - pausing speech recognition');
        handleUIActivity();
        setTimeout(handleUIInactivity, 3000);
      }
    };

    const handleControlBarMouseLeave = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };

    if (controlBar) {
      controlBar.addEventListener('click', handleControlBarClick);
      controlBar.addEventListener('mouseleave', handleControlBarMouseLeave);
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type !== 'attributes') {
          return;
        }

        const element = mutation.target as HTMLElement;

        if (mutation.attributeName === 'aria-expanded') {
          if (element.classList.contains('lk-device-menu') || element.classList.contains('lk-dropdown')) {
            if (element.getAttribute('aria-expanded') === 'true') {
              console.log('Dropdown opened - pausing speech recognition');
              handleUIActivity();
              (element as any).dataset.openedAt = String(Date.now());
            } else {
              console.log('Dropdown closed - resuming speech recognition');
              setTimeout(handleUIInactivity, 1000);
              delete (element as any).dataset.openedAt;
            }
          }
        }

        if (mutation.attributeName === 'style') {
          if (element.classList.contains('lk-device-menu') || element.classList.contains('lk-dropdown')) {
            const display = element.style.display;
            if (display === 'block' || display === 'flex') {
              console.log('Dropdown visible - pausing speech recognition');
              handleUIActivity();
              (element as any).dataset.openedAt = String(Date.now());
            } else if (display === 'none') {
              console.log('Dropdown hidden - resuming speech recognition');
              setTimeout(handleUIInactivity, 1000);
              delete (element as any).dataset.openedAt;
            }
          }
        }
      });
    });

    const dropdowns = document.querySelectorAll('.lk-device-menu, .lk-dropdown, .lk-menu');
    dropdowns.forEach((dropdown) => {
      observer.observe(dropdown, { attributes: true, attributeFilter: ['aria-expanded', 'style'] });
    });

    const attachHandlersToMenu = (element: HTMLElement) => {
      (element as any).dataset.openedAt = String(Date.now());
      if (!(element as any)._lkBound) {
        (element as any)._lkBound = true;
        let hoverTimeout: number | undefined;
        element.addEventListener('mouseleave', () => {
          window.clearTimeout(hoverTimeout);
          hoverTimeout = window.setTimeout(() => {
            if (!element.matches(':hover')) {
              cleanupOrphanedMenus();
            }
          }, 600);
        });
      }

      element
        .querySelectorAll('.lk-device-menu-item, .lk-menu-item, [role="menuitem"], [role="option"]')
        .forEach((item) => {
          const menuItem = item as HTMLElement;
          if (!(menuItem as any)._lkClick) {
            (menuItem as any)._lkClick = true;
            menuItem.addEventListener('click', () => {
              setTimeout(() => cleanupOrphanedMenus(), 0);
            });
          }
        });
    };

    const subtreeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }

          if (node.matches('.lk-device-menu, .lk-dropdown, .lk-menu')) {
            observer.observe(node, { attributes: true, attributeFilter: ['aria-expanded', 'style'] });
            attachHandlersToMenu(node);
          } else {
            const innerMenus = node.querySelectorAll?.('.lk-device-menu, .lk-dropdown, .lk-menu');
            innerMenus?.forEach((menu) => attachHandlersToMenu(menu as HTMLElement));
          }
        });
      });
    });
    subtreeObserver.observe(document.body, { childList: true, subtree: true });

    const watchdogInterval = window.setInterval(() => {
      cleanupOrphanedMenus();
    }, 2000);

    const handleWheel = () => {
      cleanupOrphanedMenus();
    };
    window.addEventListener('wheel', handleWheel, { passive: true });

    const start = Date.now();
    const initialCleanup = window.setInterval(() => {
      cleanupOrphanedMenus();
      if (Date.now() - start > 4000) {
        window.clearInterval(initialCleanup);
      }
    }, 300);

    return () => {
      if (controlBar) {
        controlBar.removeEventListener('click', handleControlBarClick);
        controlBar.removeEventListener('mouseleave', handleControlBarMouseLeave);
      }
      observer.disconnect();
      subtreeObserver.disconnect();
      window.clearInterval(watchdogInterval);
      window.clearInterval(initialCleanup);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [enabled, recognitionInstance, cleanupOrphanedMenus]);

  return {
    isUIActive,
    speechPaused,
  };
}
