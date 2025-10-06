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

const asNumber = (v: any): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v); 
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const isEdible = (e: any): boolean =>
  String(e?.method || '').trim().toLowerCase() === 'edible' ||
  e?.isEdibleSession === true ||
  typeof e?.edibleMg === 'number' ||
  typeof e?.mg === 'number' ||
  typeof e?.dose === 'number' ||
  typeof e?.thcMg === 'number';

const getEdibleMg = (e: any): number | undefined =>
  asNumber(e?.edibleMg) ??
  asNumber(e?.mg) ??
  asNumber(e?.dose) ??
  asNumber(e?.thcMg);

export default function TrackerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState<string>('there');
  const [totalGramsToday, setTotalGramsToday] = useState<number>(0);
  const [totalMgToday, setTotalMgToday] = useState<number>(0);

  const loadTodayTotals = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;

    const entries: Entry[] = await listEntriesForDay(u.uid, startOfTodayMs());

    const grams = entries.reduce(
      (acc, e: any) => acc + (typeof e.weight === 'number' ? e.weight : 0),
      0
    );

    const mg = entries.reduce((acc, e: any) => {
      if (!isEdible(e)) return acc;
      const dose = getEdibleMg(e);
      return acc + (dose ?? 0);
    }, 0);

    setTotalGramsToday(Number(grams.toFixed(2)));
    setTotalMgToday(Number(mg.toFixed(2)));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace('/main');
      } else {
        setDisplayName(niceName());
        setReady(true);
        await loadTodayTotals();
      }
    });
    return () => unsub();
  }, [router, loadTodayTotals]);

  useEffect(() => {
    if (!ready) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') loadTodayTotals();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [ready, loadTodayTotals]);

  if (!ready) return null;

  return (
    <div className="container">
      <div className={`page-hero ${styles.pageHero}`}>
        <h1 className={styles.greeting}>Hi, {displayName}!</h1>
        <div className={`subtle ${styles.dateLine}`}>{formatFullDate()}</div>

        <div className={styles.amountRow}>
          <span className={`subtle ${styles.amountLabel}`}>Amount Consumed Today:</span>
          <span className="badge">{totalGramsToday} g</span>
        </div>

        {totalMgToday > 0 && (
          <div className={styles.amountRow}>
            <span className={`subtle ${styles.amountLabel}`}>Edibles Consumed Today:</span>
            <span className="badge">{totalMgToday} mg</span>
          </div>
        )}
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
