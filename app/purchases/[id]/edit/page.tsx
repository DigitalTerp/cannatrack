'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import EditPurchaseForm from '@/components/EditPurchaseForm';
import styles from '../../new/NewPurchasePage.module.css';

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

type PurchaseDoc = {
  strainName: string;
  strainType?: StrainType;
  lineage?: string;
  brand?: string;
  thcPercent?: number | null;
  thcaPercent?: number | null;

  totalGrams: number;
  remainingGrams: number;
  totalCostCents?: number | null;

  purchaseDate?: string;
  batchId?: string | null;

  status?: 'active' | 'depleted';
  updatedAt?: number;

  smokeableKind?: SmokeableKind;
  concentrateCategory?: ConcentrateCategory;
  concentrateForm?: ConcentrateForm;
};

export default function EditPurchasePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseDoc | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace(`/login?next=/purchases/${encodeURIComponent(id || '')}/edit`);
      } else {
        setUid(u.uid);
      }
    });
    return () => unsub();
  }, [router, id]);


  useEffect(() => {
    if (!uid || !id) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const ref = doc(db, 'users', uid, 'purchases', id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          if (!cancelled) {
            setErr('Purchase not found.');
            setPurchase(null);
          }
          return;
        }

        const raw = snap.data() as PurchaseDoc;

        if (!cancelled) {
          setPurchase(raw);
          setErr(null);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load purchase.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, id]);

  const initialValues = useMemo(() => {
    const defaults = {
      strainName: '',
      strainType: 'Hybrid' as StrainType,
      lineage: '',
      brand: '',
      thcPercent: '',
      thcaPercent: '',
      grams: '',
      dollars: '',
      purchaseDateISO: new Date().toISOString().slice(0, 10),
      batchId: '',

      smokeableKind: 'Flower' as SmokeableKind,
      concentrateCategory: 'Live Resin' as ConcentrateCategory,
      concentrateForm: 'Badder' as ConcentrateForm,
    };

    if (!purchase) return defaults;

    const dollars =
      typeof purchase.totalCostCents === 'number'
        ? (purchase.totalCostCents / 100).toFixed(2)
        : '';

    return {
      strainName: purchase.strainName || '',
      strainType: purchase.strainType || 'Hybrid',
      lineage: purchase.lineage || '',
      brand: purchase.brand || '',
      thcPercent: typeof purchase.thcPercent === 'number' ? String(purchase.thcPercent) : '',
      thcaPercent: typeof purchase.thcaPercent === 'number' ? String(purchase.thcaPercent) : '',
      grams: typeof purchase.totalGrams === 'number' ? String(purchase.totalGrams) : '',
      dollars,
      purchaseDateISO: purchase.purchaseDate || defaults.purchaseDateISO,
      batchId: purchase.batchId || '',

      smokeableKind: purchase.smokeableKind || defaults.smokeableKind,
      concentrateCategory: purchase.concentrateCategory || defaults.concentrateCategory,
      concentrateForm: purchase.concentrateForm || defaults.concentrateForm,
    };
  }, [purchase]);

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1rem 1.25rem' }}>
      <header className={styles.header}>
        <h1 className={styles.title}>Edit Purchase</h1>
        <Link href="/purchases" className={`btn btn-ghost ${styles.back}`} aria-label="Back to purchases">
          Back
        </Link>
      </header>

      {loading ? (
        <div className="card">
          <div className="subtle">Loading purchase…</div>
        </div>
      ) : err ? (
        <div className="card">
          <p className="error" style={{ margin: 0 }}>
            {err}
          </p>
        </div>
      ) : !uid || !id ? (
        <div className="card">
          <p className="error" style={{ margin: 0 }}>
            Missing user or purchase ID.
          </p>
        </div>
      ) : (
        <EditPurchaseForm
          key={`${id}-${purchase?.updatedAt ?? 'loaded'}`}
          uid={uid}
          purchaseId={id}
          initialValues={initialValues}
          onSaved={() => router.push('/purchases')}
        />
      )}
    </div>
  );
}
