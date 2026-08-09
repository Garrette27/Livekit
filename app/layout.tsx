// livekit-frontend/app/layout.tsx
import './globals.css';
import '@livekit/components-styles';
import { ReactNode } from 'react';
import type { Viewport } from 'next';
import AppProviders from './providers';

/**
 * Zooming stays available. The previous `maximum-scale=1, user-scalable=no`
 * disabled pinch-zoom, which fails WCAG 1.4.4 and is a real problem for a
 * patient trying to read a consultation summary on a phone.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
