'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const DailyLog = dynamic(() => import('@/components/DailyLog'), { ssr: false });

export default function TrackerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace('/main');
      else setReady(true);
    });
    return () => unsub();
  }, [router]);

  if (!ready) return null;

  return (
    <div className="container">
      <div className="page-hero">
        <h2>Today</h2>
      </div>

      <DailyLog />
        <div className="actions">
          <button className="btn btn-primary" onClick={() => router.push('/entries/new')}>
            Log Session
          </button>
        </div>
    </div>
  );
}
