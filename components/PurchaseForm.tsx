'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createPurchase, listStrains } from '@/lib/firestore';
import type {
  Strain,
  StrainType,
  SmokeableKind,
  ConcentrateCategory,
  ConcentrateForm,
} from '@/lib/types';
import styles from './FormEntry.module.css';

const TYPE_OPTIONS: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];
const SMOKEABLE_KIND_OPTIONS: SmokeableKind[] = ['Flower', 'Concentrate'];
const CONCENTRATE_CATEGORY_OPTIONS: ConcentrateCategory[] = ['Cured', 'Live Resin', 'Live Rosin'];
const LIVE_RESIN_FORMS: ConcentrateForm[] = ['Badder', 'Sugar', 'Diamonds and Sauce'];
const CURED_FORMS: ConcentrateForm[] = ['Badder', 'Sugar', 'Diamonds and Sauce', 'Crumble'];
const LIVE_ROSIN_FORMS: ConcentrateForm[] = ['Hash Rosin', 'Temple Ball', 'Jam', 'Full Melt', 'Bubble Hash'];

function getConcentrateFormOptions(cat: ConcentrateCategory): ConcentrateForm[] {
  if (cat === 'Live Rosin') return LIVE_ROSIN_FORMS;
  if (cat === 'Cured') return CURED_FORMS;
  return LIVE_RESIN_FORMS;
}

function niceName() {
  const u = auth.currentUser;
  const fromProfile = u?.displayName?.trim();
  if (fromProfile) return fromProfile.split(/\s+/)[0];
  const email = u?.email || '';
  const raw = email.split('@')[0] || 'there';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const G_PER_OZ = 28;
const G_PER_EIGHTH = 3.5;
const G_PER_HALF_OZ = G_PER_OZ / 2;

function buildWeightOptions() {
  const maxG = 10 * G_PER_OZ;
  const out: { label: string; grams: number }[] = [];

  function labelWithHalfOz(grams: number): string {
    if (Math.abs(grams - 1) < 1e-9) return `1 g`;
    const halfUnits = grams / G_PER_HALF_OZ;
    const halfUnitsRounded = Math.round(halfUnits);

    if (Math.abs(halfUnits - halfUnitsRounded) > 1e-6) {
      return `${grams} g`;
    }

    const isHalfOnly = halfUnitsRounded === 1;
    const isEven = halfUnitsRounded % 2 === 0;

    let ozLabel: string;

    if (isHalfOnly) {
      ozLabel = '½ oz';
    } else if (isEven) {
      const oz = halfUnitsRounded / 2;
      ozLabel = `${oz} oz`;
    } else {
      const wholeOz = Math.floor(halfUnitsRounded / 2);
      ozLabel = wholeOz === 0 ? '½ oz' : `${wholeOz}½ oz`;
    }

    return `${grams} g (${ozLabel})`;
  }

  out.push({ label: '1g', grams: 1 });

  for (let g = G_PER_EIGHTH; g <= G_PER_OZ + 1e-9; g += G_PER_EIGHTH) {
    const grams = +g.toFixed(2);
    out.push({ label: labelWithHalfOz(grams), grams });
  }

  for (let g = G_PER_OZ + 7; g <= maxG + 1e-9; g += 7) {
    const grams = +g.toFixed(2);
    out.push({ label: labelWithHalfOz(grams), grams });
  }

  return out;
}

export default function PurchaseForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('there');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace('/login?next=/purchases/new');
      } else {
        setUid(u.uid);
        setDisplayName(niceName());
        setReady(true);
      }
    });
    return () => unsub();
  }, [router]);

  const [strains, setStrains] = useState<Strain[]>([]);
  const [selectedStrainId, setSelectedStrainId] = useState<string>('');

  const loadStrains = useCallback(async () => {
    if (!uid) return;
    try {
      const list = await listStrains(uid);
      setStrains(list);
    } catch {}
  }, [uid]);

  useEffect(() => {
    loadStrains();
  }, [loadStrains]);

  function handlePickStrain(id: string) {
    setSelectedStrainId(id);
    if (!id) return;
    const s = strains.find((x) => x.id === id);
    if (!s) return;
    setStrainName(s.name || '');
    setStrainType((s.type as StrainType) || 'Hybrid');
    setBrand(s.brand || '');
    setLineage(s.lineage || '');
  }

  const [strainName, setStrainName] = useState('');
  const [strainType, setStrainType] = useState<StrainType>('Hybrid');
  const [brand, setBrand] = useState('');
  const [lineage, setLineage] = useState('');
  const [thcPercent, setThcPercent] = useState('');
  const [thcaPercent, setThcaPercent] = useState('');

  const [smokeableKind, setSmokeableKind] = useState<SmokeableKind>('Flower');
  const [concentrateCategory, setConcentrateCategory] = useState<ConcentrateCategory>('Live Resin');
  const [concentrateForm, setConcentrateForm] = useState<ConcentrateForm>('Badder');

  const [grams, setGrams] = useState<number>(G_PER_EIGHTH);

  const [gramsManual, setGramsManual] = useState<string>('1');

  const [dollars, setDollars] = useState('');
  const [purchaseDateISO, setPurchaseDateISO] = useState(new Date().toISOString().slice(0, 10));

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const weightOptions = useMemo(() => buildWeightOptions(), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!uid) {
      setErr('Not signed in. Please log in first.');
      router.push('/login?next=/purchases/new');
      return;
    }
    if (!strainName.trim()) {
      setErr('Cultivar name is required.');
      return;
    }

    const gramsToSend =
      smokeableKind === 'Concentrate'
        ? Number(gramsManual)
        : grams;

    if (!Number.isFinite(gramsToSend) || gramsToSend <= 0) {
      setErr('Total amount must be a number greater than 0.');
      return;
    }

    try {
      setSubmitting(true);

      await createPurchase(uid, {
        strainName: strainName.trim(),
        strainType,
        lineage: lineage.trim() || undefined,
        brand: brand.trim() || undefined,
        thcPercent: thcPercent ? parseFloat(thcPercent) : undefined,
        thcaPercent: thcaPercent ? parseFloat(thcaPercent) : undefined,
        grams: gramsToSend,

        dollars: dollars ? parseFloat(dollars) : undefined,
        purchaseDateISO,

        ...(smokeableKind === 'Concentrate'
          ? {
              smokeableKind,
              concentrateCategory,
              concentrateForm,
            }
          : { smokeableKind }),
      } as any);

      router.push('/purchases');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save purchase.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  return (
    <form className={`card ${styles.formRoot}`} onSubmit={onSubmit} noValidate>
      <h2 className={styles.heading}>What did you purchase, {displayName}?</h2>

      {strains.length > 0 && (
        <div className={styles.field}>
          <label htmlFor="prev-cultivar">Previous Cultivars (<i>Select One</i>)</label>
          <select
            id="prev-cultivar"
            className="input"
            value={selectedStrainId}
            onChange={(e) => handlePickStrain(e.target.value)}
          >
            <option value="">— New Cultivar —</option>
            {strains.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.brand ? ` : ${s.brand}` : ''} ({s.type})
              </option>
            ))}
          </select>
          <div className={styles.help}>Selecting one pre-fills fields; this purchase is still saved separately.</div>
        </div>
      )}

      <div className={styles.gridTwo}>
        <div>
          <label htmlFor="strainName">Cultivar Name</label>
          <input
            id="strainName"
            className="input"
            placeholder="e.g., Blue Dream"
            value={strainName}
            onChange={(e) => setStrainName(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="strainType">Type</label>
          <select
            id="strainType"
            className="input"
            value={strainType}
            onChange={(e) => setStrainType(e.target.value as StrainType)}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="brand">Cultivator</label>
          <input
            id="brand"
            className="input"
            placeholder="e.g., Alien Labs"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="lineage">Lineage</label>
          <input
            id="lineage"
            className="input"
            placeholder="e.g., Haze × Blueberry"
            value={lineage}
            onChange={(e) => setLineage(e.target.value)}
          />
        </div>
                <div>
          <label htmlFor="thcaPercent">THCA %</label>
          <input
            id="thcaPercent"
            className="input"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="e.g., 30"
            value={thcaPercent}
            onChange={(e) => setThcaPercent(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="thcPercent">THC %</label>
          <input
            id="thcPercent"
            className="input"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="e.g., 22"
            value={thcPercent}
            onChange={(e) => setThcPercent(e.target.value)}
          />
        </div>
      </div>

      <div className={`${styles.gridTwo} ${styles.section}`}>
        <div>
          <label htmlFor="purchaseDate">Purchase Date</label>
          <input
            id="purchaseDate"
            type="date"
            className="input"
            value={purchaseDateISO}
            onChange={(e) => setPurchaseDateISO(e.target.value)}
          />
        </div>
        <div />
      </div>

      <div className={`${styles.gridTwo} ${styles.section}`}>
        <div>
          <label htmlFor="smokeableKind">Product Type</label>
          <select
            id="smokeableKind"
            className="input"
            value={smokeableKind}
            onChange={(e) => setSmokeableKind(e.target.value as SmokeableKind)}
          >
            {SMOKEABLE_KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div />
      </div>

      {smokeableKind === 'Concentrate' && (
        <div className={`${styles.gridTwo} ${styles.section}`}>
          <div>
            <label htmlFor="concentrateCategory">Concentrate Category</label>
            <select
              id="concentrateCategory"
              className="input"
              value={concentrateCategory}
              onChange={(e) => setConcentrateCategory(e.target.value as ConcentrateCategory)}
            >
              {CONCENTRATE_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="concentrateForm">Concentrate Form</label>
            <select
                id="concentrateForm"
                className="input"
                value={concentrateForm}
                onChange={(e) => setConcentrateForm(e.target.value as ConcentrateForm)}
              >
              {getConcentrateFormOptions(concentrateCategory).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
                 ))}
              </select>

          </div>
        </div>
      )}

      <div className={`${styles.gridTwo} ${styles.section}`}>
        <div>
          <label htmlFor="gramsPreset">Total Amount</label>

          {smokeableKind === 'Flower' ? (
            <select
              id="gramsPreset"
              className="input"
              value={grams}
              onChange={(e) => setGrams(parseFloat(e.target.value))}
            >
              {weightOptions.map((opt) => (
                <option key={opt.grams} value={opt.grams}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="gramsPreset"
              className="input"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="e.g., 1.00"
              value={gramsManual}
              onChange={(e) => setGramsManual(e.target.value)}
              required
            />
          )}
        </div>

        <div>
          <label htmlFor="dollars">Amount Spent ($)</label>
          <input
            id="dollars"
            className="input"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="e.g., 49.99"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
          />
        </div>
      </div>

      {err && <p className={styles.error}>{err}</p>}

      <div className={styles.actions}>
        <button className={`btn btn-primary ${styles.btnWide}`} type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Purchase'}
        </button>
        </div>
        <div className={styles.actions}>
        <button
          className={`btn btn-ghost ${styles.btnWide}`}
          type="button"
          onClick={() => router.push('/purchases')}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
