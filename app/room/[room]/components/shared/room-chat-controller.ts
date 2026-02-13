import { RefObject, useCallback, useEffect, useState } from 'react';

interface UseRoomChatControllerArgs {
  enabled: boolean;
  scopeRef: RefObject<HTMLElement | null>;
}

interface RoomChatController {
  enabled: boolean;
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const STYLE_ID = 'room-chat-controller-style';

const CHAT_PANEL_SELECTORS = ['.lk-chat', '.lk-chat-panel', '.lk-chat-container'];
const CHAT_PANEL_QUERY = CHAT_PANEL_SELECTORS.join(', ');

const CHAT_TOGGLE_BUTTON_SELECTORS = [
  '.lk-control-bar button[data-lk-kind="chat"]',
  '.lk-control-bar button[data-lk-kind="toggle-chat"]',
  '.lk-control-bar button[aria-label*="chat" i]',
  '.lk-control-bar button[title*="chat" i]',
];
const CHAT_TOGGLE_BUTTON_QUERY = CHAT_TOGGLE_BUTTON_SELECTORS.join(', ');

const CHAT_CLOSE_BUTTON_SELECTORS = ['.lk-chat button[aria-label*="close" i]', '.lk-chat-panel button[aria-label*="close" i]'];
const CHAT_CLOSE_BUTTON_QUERY = CHAT_CLOSE_BUTTON_SELECTORS.join(', ');

const CHAT_OBSERVER_ATTRIBUTE_FILTER = ['aria-hidden', 'hidden', 'style', 'class'];

function installScopedStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-room-chat-scope="true"][data-room-chat-enabled="true"] .lk-chat,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"] .lk-chat-panel,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"] .lk-chat-container {
      z-index: 10050 !important;
      background-color: #ffffff !important;
      color: #111827 !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 12px !important;
      transition: opacity 120ms ease, transform 120ms ease !important;
    }

    [data-room-chat-scope="true"][data-room-chat-enabled="true"] .lk-chat textarea,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"] .lk-chat input,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"] .lk-chat-panel textarea,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"] .lk-chat-panel input {
      background-color: #ffffff !important;
      color: #111827 !important;
    }
  `;

  document.head.appendChild(style);
}

function isElementWithinScope(scope: HTMLElement, element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && scope.contains(element);
}

function isChatPanelVisible(panel: HTMLElement | null): boolean {
  if (!panel) {
    return false;
  }

  if (panel.hidden || panel.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const styles = window.getComputedStyle(panel);
  return styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';
}

function findChatPanel(scope: HTMLElement): HTMLElement | null {
  const panel = scope.querySelector(CHAT_PANEL_QUERY);
  return panel instanceof HTMLElement ? panel : null;
}

function findChatToggleButton(scope: HTMLElement): HTMLElement | null {
  const button = scope.querySelector(CHAT_TOGGLE_BUTTON_QUERY);
  return button instanceof HTMLElement ? button : null;
}

export function useRoomChatController({ enabled, scopeRef }: UseRoomChatControllerArgs): RoomChatController {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => {
    const scope = scopeRef.current;
    if (!scope) {
      setIsOpen(false);
      return;
    }

    const panel = findChatPanel(scope);
    if (!isChatPanelVisible(panel)) {
      setIsOpen(false);
      return;
    }

    const closeButton = panel?.querySelector(CHAT_CLOSE_BUTTON_QUERY);
    if (closeButton instanceof HTMLElement) {
      closeButton.click();
      return;
    }

    const toggleButton = findChatToggleButton(scope);
    if (toggleButton) {
      toggleButton.click();
      return;
    }

    setIsOpen(false);
  }, [scopeRef]);

  const toggle = useCallback(() => {
    const scope = scopeRef.current;
    if (!scope) {
      setIsOpen((previous) => !previous);
      return;
    }

    const toggleButton = findChatToggleButton(scope);
    if (toggleButton) {
      toggleButton.click();
      return;
    }

    setIsOpen((previous) => !previous);
  }, [scopeRef]);

  useEffect(() => {
    installScopedStyles();
  }, []);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) {
      return;
    }

    scope.setAttribute('data-room-chat-scope', 'true');
    scope.setAttribute('data-room-chat-enabled', enabled ? 'true' : 'false');
    scope.setAttribute('data-room-chat-open', enabled && isOpen ? 'true' : 'false');

    if (!enabled) {
      setIsOpen(false);
    }
  }, [enabled, isOpen, scopeRef]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const scope = scopeRef.current;
    if (!scope) {
      return;
    }

    const syncIsOpenFromDom = () => {
      const panel = findChatPanel(scope);
      setIsOpen(isChatPanelVisible(panel));
    };

    syncIsOpenFromDom();

    const observer = new MutationObserver(syncIsOpenFromDom);
    observer.observe(scope, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: CHAT_OBSERVER_ATTRIBUTE_FILTER,
    });

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const toggleButton = target.closest(CHAT_TOGGLE_BUTTON_QUERY);
      if (isElementWithinScope(scope, toggleButton)) {
        window.setTimeout(syncIsOpenFromDom, 0);
        return;
      }

      const closeButton = target.closest(CHAT_CLOSE_BUTTON_QUERY);
      if (isElementWithinScope(scope, closeButton)) {
        window.setTimeout(syncIsOpenFromDom, 0);
      }
    };

    const handleKeydownCapture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const panel = findChatPanel(scope);
        if (!isChatPanelVisible(panel)) {
          setIsOpen(false);
          return;
        }

        close();
      }
    };

    document.addEventListener('click', handleClickCapture, true);
    document.addEventListener('keydown', handleKeydownCapture, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClickCapture, true);
      document.removeEventListener('keydown', handleKeydownCapture, true);
    };
  }, [close, enabled, scopeRef]);

  return { enabled, isOpen, toggle, close };
}
