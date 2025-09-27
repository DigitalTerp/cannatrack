'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import PurchaseCard from '@/components/PurchaseCard';
import PurchaseHistory from '@/components/PurchaseHistory';
import styles from './PurchasesPage.module.css';
import typeStyles from '@/app/strains/cultivars.module.css';

import type { StrainType } from '@/lib/types';

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

function badgeClass(t?: StrainType) {
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${typeStyles.typeBadge} ${typeStyles['type-indica']}`;
  if (key === 'sativa') return `${typeStyles.typeBadge} ${typeStyles['type-sativa']}`;
  return `${typeStyles.typeBadge} ${typeStyles['type-hybrid']}`;
}

export default function Page() {
  const [uid, setUid] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const qy = query(collection(db, 'users', uid, 'purchases'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Purchase[];
      setPurchases(rows);
    });
    return () => unsub();
  }, [uid]);

  const grouped = useMemo(() => {
    return purchases.reduce((acc, p) => {
      const key = p.strainType ?? 'Uncategorized';
      (acc[key] ||= []).push(p);
      return acc;
    }, {} as Record<string, Purchase[]>);
  }, [purchases]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Purchases</h1>
        <p className={styles.subtext}>
          Track your current stash and review archived purchases when you finish them.
        </p>
        <Link href="/purchases/new" className={styles.newBtn} aria-label="Create new purchase">
          New Purchase
        </Link>
      </header>

      <section className={styles.section}>
        {Object.keys(grouped).length === 0 ? (
          <div className="card">
            <p className="subtle" style={{ margin: 0 }}>
              {uid ? 'No purchases yet.' : 'Sign in and add purchases to see them here.'}
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([type, items]) => {
            const baseType: StrainType =
              type === 'Indica' || type === 'Sativa' || type === 'Hybrid' ? (type as StrainType) : 'Hybrid';

            return (
              <div key={type} className={styles.typeBlock}>
                <h3 className={styles.typeHeading}>
                  <span className={`badge ${badgeClass(baseType)}`}>
                    {type} <span className={styles.typeSuffix}>Flower</span>
                  </span>
                </h3>

                <div className={styles.cardsGrid}>
                  {items.map((p) => (
                    <PurchaseCard key={p.id} uid={uid!} purchase={p} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {uid && (
        <div className={styles.historyWrap}>
          <PurchaseHistory uid={uid} />
        </div>
      )}
    </div>
  );
}
