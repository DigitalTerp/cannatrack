import './globals.css';
import type { ReactNode } from 'react';
import HeaderBar from '@/components/HeaderBar';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <HeaderBar />
        {children}
      </body>
    </html>
  );
}
