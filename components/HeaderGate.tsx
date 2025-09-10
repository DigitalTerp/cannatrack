'use client';

import { usePathname } from 'next/navigation';
import HeaderBar from '@/components/HeaderBar';

export default function HeaderGate() {
  const pathname = usePathname();
  // Hides  the header on /main
  if (pathname === '/main') return null;
  return <HeaderBar />;
}
