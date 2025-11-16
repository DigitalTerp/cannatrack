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
const DAY_MS = 24 * 60 * 60 * 1000;

const G_PER_OZ = 28;
const FRACTIONS = [
  { g: 3.5,  frac: "⅛"  },
  { g: 7,    frac: "¼"  },
  { g: 14,   frac: "½"  },
  { g: 21,   frac: "¾"  },
];

function formatWeight(g?: number | null) {
  const gramsRaw = Number(g ?? 0);
  const grams = Math.max(0, gramsRaw);
  if (!Number.isFinite(grams)) return "0 g";

  if (grams < G_PER_OZ) {
    const match = FRACTIONS.find(f => Math.abs(grams - f.g) < 0.01);
    if (match) return `${match.frac} oz (${match.g} g)`;

    return `${grams.toFixed(2).replace(/\.00$/, "")} g`;
  }

  const fullOz = Math.floor(grams / G_PER_OZ);
  const remainder = grams - fullOz * G_PER_OZ;

  let fraction = "";
  const match = FRACTIONS.find(f => Math.abs(remainder - f.g) < 0.01);
  if (match) fraction = match.frac + " ";
  const label =
    fraction
      ? `${fullOz} ${fraction}oz`
      : `${fullOz} oz`;

  return `${label} ( ${grams.toFixed(2).replace(/\.00$/, "")}g )`;
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
    return () => {
      alive = false;
    };
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
    const map = new Map<
      string,
      {
        brand: string;
        sessions: number;
        grams: number;
        ratingSum: number;
        ratingCount: number;
        potSum: number;
        potCount: number;
      }
    >();
    entries.forEach((e: any) => {
      const key = (e.brandLower || 'unknown') as string;
      const brand = (e.brand || 'Unknown') as string;
      const agg =
        map.get(key) || {
          brand,
          sessions: 0,
          grams: 0,
          ratingSum: 0,
          ratingCount: 0,
          potSum: 0,
          potCount: 0,
        };
      agg.sessions += 1;
      agg.grams += typeof e.weight === 'number' ? e.weight : 0;
      if (typeof e.rating === 'number') {
        agg.ratingSum += e.rating;
        agg.ratingCount += 1;
      }
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
      .sort((a, b) => b.sessions - a.sessions || b.grams - a.grams);
  }, [entries]);

  const methodStats = useMemo(() => {
    if (!entries.length) return [] as { method: string; sessions: number; grams: number; pct: number }[];

    const map = new Map<string, { sessions: number; grams: number }>();
    entries.forEach((e: any) => {
      const method = (e.method as string) || 'Unknown';
      const w =
        typeof e.weight === 'number'
          ? e.weight
          : typeof e.weight === 'string'
          ? Number(e.weight)
          : 0;
      const grams = Number.isFinite(w) ? w : 0;

      const agg = map.get(method) || { sessions: 0, grams: 0 };
      agg.sessions += 1;
      agg.grams += grams;
      map.set(method, agg);
    });

    const arr = Array.from(map.entries()).map(([method, v]) => ({
      method,
      sessions: v.sessions,
      grams: Number(v.grams.toFixed(2)),
    }));

    const maxGrams = arr.reduce((max, v) => Math.max(max, v.grams), 0) || 1;

    return arr.map((v) => ({
      ...v,
      pct: (v.grams / maxGrams) * 100,
    }));
  }, [entries]);

  if (!user) return <div className="card">Please sign in.</div>;
  if (loading) return <div className="card">Loading cultivar…</div>;
  if (!strain) return <div className="card">Cultivar not found.</div>;

  const handleDelete = async () => {
    if (!user || !strain || deleting) return;

    if (currentPurchases.length > 0) {
      alert(
        'You still have ACTIVE purchases for this Cultivar. Finish or remove them before deleting the cultivar.'
      );
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
            <Link
              href={`/strains/${strain.id}/edit`}
              className={`btn btn-ghost ${styles.inlineEdit}`}
            >
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
                  p.totalGrams > 0
                    ? Math.max(0, Math.min(100, (p.remainingGrams / p.totalGrams) * 100))
                    : 0;

                return (
                  <div key={p.id} className={`card ${styles.purchaseCard}`}>
                    <div className={styles.infoColumn}>
                        <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Purchased Date :</span>
                        <span className={styles.infoPill}>{formatToMDY(p.purchaseDate)}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Purchased Quantity :</span>
                        <span className={styles.infoPill}>{formatWeight(p.totalGrams)}</span>
                      </div>
                                              {typeof p.totalCostCents === 'number' && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Spent</span>
                          <span className={styles.infoPill}>
                            ${(p.totalCostCents / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className={styles.progressOuter}>
                      <div className={styles.progressInner} style={{ width: `${pct}%` }} />
                    </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Remaining Quantity :</span>
                        <span className={styles.infoPill}>{formatWeight(p.remainingGrams)}</span>
                      </div>
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
      {archivedPurchases.map((a) => {
        const grams = a.purchaseSnapshot?.totalGrams;
        const spent = a.purchaseSnapshot?.totalCostCents;

        const purchasedISO =
          a.purchaseMadeDateISO || a.purchaseSnapshot?.purchaseDate || null;
        const finishedISOorMs =
          a.purchaseFinishedDateISO ?? a.purchaseFinishedAtMs ?? a.time;

        const purchasedPretty = purchasedISO ? formatToMDY(purchasedISO) : null;
        const finishedPretty = finishedISOorMs ? formatToMDY(finishedISOorMs) : null;

        let durationDays: number | null = null;
        let startMs: number | null = null;
        let endMs: number | null = null;

        if (purchasedISO) {
          const t = Date.parse(purchasedISO);
          if (!Number.isNaN(t)) startMs = t;
        }
        if (typeof finishedISOorMs === 'number') {
          endMs = finishedISOorMs;
        } else if (finishedISOorMs) {
          const t2 = Date.parse(finishedISOorMs as string);
          if (!Number.isNaN(t2)) endMs = t2;
        }
        if (startMs != null && endMs != null && endMs >= startMs) {
          durationDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
        }

        const wasteGrams =
          typeof a.wasteGrams === 'number' ? a.wasteGrams : null;
        const wastePercent =
          typeof a.wastePercent === 'number' ? a.wastePercent : null;

        return (
          <div key={a.id} className={`card ${styles.purchaseCard}`}>
            <div className={styles.infoColumn}>
              {typeof grams === 'number' && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Quantity :</span>
                  <span className={styles.infoPill}>{formatWeight(grams)}</span>
                </div>
              )}

              {spent != null && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Spent :</span>
                  <span className={styles.infoPill}>
                    ${(spent / 100).toFixed(2)}
                  </span>
                </div>
              )}
                {durationDays != null && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Purchase Length :</span>
                  <span className={styles.infoPill}>
                    {durationDays} {durationDays === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
              )}

              {purchasedPretty && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Purchased Date :</span>
                  <span className={styles.infoPill}>{purchasedPretty}</span>
                </div>
              )}

              {finishedPretty && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Finished Date :</span>
                  <span className={styles.infoPill}>{finishedPretty}</span>
                </div>
              )}

              {wasteGrams != null && wasteGrams > 0 && (
                <>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Waste** :</span>
                    <span className={styles.infoPill}>
                      {wasteGrams.toFixed(2)} g
                      {typeof wastePercent === 'number'
                        ? ` (${wastePercent.toFixed(2)}%)`
                        : ''}
                    </span>
                  </div>
                  <div className={styles.wasteNoteInline}>
                    ** Waste includes leftover material you didn&apos;t consume,
                    or stems, seeds, or other unusable bits.
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
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
          <div className={`card ${styles.methodsCard}`}>
            <h3 className={styles.h3Sub}>Methods & Amounts</h3>

            {!methodStats.length ? (
              <p className={styles.subtle}>No method data yet.</p>
            ) : (
              <div className={styles.methodList}>
                {methodStats.map((m) => (
                  <div key={m.method} className={styles.methodRow}>
                    <div className={styles.methodHeader}>
                      <span className={styles.methodName}>{m.method}</span>
                      <span className={styles.methodMeta}>
                        {m.sessions} Sessions · {m.grams.toFixed(2)} g
                      </span>
                    </div>
                    <div className={styles.methodBarOuter}>
                      <div
                        className={styles.methodBarInner}
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.methodFooter}>
              <Link
                href={`/strains/${strain.id}/consumption`}
                className={`btn btn-ghost ${styles.methodsLink}`}
              >
                View Full Consumption Log →
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.h2}>Cultivators Consumption Statics</h2>
        </div>

        {!cultivators.length ? (
          <p className="subtle" style={{ textAlign: 'center' }}>
            No sessions yet for this cultivar.
          </p>
        ) : (
          <div className={styles.cards}>
            {cultivators.map((c) => (
              <div key={c.brand} className={`card ${styles.brandCard}`}>
                <div className={styles.brandHeader}>
                  <strong className={styles.brandName}>{c.brand}</strong>
                </div>

                <div className={styles.infoColumn}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Sessions</span>
                    <span className={styles.infoPill}>{c.sessions}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Total</span>
                    <span className={styles.infoPill}>{formatWeight(c.grams)}</span>
                  </div>

                  {c.avgPotency != null && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Avg Potency</span>
                      <span className={styles.infoPill}>{c.avgPotency}%</span>
                    </div>
                  )}

                  {c.avgRating != null && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Avg Rating</span>
                      <span className={styles.infoPill}>{c.avgRating}</span>
                    </div>
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
