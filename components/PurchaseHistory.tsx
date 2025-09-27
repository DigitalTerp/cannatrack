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
              <span className={styles.pillLabel}>Past Purchases</span>
              <span className={styles.pillValue}>{items.length}</span>
            </span>

            {totalSpent > 0 && (
              <span className={`${styles.summaryPill} ${styles.pillSpent}`}>
                <span className={styles.pillLabel}>Spent</span>
                <span className={styles.pillValue}>${centsToDollarString(totalSpent)}</span>
              </span>
            )}

            <span className={`${styles.summaryPill} ${styles.pillQty}`}>
              <span className={styles.pillLabel}>Purchased</span>
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

              return (
                <div key={e.id} className={`card ${styles.item}`}>
                  <div className={styles.titleRow}>
                    <div className={styles.title}>{e.strainName || 'Untitled'}</div>
                    <span className={`badge ${badgeClass(e.strainType)}`}>{e.strainType || 'Hybrid'}</span>
                  </div>

                  {e.brand && <div className={styles.brand}>{e.brand}</div>}

                  <div className={styles.meta}>
                    {purchased && (
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Purchased:</span> {purchased}
                      </span>
                    )}
                    <span className={styles.metaChip}>
                      <span className={styles.metaChipLabel}>Finished:</span> {finished}
                    </span>
                  </div>

                  <div className={styles.stats}>
                    {typeof grams === 'number' && (
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Quantity:</span> {qtyPretty}
                      </span>
                    )}
                    {spent != null && (
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>Spent:</span> ${centsToDollarString(spent)}
                      </span>
                    )}
                    {(e.thcPercent != null || e.thcaPercent != null) && (
                      <span className={styles.metaChip}>
                        <span className={styles.metaChipLabel}>THC:</span> {potency}%
                      </span>
                    )}
                  </div>

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
