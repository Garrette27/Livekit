import { useEffect, useRef, useState } from 'react';

interface UseLiveKitChatUiFixOptions {
  enabled: boolean;
}

const STYLE_ID = 'livekit-chat-ui-fix';
const CHAT_OPEN_ATTRIBUTE = 'data-livekit-chat-open';

const CHAT_PANEL_SELECTORS = [
  '.lk-chat',
  '.lk-chat-panel',
  '.lk-chat-container',
  '[class*="chat-panel"]',
  '[class*="ChatPanel"]',
  '[data-lk="chat-panel"]',
];

const CHAT_TOGGLE_BUTTON_SELECTORS = [
  'button[data-lk-kind="chat"]',
  'button[data-lk-kind="toggle-chat"]',
  'button[aria-label*="chat" i]',
  'button[title*="chat" i]',
];

const CHAT_CLOSE_BUTTON_SELECTORS = [
  '.lk-chat-panel button[aria-label*="close" i]',
  '.lk-chat button[aria-label*="close" i]',
  '[class*="chat-panel"] button[aria-label*="close" i]',
];

const CHAT_PANEL_SELECTOR_QUERY = CHAT_PANEL_SELECTORS.join(', ');

function matchesAnySelector(element: HTMLElement, selectors: string[]): boolean {
  return selectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

function injectChatStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lk-chat,
    .lk-chat-panel,
    .lk-chat-container,
    [class*="chat-panel"],
    [class*="ChatPanel"],
    [data-lk="chat-panel"] {
      z-index: 10050 !important;
      background: #ffffff !important;
      color: #111827 !important;
      transition: opacity 120ms ease, transform 120ms ease !important;
    }

    .lk-chat input,
    .lk-chat textarea,
    .lk-chat-panel input,
    .lk-chat-panel textarea {
      background: #ffffff !important;
      color: #111827 !important;
    }

    .lk-chat [class*="message"],
    .lk-chat-panel [class*="message"] {
      background: #f8fafc !important;
      color: #111827 !important;
    }

    body[${CHAT_OPEN_ATTRIBUTE}="true"] .lk-chat,
    body[${CHAT_OPEN_ATTRIBUTE}="true"] .lk-chat-panel,
    body[${CHAT_OPEN_ATTRIBUTE}="true"] .lk-chat-container,
    body[${CHAT_OPEN_ATTRIBUTE}="true"] [class*="chat-panel"],
    body[${CHAT_OPEN_ATTRIBUTE}="true"] [class*="ChatPanel"],
    body[${CHAT_OPEN_ATTRIBUTE}="true"] [data-lk="chat-panel"] {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: translateY(0) !important;
    }

    body[${CHAT_OPEN_ATTRIBUTE}="false"] .lk-chat,
    body[${CHAT_OPEN_ATTRIBUTE}="false"] .lk-chat-panel,
    body[${CHAT_OPEN_ATTRIBUTE}="false"] .lk-chat-container,
    body[${CHAT_OPEN_ATTRIBUTE}="false"] [class*="chat-panel"],
    body[${CHAT_OPEN_ATTRIBUTE}="false"] [class*="ChatPanel"],
    body[${CHAT_OPEN_ATTRIBUTE}="false"] [data-lk="chat-panel"] {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transform: translateY(8px) !important;
    }

    @media (max-width: 768px) {
      .lk-chat,
      .lk-chat-panel,
      .lk-chat-container,
      [class*="chat-panel"],
      [class*="ChatPanel"],
      [data-lk="chat-panel"] {
        position: fixed !important;
        right: 16px !important;
        bottom: 84px !important;
        left: auto !important;
        width: min(420px, calc(100vw - 32px)) !important;
        max-height: 50vh !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2) !important;
      }
    }
  `;

  document.head.appendChild(style);
}

export function useLiveKitChatUiFix({ enabled }: UseLiveKitChatUiFixOptions) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isChatOpenRef = useRef(false);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (!enabled) {
      setIsChatOpen(false);
      return;
    }

    injectChatStyles();

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const button = target.closest('button');
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      if (matchesAnySelector(button, CHAT_TOGGLE_BUTTON_SELECTORS)) {
        setIsChatOpen((previous) => !previous);
        return;
      }

      if (matchesAnySelector(button, CHAT_CLOSE_BUTTON_SELECTORS)) {
        setIsChatOpen(false);
      }
    };

    const handleKeydownCapture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsChatOpen(false);
      }
    };

    const handleOutsidePointerDown = (event: MouseEvent) => {
      if (!isChatOpenRef.current) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const insideChatPanel = target.closest(CHAT_PANEL_SELECTOR_QUERY);
      const chatToggleButton = target.closest(CHAT_TOGGLE_BUTTON_SELECTORS.join(', '));
      if (!insideChatPanel && !chatToggleButton) {
        setIsChatOpen(false);
      }
    };

    document.addEventListener('click', handleClickCapture, true);
    document.addEventListener('keydown', handleKeydownCapture, true);
    document.addEventListener('mousedown', handleOutsidePointerDown, true);

    return () => {
      document.removeEventListener('click', handleClickCapture, true);
      document.removeEventListener('keydown', handleKeydownCapture, true);
      document.removeEventListener('mousedown', handleOutsidePointerDown, true);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      document.body.removeAttribute(CHAT_OPEN_ATTRIBUTE);
      return;
    }

    document.body.setAttribute(CHAT_OPEN_ATTRIBUTE, isChatOpen ? 'true' : 'false');
    return () => {
      document.body.removeAttribute(CHAT_OPEN_ATTRIBUTE);
    };
  }, [enabled, isChatOpen]);
}
