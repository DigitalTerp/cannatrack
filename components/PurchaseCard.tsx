'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { runTransaction, doc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './PurchaseCard.module.css';

type StrainType = 'Indica' | 'Sativa' | 'Hybrid';
type SmokeableKind = 'Flower' | 'Concentrate';
type ConcentrateCategory = 'Cured' | 'Live Resin' | 'Live Rosin';
type ConcentrateForm =
  | 'Badder'
  | 'Sugar'
  | 'Diamonds and Sauce'
  | 'Crumble'
  | 'Hash Rosin'
  | 'Temple Ball'
  | 'Jam'
  | 'Full Melt'
  | 'Bubble Hash';

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
  wasteGrams?: number;
  wastePercent?: number;

  smokeableKind?: SmokeableKind;
  concentrateCategory?: ConcentrateCategory;
  concentrateForm?: ConcentrateForm;
};

type Props = {
  uid: string;
  purchase: Purchase;
  onLogSession?: (purchase: Purchase) => void;
  onChanged?: () => void;
};

const G_PER_OZ = 28;

function formatWeight(g: number) {
  const grams = Number(g || 0);
  if (grams >= G_PER_OZ) {
    const oz = Math.floor(grams / G_PER_OZ);
    const rem = +(grams % G_PER_OZ).toFixed(2);
    return rem > 0 ? `${oz} oz + ${rem} g` : `${oz} oz`;
  }
  return `${+grams.toFixed(2)} g`;
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

function buildProductTypeParts(p: Purchase): {
  kind: SmokeableKind;
  label: string;
  detail?: string;
} {
  const kind = p.smokeableKind || 'Flower';

  if (kind === 'Flower') {
    return { kind, label: 'Flower' };
  }

  const details: string[] = [];
  if (p.concentrateCategory) details.push(p.concentrateCategory);
  if (p.concentrateForm) details.push(p.concentrateForm);

  return {
    kind,
    label: 'Concentrate',
    detail: details.length ? details.join(' • ') : undefined,
  };
}

export default function PurchaseCard({ uid, purchase, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  const total = Number(purchase.totalGrams ?? 0);
  const remainingRaw = Number(purchase.remainingGrams ?? 0);
  const isOneGramPurchase = Number.isFinite(total) && total > 0 && total <= 1.05;

  const remainingDisplay = useMemo(() => {
    if (!Number.isFinite(remainingRaw) || remainingRaw < 0) return isOneGramPurchase ? total : 0;
    if (isOneGramPurchase && remainingRaw <= 0) return total;
    return remainingRaw;
  }, [remainingRaw, isOneGramPurchase, total]);

  const pct = useMemo(() => {
    if (!Number.isFinite(total) || total <= 0) return 0;
    const raw = (remainingDisplay / total) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [total, remainingDisplay]);

  const pctRounded = useMemo(() => Math.round(pct), [pct]);
  const isLow = !isOneGramPurchase && (remainingDisplay < 1 || pct < 20);
  const depleted = !isOneGramPurchase && remainingDisplay <= 0;

  const unitPrice =
    purchase.totalCostCents && Number.isFinite(total) && total > 0
      ? (purchase.totalCostCents / 100) / total
      : undefined;

  const hasAnyPotency =
    typeof purchase.thcPercent === 'number' || typeof purchase.thcaPercent === 'number';
  const totalPotency = hasAnyPotency ? sumPotency(purchase.thcPercent, purchase.thcaPercent) : null;

  const productType = buildProductTypeParts(purchase);

  async function logArchiveEntry(
    finishedDateISO: string,
    wasteGrams?: number,
    wastePercent?: number | null
  ) {
    const title = purchase.strainName || 'Untitled';
    const nowMs = Date.now();

    const roundedWastePercent =
      typeof wastePercent === 'number'
        ? Math.round(wastePercent * 100) / 100
        : undefined;

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

      smokeableKind: purchase.smokeableKind || 'Flower',
      ...(purchase.smokeableKind === 'Concentrate'
        ? {
            concentrateCategory: purchase.concentrateCategory,
            concentrateForm: purchase.concentrateForm,
          }
        : {}),

      purchaseId: purchase.id,
      purchaseSnapshot: cleanUndefined({
        totalGrams: total,
        remainingGrams: remainingDisplay,
        totalCostCents: purchase.totalCostCents ?? 0,
        purchaseDate: purchase.purchaseDate || null,
        smokeableKind: purchase.smokeableKind || 'Flower',
        ...(purchase.smokeableKind === 'Concentrate'
          ? {
              concentrateCategory: purchase.concentrateCategory,
              concentrateForm: purchase.concentrateForm,
            }
          : {}),
      }),

      ...(typeof wasteGrams === 'number' && wasteGrams > 0
        ? { wasteGrams, wastePercent: roundedWastePercent }
        : {}),

      createdAt: nowMs,
      updatedAt: nowMs,
    });

    await addDoc(collection(db, 'users', uid, 'entries'), entry);
  }

  async function finishAndArchive() {
    if (!uid || !purchase.id) return;
    const pref = doc(db, 'users', uid, 'purchases', purchase.id);
    const finishedDateISO = new Date().toISOString().slice(0, 10);

    let wasteGrams: number | undefined;
    let wastePercent: number | null | undefined;

    try {
      setBusy(true);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(pref);
        if (!snap.exists()) throw new Error('Purchase not found');
        const p = snap.data() as any;

        const t = Number(typeof p.totalGrams === 'number' ? p.totalGrams : total) || 0;
        const r = Number(typeof p.remainingGrams === 'number' ? p.remainingGrams : remainingRaw) || 0;

        if (t > 0 && r > 0) {
          wasteGrams = r;
          wastePercent = Math.max(0, Math.min(100, (r / t) * 100));
        }

        if ((p.remainingGrams ?? 0) > 0 || p.status !== 'depleted') {
          tx.update(pref, {
            remainingGrams: 0,
            status: 'depleted',
            updatedAt: Date.now(),
          });
        }
      });

      await logArchiveEntry(finishedDateISO, wasteGrams, wastePercent ?? undefined);
      await deleteDoc(pref);
      onChanged?.();
    } catch (err: any) {
      alert(err?.message || 'Finish & archive failed.');
    } finally {
      setBusy(false);
    }
  }

  const hasWaste = typeof purchase.wasteGrams === 'number' && purchase.wasteGrams > 0;

  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.headerBlock}>
        <div className={styles.titleCenter}>{purchase.strainName}</div>
         {purchase.lineage && <div className={styles.lineageCenter}>Lineage: {purchase.lineage}</div>}

        <div className={styles.productTypeWrap}>
          <span
            className={`${styles.productTypeBadge} ${
              productType.kind === 'Flower' ? styles.badgeFlower : styles.badgeConcentrate
            }`}
          >
            {productType.kind === 'Flower' ? '🌿' : '🍯'} {productType.label}
          </span>
          </div>  
          <div> {productType.detail && <span className={styles.productTypeDetail}>{productType.detail}</span>}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.left}>
          {purchase.brand && <div className={styles.brand}>Cultivator: {purchase.brand}</div>}
        </div>

        <div className={styles.right}>
          <div className={styles.badges}>
            {!depleted && isLow && (
              <span className={`${styles.stateBadge} ${styles.badgeLow}`}>LOW AMOUNT</span>
            )}
            {depleted && (
              <span className={`${styles.stateBadge} ${styles.badgeDepleted}`}>Depleted</span>
            )}
          </div>

          <div className={styles.quantities}>
            <div>Purchased: {formatWeight(total)}</div>
            <div>
              Remaining: <strong>{formatWeight(remainingDisplay)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.infoCenter}>
        {purchase.purchaseDate && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Purchased :</span>
            <span className={styles.valuePill}>{formatToMDY(purchase.purchaseDate)}</span>
          </div>
        )}

        {purchase.totalCostCents != null && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Spent :</span>
            <span className={styles.valuePill}>${centsToDollarString(purchase.totalCostCents)}</span>
          </div>
        )}

        {unitPrice != null && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Price Per :</span>
            <span className={styles.valuePill}>~${unitPrice.toFixed(2)}/g</span>
          </div>
        )}

        {hasAnyPotency && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>THC Potency :</span>
            <span className={styles.valuePill}>{totalPotency}%</span>
          </div>
        )}
      </div>

      {/* PROGRESS */}
      <div className={styles.progressBlock}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Remaining</span>
          <span className={styles.progressValue}>{pctRounded}%</span>
        </div>
        <div className={styles.progressOuter}>
          <div className={styles.progressInner} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {hasWaste && (
        <div className={styles.wasteLine}>
          Waste:{' '}
          <span className={styles.wasteValue}>{purchase.wasteGrams!.toFixed(2)} g</span>
          {typeof purchase.wastePercent === 'number' && (
            <span className={styles.wastePercent}> ({purchase.wastePercent.toFixed(2)}%)</span>
          )}
        </div>
      )}

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
