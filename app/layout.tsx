import './globals.css';
import type { ReactNode } from 'react';
import HeaderGate from '@/components/HeaderGate';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <HeaderGate />
        {children}
      </body>
    </html>
  );
}
