'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { listStrains } from '@/lib/firestore';
import type { Strain } from '@/lib/types';
import styles from './cultivars.module.css';

function fmtDate(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function typeClassName(t?: string) {
  const base = `badge ${styles.typeBadge}`;
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${base} ${styles['type-indica']}`;
  if (key === 'sativa') return `${base} ${styles['type-sativa']}`;
  return `${base} ${styles['type-hybrid']}`;
}

export default function CultivarsPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const [strains, setStrains] = useState<Strain[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      router.push('/login?next=/strains');
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const s = await listStrains(uid);
        setStrains(s);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load cultivars.');
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady, uid, router]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return strains;
    return strains.filter((s) =>
      s.name.toLowerCase().includes(term) ||
      (s.brand ?? '').toLowerCase().includes(term) ||
      (s.lineage ?? '').toLowerCase().includes(term)
    );
  }, [q, strains]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const an = (a as any).nameLower ?? a.name.toLowerCase();
      const bn = (b as any).nameLower ?? b.name.toLowerCase();
      const cmp = an.localeCompare(bn);
      if (cmp !== 0) return cmp;
      const ab = (a.brand ?? '').toLowerCase();
      const bb = (b.brand ?? '').toLowerCase();
      return ab.localeCompare(bb);
    });
    return arr;
  }, [filtered]);

  if (!authReady) {
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-hero">
        <h1 className={styles.pageTitle}>Cultivars</h1>
        <p className={`subtle ${styles.pageSubtitle}`}>
          A clean list of every Cultivar you’ve saved. Use <em>View</em> to see Cultivar information and statics.
        </p>
        <div className="actions">
          <input
            className="input"
            placeholder="Search by Cultivar, Lineage…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="card">Loading your cultivar library…</div>}
      {err && (
        <div className="card">
          <p className="error">{err}</p>
        </div>
      )}
      {!loading && !err && sorted.length === 0 && (
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>No cultivars match your search.</p>
        </div>
      )}

      {!loading && !err && sorted.length > 0 && (
        <ul className={`${styles.list} ${styles.rowsStandalone}`} role="list">
          {sorted.map((s) => (
            <li key={s.id} className={`card ${styles.row}`} role="listitem">

<div className={`${styles.cell} ${styles.cellName}`}>
  <div className={styles.nameRow}>
    <div className={styles.cultivarName}>{s.name}</div>

    <span className={`${typeClassName(s.type)} ${styles.badgeMobile}`}>{s.type}</span>
  </div>
</div>


<div className={`${styles.cell} ${styles.cellType}`}>
  <span className={typeClassName(s.type)}>{s.type}</span>
</div>



              <div className={`${styles.cell} ${styles.cellLineage}`}>
                {s.lineage || '—'}
              </div>

              <div className={`${styles.cell} ${styles.cellAdded}`}>
                {fmtDate(s.createdAt)}
              </div>

              <div className={styles.actionsRow}>
                <a
                  href={`/strains/${s.id}`}
                  onClick={(e) => { e.preventDefault(); router.push(`/strains/${s.id}`); }}
                  className={styles.linkBtn}
                  aria-label={`View ${s.name}`}
                >
                  View
                </a>
              
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
