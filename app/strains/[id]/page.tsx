'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  getStrainById,
  listEntriesForStrain,
  listActivePurchasesForStrain,
  listArchivedPurchasesForStrain,
  deleteStrain,
} from '@/lib/firestore';
import type { Strain, Entry, StrainType } from '@/lib/types';
import typeStyles from '@/app/strains/cultivars.module.css';
import styles from './product.module.css';

function sumPotency(thc?: number | null, thca?: number | null) {
  const a = typeof thc === 'number' ? thc : 0;
  const b = typeof thca === 'number' ? thca : 0;
  const v = Math.round((a + b) * 10) / 10;
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}
function formatToMDY(d?: string | number | Date | null) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [yyyy, mm, dd] = d.split('-'); return `${mm}-${dd}-${yyyy}`;
  }
  const dt = new Date(d as any);
  if (Number.isNaN(dt.getTime())) return String(d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
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
function badgeClass(t?: StrainType) {
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${typeStyles.typeBadge} ${typeStyles['type-indica']}`;
  if (key === 'sativa') return `${typeStyles.typeBadge} ${typeStyles['type-sativa']}`;
  return `${typeStyles.typeBadge} ${typeStyles['type-hybrid']}`;
}

export default function CultivarProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [strain, setStrain] = useState<Strain | null>(null);
  const [loading, setLoading] = useState(true);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentPurchases, setCurrentPurchases] = useState<any[]>([]);
  const [archivedPurchases, setArchivedPurchases] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);

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
          const [es, cur, arc] = await Promise.all([
            listEntriesForStrain(user.uid, s.nameLower, s.name),
            listActivePurchasesForStrain(user.uid, s.nameLower),
            listArchivedPurchasesForStrain(user.uid, s.nameLower),
          ]);
          if (!alive) return;
          setEntries(es);
          setCurrentPurchases(cur);
          setArchivedPurchases(arc);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user, id]);

  const stats = useMemo(() => {
    const sessions = entries.length;
    const grams = entries.reduce((sum, e: any) => {
      const w = typeof e.weight === 'number' ? e.weight : Number(e.weight);
      return sum + (Number.isFinite(w) ? w : 0);
    }, 0);
    const rated = entries.filter((e: any) => typeof e.rating === 'number');
    const avgRating = rated.length
      ? Number((rated.reduce((a, e: any) => a + e.rating, 0) / rated.length).toFixed(2))
      : null;
    return { sessions, grams: Number(grams.toFixed(2)), avgRating };
  }, [entries]);

  const cultivators = useMemo(() => {
    const map = new Map<string, {
      brand: string; sessions: number; grams: number;
      ratingSum: number; ratingCount: number; potSum: number; potCount: number
    }>();
    entries.forEach((e: any) => {
      const key = (e.brandLower || 'unknown') as string;
      const brand = (e.brand || 'Unknown') as string;
      const agg = map.get(key) || { brand, sessions: 0, grams: 0, ratingSum: 0, ratingCount: 0, potSum: 0, potCount: 0 };
      agg.sessions += 1;
      agg.grams += typeof e.weight === 'number' ? e.weight : 0;
      if (typeof e.rating === 'number') { agg.ratingSum += e.rating; agg.ratingCount += 1; }
      if (typeof e.thcPercent === 'number' || typeof e.thcaPercent === 'number') {
        agg.potSum += Number(sumPotency(e.thcPercent, e.thcaPercent));
        agg.potCount += 1;
      }
      map.set(key, agg);
    });
    return Array.from(map.values())
      .map((g) => ({
        brand: g.brand,
        sessions: g.sessions,
        grams: Number(g.grams.toFixed(2)),
        avgRating: g.ratingCount ? Number((g.ratingSum / g.ratingCount).toFixed(2)) : null,
        avgPotency: g.potCount ? Number((g.potSum / g.potCount).toFixed(1)) : null,
      }))
      .sort((a, b) => (b.sessions - a.sessions) || (b.grams - a.grams));
  }, [entries]);

  if (!user) return <div className="card">Please sign in.</div>;
  if (loading) return <div className="card">Loading cultivar…</div>;
  if (!strain) return <div className="card">Cultivar not found.</div>;

  const handleDelete = async () => {
    if (!user || !strain || deleting) return;

    if (currentPurchases.length > 0) {
      alert('You still have ACTIVE purchases for this Cultivar. Finish or remove them before deleting the cultivar.');
      return;
    }

    const msg = `Delete "${strain.name}"?\n\nThis will remove the cultivar record only.\nYour past session entries will remain.\n\nThis cannot be undone.`;
    if (!confirm(msg)) return;

    try {
      setDeleting(true);
      await deleteStrain(user.uid, strain.id);
      router.push('/strains?deleted=1');
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/strains" className={styles.backLink} aria-label="Back to cultivars">
          ← Back to Cultivars
        </Link>
      </div>

      <div className={styles.infoHead}>
        <h1 className={styles.title}>{strain.name}</h1>
        <span className={`${badgeClass(strain.type)} ${styles.typeChip}`}>{strain.type}</span>
      </div>

      <div className={`card ${styles.infoCard}`}>
        <div className={styles.aboutCell}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.h2}>Cultivar Info</h2>
            <Link href={`/strains/${strain.id}/edit`} className={`btn btn-ghost ${styles.inlineEdit}`}>
              Edit
            </Link>
          </div>

          <ul className={styles.aboutList}>
            {strain.lineage && (
              <li className={styles.aboutItem}>
                <span className={styles.kvLabel}>Lineage</span>
                <span className={styles.kvText}>{strain.lineage}</span>
              </li>
            )}

            {strain.flavors?.length ? (
              <li className={styles.aboutItem}>
                <span className={styles.kvLabel}>Taste</span>
                <span className={styles.kvText}>{strain.flavors.join(', ')}</span>
              </li>
            ) : null}

            {strain.aroma?.length ? (
              <li className={styles.aboutItem}>
                <span className={styles.kvLabel}>Smell</span>
                <span className={styles.kvText}>{strain.aroma.join(', ')}</span>
              </li>
            ) : null}

            {strain.effects?.length ? (
              <li className={styles.aboutItem}>
                <span className={styles.kvLabel}>Effect</span>
                <span className={styles.kvText}>{strain.effects.join(', ')}</span>
              </li>
            ) : null}

            {typeof strain.rating === 'number' ? (
              <li className={styles.aboutItem}>
                <span className={styles.kvLabel}>Rating</span>
                <span className={styles.kvText}>{strain.rating}/10</span>
              </li>
            ) : null}

            {typeof strain.createdAt === 'number' && (
              <li className={styles.aboutItem}>
                <span className={styles.kvLabel}>Added</span>
                <span className={styles.kvText}>{formatToMDY(strain.createdAt)}</span>
              </li>
            )}

            {strain.notes ? (
              <li className={`${styles.aboutItem} ${styles.notesItem}`}>
                <span className={styles.kvLabel}>Notes</span>
                <span className={styles.kvText}>{strain.notes}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.h2}>Purchases</h2>
        </div>

        {!!currentPurchases.length && (
          <>
            <h3 className={styles.h3}>Current</h3>
            <div className={styles.cards}>
              {currentPurchases.map((p) => {
                const pct =
                  p.totalGrams > 0 ? Math.max(0, Math.min(100, (p.remainingGrams / p.totalGrams) * 100)) : 0;
                return (
                  <div key={p.id} className={`card ${styles.purchaseCard}`}>
                    <div className={styles.cardRowTight}>
                      <span className={`${styles.statePill} ${styles.pillActive}`}>ACTIVE</span>
                    </div>

                    <div className={styles.statLine}>
                      <span className={styles.statLabel}>Quantity</span>
                      <span className={`badge ${styles.statBadge}`}>{formatWeight(p.totalGrams)}</span>
                      <span className={styles.statLabel}>Remaining</span>
                      <span className={`badge ${styles.statBadge}`}>{formatWeight(p.remainingGrams)}</span>
                    </div>

                    <div className={styles.progressOuter}>
                      <div className={styles.progressInner} style={{ width: `${pct}%` }} />
                    </div>

                    <div className={styles.statLine}>
                      <span className={styles.statLabel}>Purchased</span>
                      <span className={`badge ${styles.statBadge}`}>{formatToMDY(p.purchaseDate)}</span>
                      {typeof p.totalCostCents === 'number' && (
                        <>
                          <span className={styles.statLabel}>Spent</span>
                          <span className={`badge ${styles.statBadge}`}>${(p.totalCostCents/100).toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!!archivedPurchases.length && (
          <>
            <h3 className={styles.h3}>Finished</h3>
            <div className={styles.cards}>
              {archivedPurchases.map((a) => (
                <div key={a.id} className={`card ${styles.purchaseCard}`}>
                  <div className={styles.cardRowTight}>
                    <span className={`${styles.statePill} ${styles.pillDone}`}>FINISHED</span>
                  </div>

                  <div className={styles.statLine}>
                    <span className={styles.statLabel}>Quantity</span>
                    <span className={`badge ${styles.statBadge}`}>{formatWeight(a.purchaseSnapshot?.totalGrams)}</span>
                    {typeof a.purchaseSnapshot?.totalCostCents === 'number' && (
                      <>
                        <span className={styles.statLabel}>Spent</span>
                        <span className={`badge ${styles.statBadge}`}>
                          ${(a.purchaseSnapshot.totalCostCents/100).toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className={styles.statLine}>
                    <span className={styles.statLabel}>Purchased</span>
                    <span className={`badge ${styles.statBadge}`}>
                      {formatToMDY(a.purchaseMadeDateISO || a.purchaseSnapshot?.purchaseDate)}
                    </span>
                    <span className={styles.statLabel}>Finished</span>
                    <span className={`badge ${styles.statBadge}`}>
                      {formatToMDY(a.purchaseFinishedDateISO || a.purchaseFinishedAtMs || a.time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.h2}>Consumption for {strain.name}</h2>
        </div>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Sessions</span>
            <span className={`badge ${styles.statBadge}`}>{stats.sessions}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total Amount Consumed</span>
            <span className={`badge ${styles.statBadge}`}>{formatWeight(stats.grams)}</span>
          </div>
          {stats.avgRating != null && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Avg Rating</span>
              <span className={`badge ${styles.statBadge}`}>{stats.avgRating}</span>
            </div>
          )}
        </div>

        {!!entries.length && (
          <div className={styles.cards}>
            {entries.map((e) => (
              <div key={e.id} className={`card ${styles.entryCard}`}>
                <div className={styles.statLine}>
                  <span className={styles.statLabel}>Method</span>
                  <span className={`badge ${styles.statBadge}`}>{e.method}</span>
                  <span className={styles.statLabel}>Date</span>
                  <span className={`badge ${styles.statBadge}`}>{formatToMDY(e.time)}</span>
                  {((e as any).thcPercent != null || (e as any).thcaPercent != null) && (
                    <>
                      <span className={styles.statLabel}>Potency</span>
                      <span className={`badge ${styles.statBadge}`}>
                        {sumPotency((e as any).thcPercent, (e as any).thcaPercent)}%
                      </span>
                    </>
                  )}
                  {typeof (e as any).weight === 'number' && (
                    <>
                      <span className={styles.statLabel}>Weight</span>
                      <span className={`badge ${styles.statBadge}`}>
                        {((e as any).weight as number).toFixed(2)} g
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.h2}> Cultivators Consumption Statics</h2>
        </div>

        {!cultivators.length ? (
          <p className="subtle" style={{ textAlign: 'center' }}>No sessions yet for this cultivar.</p>
        ) : (
          <div className={styles.cards}>
            {cultivators.map((c) => (
              <div key={c.brand} className={`card ${styles.brandCard}`}>
                <div className={styles.brandHeader}>
                  <strong className={styles.brandName}>{c.brand}</strong>
                </div>
                <div className={styles.statLine}>
                  <span className={styles.pair}>
                    <span className={styles.statLabel}>Sessions</span>
                    <span className={`badge ${styles.statBadge}`}>{c.sessions}</span>
                  </span>

                  <span className={styles.pair}>
                    <span className={styles.statLabel}>Total</span>
                    <span className={`badge ${styles.statBadge}`}>{formatWeight(c.grams)}</span>
                  </span>

                  {c.avgPotency != null && (
                    <span className={`${styles.pair} ${styles.pairBreakSm}`}>
                      <span className={styles.statLabel}>Potency</span>
                      <span className={`badge ${styles.statBadge}`}>{c.avgPotency}%</span>
                    </span>
                  )}

                  {c.avgRating != null && (
                    <span className={styles.pair}>
                      <span className={styles.statLabel}>Avg rating</span>
                      <span className={`badge ${styles.statBadge}`}>{c.avgRating}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={styles.dangerZone}>
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          disabled={deleting}
          aria-disabled={deleting}
          aria-label="Delete cultivar"
        >
          {deleting ? 'Removing…' : 'REMOVE'}
        </button>
        <p className={styles.deleteHint}>
          Removes the Cultivar Record Only. Sessions Remain.
        </p>
      </div>
    </div>
  );
}
