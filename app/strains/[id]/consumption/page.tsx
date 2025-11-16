'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getStrainById, listEntriesForStrain } from '@/lib/firestore';
import type { Strain, Entry } from '@/lib/types';
import styles from './consumption.module.css';

function formatToMDY(d?: string | number | Date | null) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [yyyy, mm, dd] = d.split('-');
    return `${mm}-${dd}-${yyyy}`;
  }
  const dt = new Date(d as any);
  if (Number.isNaN(dt.getTime())) return String(d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

function sumPotency(thc?: number | null, thca?: number | null) {
  const a = typeof thc === 'number' ? thc : 0;
  const b = typeof thca === 'number' ? thca : 0;
  const v = Math.round((a + b) * 10) / 10;
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}

const G_PER_OZ = 28;

function formatWeight(g?: number | null) {
  const grams = Math.max(0, Number(g || 0));
  if (grams >= G_PER_OZ) {
    const oz = Math.floor(grams / G_PER_OZ);
    const rem = +(grams % G_PER_OZ).toFixed(2);
    return rem > 0 ? `${oz} oz + ${rem} g` : `${oz} oz`;
  }
  return `${+grams.toFixed(2)} g`;
}

export default function CultivarConsumptionReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [strain, setStrain] = useState<Strain | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !id) return;

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const s = await getStrainById(user.uid, String(id));
        if (!alive) return;
        setStrain(s);

        if (s) {
          const es = await listEntriesForStrain(user.uid, s.nameLower, s.name);
          if (!alive) return;
          setEntries(es);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, id]);

  const summary = useMemo(() => {
    if (!entries.length) {
      return {
        sessions: 0,
        grams: 0,
        avgRating: null as number | null,
        firstDate: null as string | null,
        lastDate: null as string | null,
      };
    }

    const sorted = [...entries].sort((a, b) => (a.time as number) - (b.time as number));

    const grams = entries.reduce((sum, e: any) => {
      const w =
        typeof e.weight === 'number'
          ? e.weight
          : typeof e.weight === 'string'
          ? Number(e.weight)
          : 0;
      return sum + (Number.isFinite(w) ? w : 0);
    }, 0);

    const rated = entries.filter((e: any) => typeof e.rating === 'number');
    const avgRating = rated.length
      ? Number(
          (rated.reduce((a, e: any) => a + e.rating, 0) / rated.length).toFixed(2)
        )
      : null;

    const firstDate = sorted[0]?.time ? formatToMDY(sorted[0].time) : null;
    const lastDate =
      sorted[sorted.length - 1]?.time
        ? formatToMDY(sorted[sorted.length - 1].time)
        : null;

    return {
      sessions: entries.length,
      grams: Number(grams.toFixed(2)),
      avgRating,
      firstDate,
      lastDate,
    };
  }, [entries]);

  const methods = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e: any) => {
      if (e.method) set.add(e.method as string);
    });
    return Array.from(set).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (methodFilter === 'ALL')
      return [...entries].sort((a, b) => (b.time as number) - (a.time as number));
    return [...entries]
      .filter((e: any) => e.method === methodFilter)
      .sort((a, b) => (b.time as number) - (a.time as number));
  }, [entries, methodFilter]);

  if (!user) {
    return <div className="card">Please sign in.</div>;
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.backRow}>
          <button type="button" className={styles.backLink} onClick={() => router.back()}>
            ← Back
          </button>
        </div>
        <div className="card">
          <div className={styles.loadingText}>Loading consumption report…</div>
        </div>
      </div>
    );
  }

  if (!strain) {
    return (
      <div className={styles.page}>
        <div className={styles.backRow}>
          <Link href="/strains" className={styles.backLink}>
            ← Back to Cultivars
          </Link>
        </div>
        <div className="card">Cultivar not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link
          href={`/strains/${strain.id}`}
          className={styles.backLink}
          aria-label="Back to cultivar"
        >
          ← Back to {strain.name}
        </Link>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>Consumption Report — {strain.name}</h1>
      </header>

      <section className={`card ${styles.summaryCard}`}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Sessions</span>
            <span className={styles.summaryValue}>{summary.sessions}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Consumed</span>
            <span className={styles.summaryValue}>{formatWeight(summary.grams)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Avg Rating</span>
            <span className={styles.summaryValue}>
              {summary.avgRating != null ? summary.avgRating : '—'}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Date Range</span>
            <span className={styles.summaryValue}>
              {summary.firstDate && summary.lastDate ? (
                <>
                  {summary.firstDate} →
                  <br />
                  {summary.lastDate}
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.filtersRow}>
        <div className={styles.filterGroup}>
          <label htmlFor="methodFilter" className={styles.filterLabel}>
            Method
          </label>
          <select
            id="methodFilter"
            className={styles.filterSelect}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="ALL">All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterHint}>
          Showing {filteredEntries.length} session
          {filteredEntries.length === 1 ? '' : 's'}
          {methodFilter !== 'ALL' ? ` for ${methodFilter}` : ''}.
        </div>
      </section>

      <section className={`card ${styles.tableCard}`}>
        {!filteredEntries.length ? (
          <p className={styles.emptyText}>No sessions logged yet for this view.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Cultivator</th>
                  <th>Amount</th>
                  <th>Potency</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e) => {
                  const anyPotency =
                    (e as any).thcPercent != null || (e as any).thcaPercent != null;
                  const potency = anyPotency
                    ? `${sumPotency(
                        (e as any).thcPercent,
                        (e as any).thcaPercent
                      )}%`
                    : '—';

                  const w =
                    typeof (e as any).weight === 'number'
                      ? (e as any).weight
                      : typeof (e as any).weight === 'string'
                      ? Number((e as any).weight)
                      : null;

                  const weightLabel =
                    w != null && Number.isFinite(w) ? `${w.toFixed(2)} g` : '—';

                  const brand =
                    (e as any).brand && typeof (e as any).brand === 'string'
                      ? (e as any).brand
                      : '—';

                  return (
                    <tr key={e.id}>
                      <td>{formatToMDY(e.time)}</td>
                      <td>{(e as any).method || '—'}</td>
                      <td>{brand}</td>
                      <td>{weightLabel}</td>
                      <td>{potency}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
