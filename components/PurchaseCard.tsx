'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { runTransaction, doc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './PurchaseCard.module.css';

type StrainType = 'Indica' | 'Sativa' | 'Hybrid';

type Purchase = {
  id: string;
  strainName: string;
  strainType?: StrainType;
  lineage?: string;
  brand?: string;
  thcPercent?: number | null;
  thcaPercent?: number | null;
  totalGrams: number;
  remainingGrams: number;
  totalCostCents?: number;
  purchaseDate?: string; 
  status?: 'active' | 'depleted';
  updatedAt?: number;
};

type Props = {
  uid: string;
  purchase: Purchase;
  onLogSession?: (purchase: Purchase) => void;
  onChanged?: () => void;
};

const G_PER_OZ = 28;

function formatWeight(g: number) {
  if (g >= G_PER_OZ) {
    const oz = Math.floor(g / G_PER_OZ);
    const rem = +(g % G_PER_OZ).toFixed(2);
    return rem > 0 ? `${oz} oz + ${rem} g` : `${oz} oz`;
  }
  return `${+g.toFixed(2)} g`;
}
function centsToDollarString(cents?: number) {
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

function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export default function PurchaseCard({ uid, purchase, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  const pct = useMemo(() => {
    if (!purchase.totalGrams) return 0;
    return Math.max(0, Math.min(100, (purchase.remainingGrams / purchase.totalGrams) * 100));
  }, [purchase.totalGrams, purchase.remainingGrams]);

  const isLow = purchase.remainingGrams < 1 || pct < 20;
  const depleted = purchase.remainingGrams <= 0;

  const unitPrice =
    purchase.totalCostCents && purchase.totalGrams > 0
      ? (purchase.totalCostCents / 100) / purchase.totalGrams
      : undefined;

  const hasAnyPotency =
    typeof purchase.thcPercent === 'number' || typeof purchase.thcaPercent === 'number';
  const totalPotency = hasAnyPotency ? sumPotency(purchase.thcPercent, purchase.thcaPercent) : null;

  async function logArchiveEntry(finishedDateISO: string) {
    const title = purchase.strainName || 'Untitled';
    const nowMs = Date.now();

    const entry = cleanUndefined({
      userId: uid,
      time: nowMs,
      method: 'Purchase',
      journalType: 'purchase-archive',
      isPurchaseArchive: true,
      hiddenFromDaily: true,

      purchaseMadeDateISO: purchase.purchaseDate || null,
      purchaseFinishedDateISO: finishedDateISO,
      purchaseFinishedAtMs: nowMs,

      strainName: title,
      strainNameLower: title.toLowerCase(),
      strainType: purchase.strainType || 'Hybrid',
      brand: purchase.brand || undefined,
      brandLower: purchase.brand ? purchase.brand.toLowerCase() : undefined,
      lineage: purchase.lineage || undefined,
      ...(typeof purchase.thcPercent === 'number' ? { thcPercent: purchase.thcPercent } : {}),
      ...(typeof purchase.thcaPercent === 'number' ? { thcaPercent: purchase.thcaPercent } : {}),

      purchaseId: purchase.id,
      purchaseSnapshot: cleanUndefined({
        totalGrams: purchase.totalGrams,
        remainingGrams: purchase.remainingGrams,
        totalCostCents: purchase.totalCostCents ?? 0,
        purchaseDate: purchase.purchaseDate || null,
      }),

      notes: undefined,

      createdAt: nowMs,
      updatedAt: nowMs,
    });

    await addDoc(collection(db, 'users', uid, 'entries'), entry);
  }

  async function finishAndArchive() {
    if (!uid || !purchase.id) return;
    const pref = doc(db, 'users', uid, 'purchases', purchase.id);
    const finishedDateISO = new Date().toISOString().slice(0, 10);

    try {
      setBusy(true);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(pref);
        if (!snap.exists()) throw new Error('Purchase not found');
        const p = snap.data() as any;
        if ((p.remainingGrams ?? 0) > 0 || p.status !== 'depleted') {
          tx.update(pref, {
            remainingGrams: 0,
            status: 'depleted',
            updatedAt: Date.now(),
          });
        }
      });

      await logArchiveEntry(finishedDateISO);
      await deleteDoc(pref);
      onChanged?.();
    } catch (err: any) {
      alert(err?.message || 'Finish & archive failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.row}>
        <div className={styles.left}>
          <div className={styles.nameLine}>
            <strong className={styles.name}>{purchase.strainName}</strong>
          </div>
          {purchase.brand && <div className={styles.brand}>{purchase.brand}</div>}
          {purchase.lineage && <div className={styles.lineage}>Lineage: {purchase.lineage}</div>}
        </div>

        <div className={styles.right}>
          {!depleted && isLow && (
            <span className={`${styles.stateBadge} ${styles.badgeLow}`}>LOW AMOUNT</span>
          )}
          {depleted && <span className={`${styles.stateBadge} ${styles.badgeDepleted}`}>Depleted</span>}

          <div className={styles.quantities}>
            <div>Purchased: {formatWeight(purchase.totalGrams)}</div>
            <div>
              Remaining: <strong>{formatWeight(purchase.remainingGrams)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.infoCenter}>
        {purchase.purchaseDate && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Purchased:</span>
            <span className={styles.valuePill}>{formatToMDY(purchase.purchaseDate)}</span>
          </span>
        )}
        {hasAnyPotency && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>THC:</span>
            <span className={styles.valuePill}>{totalPotency}%</span>
          </span>
        )}
        {purchase.totalCostCents != null && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Spent:</span>
            <span className={styles.valuePill}>${centsToDollarString(purchase.totalCostCents)}</span>
          </span>
        )}
        {unitPrice != null && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Unit:</span>
            <span className={styles.valuePill}>~${unitPrice.toFixed(2)}/g</span>
          </span>
        )}
      </div>

      <div className={styles.progressOuter}>
        <div className={styles.progressInner} style={{ width: `${pct}%` }} />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btn}
          onClick={finishAndArchive}
          disabled={busy}
          aria-label="Finish and archive this purchase"
        >
          {busy ? 'Working…' : 'Finish & Archive'}
        </button>

        <Link
          href={`/purchases/${purchase.id}/edit`}
          className={`${styles.btn} ${styles.btnGhost}`}
          aria-label="Edit purchase"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
