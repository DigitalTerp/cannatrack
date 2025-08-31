'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { listStrains, listAllEntries, deleteStrain } from '@/lib/firestore';
import type { Entry, Strain } from '@/lib/types';
import styles from './cultivars.module.css';

/* Helpers */
function fmtDate(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return '...';
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function typeClassName(t?: string) {
  const base = `badge ${styles.typeBadge}`;
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${base} ${styles['type-indica']}`;
  if (key === 'sativa') return `${base} ${styles['type-sativa']}`;
  return `${base} ${styles['type-hybrid']}`;
}
function totalThc(thc?: number, thca?: number): string {
  const t = (typeof thc === 'number' ? thc : 0) + (typeof thca === 'number' ? thca : 0);
  return t > 0 ? `${Math.round(t * 10) / 10}% THC` : '...';
}
function valOrDots<T>(v: T | undefined | null, fmt?: (x: T) => string): string {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) return '...';
  return fmt ? fmt(v) : String(v);
}

/** Build meta by cultivar key (nameLower|brandLower): latest entry + unique methods */
function buildMeta(entries: Entry[]) {
  const map = new Map<string, { latest?: Entry; methods: Set<string> }>();
  for (const e of entries) {
    const nameLower = (e as any).strainNameLower ?? e.strainName?.toLowerCase?.() ?? '';
    const brandLower = (e as any).brandLower ?? (e.brand ?? '').toLowerCase();
    const key = `${nameLower}|${brandLower}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { latest: e, methods: new Set(e.method ? [e.method] : []) });
      continue;
    }
    if (!existing.latest || (e.time ?? 0) > (existing.latest.time ?? 0)) existing.latest = e;
    if (e.method) existing.methods.add(e.method);
  }
  return map;
}

export default function CultivarsPage() {
  const router = useRouter();

  // auth gating
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // data
  const [strains, setStrains] = useState<Strain[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  // only decide to redirect AFTER auth is known
  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      router.push('/login?next=/strains');
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const [s, e] = await Promise.all([listStrains(uid), listAllEntries(uid)]);
        setStrains(s);
        setEntries(e);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load cultivars.');
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady, uid, router]);

  const metaByKey = useMemo(() => buildMeta(entries), [entries]);

  // search filter
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return strains;
    return strains.filter(s =>
      s.name.toLowerCase().includes(term) ||
      (s.brand ?? '').toLowerCase().includes(term) ||
      (s.lineage ?? '').toLowerCase().includes(term)
    );
  }, [q, strains]);

  // A→Z by cultivar name, then cultivator
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

  async function handleDeleteStrain(id: string) {
    if (!uid) {
      router.push('/login?next=/strains');
      return;
    }
    const ok = confirm('Remove this cultivar from your library? This does not delete past sessions.');
    if (!ok) return;
    try {
      await deleteStrain(uid, id);
      setStrains(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Remove failed.');
    }
  }

  const handleEdit = (id: string) => {
    router.push(`/strains/${id}/edit`);
  };

  if (!authReady) return <div className="container"><div className="card">Loading…</div></div>;

  return (
    <div className="container">
      <div className="page-hero">
        <h1 style={{ marginTop: 0 }}>Cultivars</h1>
        <div className="actions">
          <input
            className="input"
            placeholder="Search by Cultivars, Cultivators, Lineage…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="card">Loading your cultivar library…</div>}
      {err && <div className="card"><p className="error">{err}</p></div>}
      {!loading && !err && sorted.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>No cultivars match your search.</p></div>
      )}

      <div className={styles.grid}>
        {sorted.map((s) => {
          const key = `${s.nameLower}|${(s.brand ?? '').toLowerCase()}`;
          const meta = metaByKey.get(key);
          const last = meta?.latest;

          // Prefer cultivar fields; fallback to latest entry fields
          const rating = (typeof s.rating === 'number')
            ? s.rating
            : (typeof last?.rating === 'number' ? last.rating : undefined);

          const effects = (Array.isArray(s.effects) && s.effects.length > 0)
            ? s.effects
            : (Array.isArray(last?.effects) ? last.effects : []);

          const flavors = (Array.isArray(s.flavors) && s.flavors.length > 0)
            ? s.flavors
            : (Array.isArray(last?.flavors) ? last.flavors : []);

          const aroma = (Array.isArray(s.aroma) && s.aroma.length > 0)
            ? s.aroma
            : (Array.isArray(last?.aroma) ? last.aroma : []);

          const notes = (typeof s.notes === 'string' && s.notes.trim() !== '')
            ? s.notes
            : (typeof last?.notes === 'string' ? last.notes : undefined);

          return (
            <div className={`card ${styles.cultivarCard}`} key={s.id}>
              <div className={styles.headerRow}>
                <h3 className={styles.name}>{s.name}</h3>
                <span className={typeClassName(s.type)}>{s.type}</span>
              </div>

              <div className={styles.kvList}>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Cultivator</span>
                  <span className={styles.kvValue}>{valOrDots(s.brand)}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Testing</span>
                  <span className={styles.kvValue}>{totalThc(s.thcPercent, s.thcaPercent)}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Lineage</span>
                  <span className={styles.kvValue}>{valOrDots(s.lineage)}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Rating</span>
                  <span className={styles.kvValue}>{rating !== undefined ? `${rating}/10` : '...'}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Effects</span>
                  <span className={styles.kvValue}>{effects.length ? effects.join(', ') : '...'}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Flavors</span>
                  <span className={styles.kvValue}>{flavors.length ? flavors.join(', ') : '...'}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Smells</span>
                  <span className={styles.kvValue}>{aroma.length ? aroma.join(', ') : '...'}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Notes</span>
                  <span className={styles.kvValue}>{valOrDots(notes)}</span>
                </div>

                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Added</span>
                  <span className={styles.kvValue}>{fmtDate(s.createdAt)}</span>
                </div>
              </div>

              <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
                <a
                  href={`/strains/${s.id}/edit`}
                  onClick={(e) => { e.preventDefault(); handleEdit(s.id); }}
                  aria-label={`Edit ${s.name}`}
                >
                  Edit
                </a>

                <button
                  className="btn btn-ghost logout-btn"
                  onClick={() => handleDeleteStrain(s.id)}
                  aria-label={`Delete ${s.name}`}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
