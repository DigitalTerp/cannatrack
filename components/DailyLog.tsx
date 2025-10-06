'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { listEntriesForDay, deleteEntry } from '@/lib/firestore';
import type { Entry, StrainType } from '@/lib/types';
import typeStyles from '@/app/strains/cultivars.module.css';
import styles from './DailyLog.module.css';

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function badgeClass(t?: StrainType) {
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${typeStyles.typeBadge} ${typeStyles['type-indica']}`;
  if (key === 'sativa') return `${typeStyles.typeBadge} ${typeStyles['type-sativa']}`;
  return `${typeStyles.typeBadge} ${typeStyles['type-hybrid']}`;
}
const isFiniteNum = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);
function formatMg(n: number) {
  return Number.isInteger(n) ? `${n} mg` : `${n.toFixed(1)} mg`;
}
function formatPct(n: number) {
  const v = Math.round(n * 10) / 10;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}%`;
}

const asNumber = (v: any): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v); 
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const getEdibleMg = (e: any): number | undefined =>
  asNumber(e?.edibleMg) ??
  asNumber(e?.mg) ??
  asNumber(e?.dose) ??
  asNumber(e?.thcMg);

const isEdibleEntry = (e: any): boolean => {
  const method = String(e?.method || '').trim().toLowerCase();
  return (
    method === 'edible' ||
    e?.isEdibleSession === true ||
    e?.isEdible === true ||
    e?.edibleName != null ||
    e?.edibleType != null ||
    e?.edibleKind != null ||
    getEdibleMg(e) != null
  );
};

export default function DailyLog() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        router.push('/login?next=/tracker');
        return;
      }
      try {
        setLoading(true);
        const list = await listEntriesForDay(u.uid, startOfTodayMs());
        setEntries(list);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load entries.');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  async function handleDelete(id: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      router.push('/login?next=/tracker');
      return;
    }
    const ok = confirm('Remove this session?');
    if (!ok) return;
    try {
      await deleteEntry(uid, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Remove failed.');
    }
  }

  if (loading) return <div className="card">Loading today’s sessions…</div>;
  if (err) return <div className="card"><p className="error">{err}</p></div>;
  if (entries.length === 0) {
    return (
      <div className="card">
        <p className="subtle" style={{ margin: 0 }}>
          No sessions yet today. Log one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {entries.map((e) => {
        const edible = isEdibleEntry(e);
        const title = edible
          ? (e as any).edibleName || 'Untitled Edible'
          : (e.strainName || 'Untitled');

        const thc = isFiniteNum((e as any).thcPercent) ? (e as any).thcPercent : 0;
        const thca = isFiniteNum((e as any).thcaPercent) ? (e as any).thcaPercent : 0;
        const totalThc = thc + thca;
        const showTotalThc = totalThc > 0;

        const edibleType = (e as any).edibleType ?? (e as any).edibleKind;
        const doseMg = getEdibleMg(e);

        return (
          <div className={`card ${styles.item}`} key={e.id}>
            <div className={styles.row}>
              <div>
                <div className={styles.nameLine}>
                  <strong className={styles.name}>{title}</strong>
                  <span className={`badge ${badgeClass(e.strainType)}`}>{e.strainType}</span>
                </div>

                <div className={styles.meta}>
                  {edible ? (
                    <>
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Method:</span> {e.method}
                      </span>
                      {edibleType && (
                        <span className={styles.metaChip}>
                          <span className={styles.metaChipLabel}>Type:</span> {edibleType}
                        </span>
                      )}
                      {doseMg != null && Number.isFinite(doseMg) && (
                        <span className={styles.metaChip}>
                          <span className={styles.metaChipLabel}>THC:</span> {formatMg(doseMg)}
                        </span>
                      )}
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Time:</span> {formatTime(e.time)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Method:</span> {e.method}
                      </span>
                      {isFiniteNum(e.weight) && (
                        <span className={styles.metaChip}>
                          <span className={styles.metaChipLabel}>Weight:</span> {e.weight.toFixed(2)}g
                        </span>
                      )}
                      {showTotalThc && (
                        <span className={styles.metaChip}>
                          <span className={styles.metaChipLabel}>THC:</span> {formatPct(totalThc)}
                        </span>
                      )}
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Time:</span> {formatTime(e.time)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.right}>
                <button
                  className="btn btn-ghost"
                  onClick={() => router.push(`/entries/${e.id}/edit`)}
                  aria-label="Edit entry"
                >
                  Edit
                </button>
                <button
                  className={`btn ${styles.btnDanger} ${styles.dangerAnim}`}
                  onClick={() => handleDelete(e.id)}
                  aria-label="Delete entry"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
