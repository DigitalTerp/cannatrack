'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import typeStyles from '@/app/strains/cultivars.module.css';
import styles from './PurchaseHistory.module.css';

type StrainType = 'Indica' | 'Sativa' | 'Hybrid';

type ArchiveEntry = {
  id: string;
  time: number;
  method?: string;
  hiddenFromDaily?: boolean;
  journalType?: 'purchase-archive';
  isPurchaseArchive?: boolean;
  purchaseId?: string;

  purchaseMadeDateISO?: string | null;
  purchaseFinishedDateISO?: string | null;
  purchaseFinishedAtMs?: number | null;

  finishedDate?: string | null;

  strainName?: string;
  strainType?: StrainType;
  brand?: string;
  thcPercent?: number | null;
  thcaPercent?: number | null;

  purchaseSnapshot?: {
    totalGrams?: number;
    remainingGrams?: number;
    totalCostCents?: number;
    purchaseDate?: string | null;
  };

  wasteGrams?: number;
  wastePercent?: number;
};

function centsToDollarString(cents?: number | null) {
  if (cents == null || Number.isNaN(cents)) return '';
  return (cents / 100).toFixed(2);
}
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

  return `${label} (${grams.toFixed(2).replace(/\.00$/, "")} g)`;
}

function finishedMs(e: ArchiveEntry): number {
  if (typeof e.purchaseFinishedAtMs === 'number' && Number.isFinite(e.purchaseFinishedAtMs)) {
    return e.purchaseFinishedAtMs;
  }
  const iso = e.purchaseFinishedDateISO ?? e.finishedDate ?? null;
  if (iso) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return t;
  }
  return typeof e.time === 'number' ? e.time : 0;
}

function purchaseStartMs(e: ArchiveEntry): number | null {
  const iso = e.purchaseMadeDateISO ?? e.purchaseSnapshot?.purchaseDate ?? null;
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return t;
}

function badgeClass(t?: StrainType) {
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${typeStyles.typeBadge} ${typeStyles['type-indica']}`;
  if (key === 'sativa') return `${typeStyles.typeBadge} ${typeStyles['type-sativa']}`;
  return `${typeStyles.typeBadge} ${typeStyles['type-hybrid']}`;
}

export default function PurchaseHistory({ uid }: { uid: string }) {
  const [items, setItems] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    const base = collection(db, 'users', uid, 'entries');
    const qArchive = query(base, where('journalType', '==', 'purchase-archive'));
    const qLegacyHidden = query(base, where('hiddenFromDaily', '==', true));

    let a: ArchiveEntry[] = [];
    let b: ArchiveEntry[] = [];

    const recompute = () => {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - THIRTY_DAYS_MS;

      const legacyFiltered = b.filter((e) => e.method === 'Purchase' || e.method === 'Journal');
      const map = new Map<string, ArchiveEntry>();
      [...a, ...legacyFiltered].forEach((e) => map.set(e.id, e));

      const merged = Array.from(map.values())
        .filter((e) => finishedMs(e) >= cutoff)
        .sort((x, y) => finishedMs(y) - finishedMs(x));

      setItems(merged);
      setLoading(false);
    };

    const unsubA = onSnapshot(qArchive, (snap) => {
      a = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ArchiveEntry[];
      recompute();
    });
    const unsubB = onSnapshot(qLegacyHidden, (snap) => {
      b = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ArchiveEntry[];
      recompute();
    });

    return () => {
      unsubA();
      unsubB();
    };
  }, [uid]);

  const hasItems = items.length > 0;

  const totalSpent = useMemo(
    () => items.reduce((acc, e) => acc + (e.purchaseSnapshot?.totalCostCents ?? 0), 0),
    [items]
  );

  const totalGrams = useMemo(
    () => items.reduce((acc, e) => acc + (e.purchaseSnapshot?.totalGrams ?? 0), 0),
    [items]
  );
  const totalQtyPretty = formatWeight(totalGrams);

  async function handleRemove(entryId: string) {
    if (!uid || !entryId) return;
    const ok = confirm('Remove this archived entry?');
    if (!ok) return;
    try {
      setDeletingId(entryId);
      await deleteDoc(doc(db, 'users', uid, 'entries', entryId));
    } catch (e: any) {
      alert(e?.message || 'Remove failed.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <section className={styles.section}>
        <h2 className={styles.heading}>Finished Purchases — Last 30 Days</h2>
        <p className={styles.description}>
          A quick snapshot of what you’ve finished in the past month. For your full purchase history,
          visit the <Link href="/history" className={styles.historyLink}>History</Link> page.
        </p>
        <div className="card">
          <div className={styles.loadingText}>Loading past purchases…</div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Finished Purchases — Last 30 Days</h2>
      <p className={styles.description}>
        A quick snapshot of what you’ve finished in the past month.
        To see more, head to <Link href="/history" className={styles.historyLink}>History</Link>.
      </p>

      {!hasItems ? (
        <div className="card">
          <p className={styles.subtle}>No archived purchases in the last 30 days.</p>
        </div>
      ) : (
        <>
          <div className={styles.summaryRow}>
            <span className={`${styles.summaryPill} ${styles.pillCount}`}>
              <span className={styles.pillLabel}>Past Purchases :</span>
              <span className={styles.pillValue}>{items.length}</span>
            </span>

            {totalSpent > 0 && (
              <span className={`${styles.summaryPill} ${styles.pillSpent}`}>
                <span className={styles.pillLabel}>Spent :</span>
                <span className={styles.pillValue}>${centsToDollarString(totalSpent)}</span>
              </span>
            )}

            <span className={`${styles.summaryPill} ${styles.pillQty}`}>
              <span className={styles.pillLabel}> Total Purchased :</span>
              <span className={styles.pillValue}>{totalQtyPretty}</span>
            </span>
          </div>

          <div className={styles.grid}>
            {items.map((e) => {
              const potency = sumPotency(e.thcPercent, e.thcaPercent);

              const purchasedISO = e.purchaseMadeDateISO || e.purchaseSnapshot?.purchaseDate || null;
              const purchased = purchasedISO ? formatToMDY(purchasedISO) : null;

              const finished =
                e.purchaseFinishedDateISO
                  ? formatToMDY(e.purchaseFinishedDateISO)
                  : e.purchaseFinishedAtMs
                  ? formatToMDY(e.purchaseFinishedAtMs)
                  : e.finishedDate
                  ? formatToMDY(e.finishedDate)
                  : formatToMDY(e.time);

              const grams = e.purchaseSnapshot?.totalGrams;
              const qtyPretty = formatWeight(grams);
              const spent = e.purchaseSnapshot?.totalCostCents;

              const removing = deletingId === e.id;

              const hasWaste =
                typeof e.wasteGrams === 'number' && e.wasteGrams > 0;

              const startMs = purchaseStartMs(e);
              const endMs = finishedMs(e);
              let durationDays: number | null = null;
              if (startMs != null && endMs && endMs >= startMs) {
                durationDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
              }

              return (
                <div key={e.id} className={`card ${styles.item}`}>
                  <div className={styles.titleRow}>
                    <div className={styles.title}>{e.strainName || 'Untitled'}</div>
                    <span className={`badge ${badgeClass(e.strainType)}`}>
                      {e.strainType || 'Hybrid'}
                    </span>
                  </div>

                  {e.brand && <div className={styles.brand}>{e.brand}</div>}

                  {durationDays != null && (
                    <div className={styles.duration}>
                      Purchase Length : {durationDays} {durationDays === 1 ? 'Day' : 'Days'}
                    </div>
                  )}

                  {/* New info column layout */}
                  <div className={styles.infoColumn}>
                    {purchased && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Date Purchased :</span>
                        <span className={styles.infoPill}>{purchased}</span>
                      </div>
                    )}

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Date Finished :</span>
                      <span className={styles.infoPill}>{finished}</span>
                    </div>

                    {typeof grams === 'number' && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Quantity :</span>
                        <span className={styles.infoPill}>{qtyPretty}</span>
                      </div>
                    )}

                    {spent != null && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Spent :</span>
                        <span className={styles.infoPill}>
                          ${centsToDollarString(spent)}
                        </span>
                      </div>
                    )}

                    {(e.thcPercent != null || e.thcaPercent != null) && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>THC Potency:</span>
                        <span className={styles.infoPill}>{potency}%</span>
                      </div>
                    )}
                  </div>

                  {hasWaste && (
                    <div className={styles.wasteLine}>
                      Waste{' '}
                      <span className={styles.wasteValue}>
                        {e.wasteGrams!.toFixed(2)} g
                      </span>
                      {typeof e.wastePercent === 'number' && (
                        <span className={styles.wastePercent}>
                          {' '}
                          ({e.wastePercent.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                  )}

                  <div className={styles.footer}>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleRemove(e.id)}
                      disabled={removing}
                      aria-label="Remove archived entry"
                      title="Remove archived entry"
                    >
                      {removing ? 'Removing…' : 'REMOVE'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
