import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

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
  '.lk-control-bar button[aria-label="Chat"]',
  '.lk-control-bar button[aria-label="chat"]',
  '.lk-control-bar button[title="Chat"]',
  '.lk-control-bar button[title="chat"]',
];
const CHAT_TOGGLE_BUTTON_QUERY = CHAT_TOGGLE_BUTTON_SELECTORS.join(', ');

const CHAT_CLOSE_BUTTON_SELECTORS = ['.lk-chat button[aria-label="Close"]', '.lk-chat-panel button[aria-label="Close"]'];
const CHAT_CLOSE_BUTTON_QUERY = CHAT_CLOSE_BUTTON_SELECTORS.join(', ');

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

    [data-room-chat-scope="true"][data-room-chat-enabled="true"][data-room-chat-open="true"] .lk-chat,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"][data-room-chat-open="true"] .lk-chat-panel,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"][data-room-chat-open="true"] .lk-chat-container {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: translateX(0) !important;
    }

    [data-room-chat-scope="true"][data-room-chat-enabled="true"][data-room-chat-open="false"] .lk-chat,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"][data-room-chat-open="false"] .lk-chat-panel,
    [data-room-chat-scope="true"][data-room-chat-enabled="true"][data-room-chat-open="false"] .lk-chat-container {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transform: translateX(10px) !important;
    }
  `;

  document.head.appendChild(style);
}

function isElementWithinScope(scope: HTMLElement, element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && scope.contains(element);
}

export function useRoomChatController({ enabled, scopeRef }: UseRoomChatControllerArgs): RoomChatController {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

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

    const handleClickCapture = (event: MouseEvent) => {
      const scope = scopeRef.current;
      const target = event.target as HTMLElement | null;
      if (!scope || !target) {
        return;
      }

      const toggleButton = target.closest(CHAT_TOGGLE_BUTTON_QUERY);
      if (isElementWithinScope(scope, toggleButton)) {
        toggle();
        return;
      }

      const closeButton = target.closest(CHAT_CLOSE_BUTTON_QUERY);
      if (isElementWithinScope(scope, closeButton)) {
        close();
        return;
      }

      if (!isOpenRef.current) {
        return;
      }

      const chatPanel = target.closest(CHAT_PANEL_QUERY);
      if (isElementWithinScope(scope, chatPanel)) {
        return;
      }

      if (scope.contains(target)) {
        close();
      }
    };

    const handleKeydownCapture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('click', handleClickCapture, true);
    document.addEventListener('keydown', handleKeydownCapture, true);

    return () => {
      document.removeEventListener('click', handleClickCapture, true);
      document.removeEventListener('keydown', handleKeydownCapture, true);
    };
  }, [close, enabled, scopeRef, toggle]);

  return { enabled, isOpen, toggle, close };
}
