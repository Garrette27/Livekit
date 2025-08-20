// livekit-frontend/app/layout.tsx
import './globals.css';
import '@livekit/components-styles';
import { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}