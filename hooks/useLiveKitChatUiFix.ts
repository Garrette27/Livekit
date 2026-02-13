import { useEffect } from 'react';

interface UseLiveKitChatUiFixOptions {
  enabled: boolean;
}

const STYLE_ID = 'livekit-chat-ui-fix';

const CHAT_PANEL_SELECTORS = [
  '.lk-chat-panel',
  '[class*="chat-panel"]',
  '[class*="ChatPanel"]',
  '[data-lk="chat-panel"]',
  '.lk-chat',
  '[class*="lk-chat"]',
  '.lk-chat-container',
  '[class*="chat-container"]',
];

const CHAT_BUTTON_SELECTORS = [
  'button[aria-label*="chat"]',
  'button[aria-label*="Chat"]',
  '[data-lk-kind="chat"]',
  '[data-lk-kind="toggle-chat"]',
  '[data-lk="chat-toggle"]',
  'button[title*="chat"]',
  'button[title*="Chat"]',
  'button.lk-button[aria-label*="chat"]',
  'button.lk-button[aria-label*="Chat"]',
];

function getChatPanels(): HTMLElement[] {
  const elements = new Set<HTMLElement>();
  CHAT_PANEL_SELECTORS.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((node) => {
        if (node instanceof HTMLElement) {
          elements.add(node);
        }
      });
    } catch {
      // Ignore invalid selector combinations in third-party DOM trees.
    }
  });
  return Array.from(elements);
}

function normalizeChatPanel(panel: HTMLElement) {
  panel.style.setProperty('z-index', '100200', 'important');
  panel.style.setProperty('pointer-events', 'auto', 'important');
  panel.style.setProperty('background-color', '#ffffff', 'important');
  panel.style.setProperty('color', '#111827', 'important');
}

function showChatPanels() {
  getChatPanels().forEach((panel) => {
    normalizeChatPanel(panel);
    panel.style.setProperty('display', 'flex', 'important');
    panel.style.setProperty('visibility', 'visible', 'important');
    panel.style.setProperty('opacity', '1', 'important');
    panel.style.setProperty('transform', 'translateX(0)', 'important');
    panel.removeAttribute('aria-hidden');
  });
}

function isChatButtonTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return CHAT_BUTTON_SELECTORS.some((selector) => {
    try {
      return Boolean(target.closest(selector));
    } catch {
      return false;
    }
  });
}

export function useLiveKitChatUiFix({ enabled }: UseLiveKitChatUiFixOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .lk-chat,
        .lk-chat-panel,
        .lk-chat-container,
        [class*="chat-panel"],
        [class*="ChatPanel"] {
          z-index: 100200 !important;
          background: #ffffff !important;
          color: #111827 !important;
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
      `;
      document.head.appendChild(style);
    }

    const normalizeExistingPanels = () => {
      getChatPanels().forEach(normalizeChatPanel);
    };

    normalizeExistingPanels();

    const observer = new MutationObserver(() => {
      normalizeExistingPanels();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleClickCapture = (event: MouseEvent) => {
      if (!isChatButtonTarget(event.target)) {
        return;
      }
      window.setTimeout(showChatPanels, 120);
    };

    const handleTouchEndCapture = (event: TouchEvent) => {
      if (!isChatButtonTarget(event.target)) {
        return;
      }
      window.setTimeout(showChatPanels, 120);
    };

    document.addEventListener('click', handleClickCapture, true);
    document.addEventListener('touchend', handleTouchEndCapture, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClickCapture, true);
      document.removeEventListener('touchend', handleTouchEndCapture, true);
    };
  }, [enabled]);
}
