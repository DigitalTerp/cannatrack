'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { listEntriesForDay } from '@/lib/firestore';
import type { Entry } from '@/lib/types';

import dailyStyles from '@/components/DailyLog.module.css';
import styles from './tracker.module.css';

const DailyLog = dynamic(() => import('@/components/DailyLog'), { ssr: false });

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatFullDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function niceName() {
  const u = auth.currentUser;
  const fromProfile = u?.displayName?.trim();
  if (fromProfile) return fromProfile;
  const email = u?.email || '';
  const raw = email.split('@')[0] || 'there';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function TrackerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState<string>('there');
  const [totalGramsToday, setTotalGramsToday] = useState<number>(0);

  const loadTodayTotal = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    const entries: Entry[] = await listEntriesForDay(u.uid, startOfTodayMs());
    const total = entries.reduce(
      (acc, e) => acc + (typeof e.weight === 'number' ? e.weight : 0),
      0
    );
    setTotalGramsToday(Number(total.toFixed(2)));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace('/main');
      } else {
        setDisplayName(niceName());
        setReady(true);
        await loadTodayTotal();
      }
    });
    return () => unsub();
  }, [router, loadTodayTotal]);

  useEffect(() => {
    if (!ready) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') loadTodayTotal();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [ready, loadTodayTotal]);

  if (!ready) return null;

  return (
    <div className="container">
      <div className={`page-hero ${styles.pageHero}`}>
        <h1 className={styles.greeting}>Hi, {displayName}!</h1>
        <div className={`subtle ${styles.dateLine}`}>{formatFullDate()}</div>

        {/* Amount Consumed Today */}
        <div className={styles.amountRow}>
          <span className={`subtle ${styles.amountLabel}`}>Amount Consumed Today:</span>
          <span className="badge">{totalGramsToday} g</span>
        </div>
      </div>

      <DailyLog />

      <div className={dailyStyles.logSessionRow}>
        <button className="btn btn-primary" onClick={() => router.push('/entries/new')}>
          Log Session
        </button>
      </div>
    </div>
  );
}
