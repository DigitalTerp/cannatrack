'use client';

import { usePathname } from 'next/navigation';
import HeaderBar from '@/components/HeaderBar';

export default function HeaderGate() {
  const pathname = usePathname();
  if (pathname === '/main') return null;
  return <HeaderBar />;
}
