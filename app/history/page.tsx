'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { listEntriesForDay, deleteEntry } from '@/lib/firestore';
import type { Entry, StrainType } from '@/lib/types';
import styles from './history.module.css';
import typeStyles from '../strains/cultivars.module.css';

/* ---------- HELPERS ---------- */
function pad(n: number) { return String(n).padStart(2, '0'); }
function toDateInputValue(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// Parse "YYYY-MM-DD" into a local Date (avoid UTC parsing quirk)
function dateInputToLocalMs(v: string): number {
  const [y, m, d] = v.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}
function shiftDateStr(v: string, days: number) {
  const ms = dateInputToLocalMs(v);
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return toDateInputValue(d.getTime());
}
function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function badgeClass(t: StrainType | undefined) {
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${typeStyles.typeBadge} ${typeStyles['type-indica']}`;
  if (key === 'sativa') return `${typeStyles.typeBadge} ${typeStyles['type-sativa']}`;
  return `${typeStyles.typeBadge} ${typeStyles['type-hybrid']}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [dateStr, setDateStr] = useState<string>(() => toDateInputValue(Date.now()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.push('/login?next=/history');
    });
    return () => unsub();
  }, [router]);

  async function loadForDate(s: string, u: User | null) {
    if (!u) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await listEntriesForDay(u.uid, dateInputToLocalMs(s));
      setEntries(list);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForDate(dateStr, user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateStr]);

  async function handleDelete(id: string) {
    if (!user) return;
    if (!confirm('Delete this session?')) return;
    try {
      await deleteEntry(user.uid, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Delete failed.');
    }
  }

  /* ---------- NEW: day totals (sessions & total grams) ---------- */
  const totals = useMemo(() => {
    const sessions = entries.length;
    const grams = entries.reduce((sum, e) => sum + (typeof e.weight === 'number' ? e.weight : 0), 0);
    return { sessions, grams: Number(grams.toFixed(2)) };
  }, [entries]);

  return (
    <div className="container">
      <div className="page-hero" style={{ marginBottom: '0.75rem' }}>
        <h1 style={{ marginTop: 0 }}>History</h1>
      </div>

      <div className={styles.controls}>
        <div className={styles.dateRow}>
          <label htmlFor="hist-date" className="subtle" style={{ marginRight: '.25rem' }}>
            Pick a date
          </label>
          <input
            id="hist-date"
            className="input"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>
        <div className={styles.pagerRow}>
          <button className="btn btn-ghost" onClick={() => setDateStr(shiftDateStr(dateStr, -1))}>
            ◀ Previous
          </button>
          <button className="btn btn-ghost" onClick={() => setDateStr(toDateInputValue(Date.now()))}>
            Today
          </button>
          <button className="btn btn-ghost" onClick={() => setDateStr(shiftDateStr(dateStr, +1))}>
            Next ▶
          </button>
        </div>
      </div>

      {!loading && (
      <div className={`card ${styles.totalsCard}`}>
      <div className={styles.totalsWrap}>
          <span className="badge">Sessions: {totals.sessions}</span>
          <span className="badge">Total Weight: {totals.grams} g</span>
        </div>
      </div>
      )}


      {err && <div className="card"><p className="error">{err}</p></div>}
      {loading && <div className="card">Loading…</div>}
      {!loading && entries.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>No sessions on this day.</p></div>
      )}

      <div className={styles.grid}>
        {entries.map((e) => (
          <div key={e.id} className={`card ${styles.entryCard}`}>
            <div className={styles.headerRow}>
              <h3 className={styles.name}>{e.strainName || 'Untitled'}</h3>
              <span className={`badge ${badgeClass(e.strainType)}`}>{e.strainType || '—'}</span>
            </div>

            <div className={typeStyles.kvList}>
              <div className={typeStyles.kvRow}>
                <span className={typeStyles.kvLabel}>Time</span>
                <span className={typeStyles.kvValue}>{fmtTime(e.time)}</span>
              </div>
              <div className={typeStyles.kvRow}>
                <span className={typeStyles.kvLabel}>Method</span>
                <span className={typeStyles.kvValue}>{e.method}</span>
              </div>
              {typeof e.weight === 'number' && (
                <div className={typeStyles.kvRow}>
                  <span className={typeStyles.kvLabel}>Weight</span>
                  <span className={typeStyles.kvValue}>{e.weight.toFixed(2)}g</span>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button className="btn btn-ghost" onClick={() => router.push(`/entries/${e.id}/edit`)} aria-label="Edit entry">
                Edit
              </button>
              <button className={`btn ${typeStyles.deleteBtn}`} onClick={() => handleDelete(e.id)} aria-label="Delete entry">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
