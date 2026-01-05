'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './FormEntry.module.css';
import type {
  Strain,
  StrainType,
  SmokeableKind,
  ConcentrateCategory,
  ConcentrateForm,
} from '@/lib/types';
import { listStrains, updatePurchase } from '@/lib/firestore';

const TYPE_OPTIONS: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];
const SMOKEABLE_KIND_OPTIONS: SmokeableKind[] = ['Flower', 'Concentrate'];
const CONCENTRATE_CATEGORY_OPTIONS: ConcentrateCategory[] = ['Cured', 'Live Resin', 'Live Rosin'];

const LIVE_RESIN_FORMS: ConcentrateForm[] = ['Badder', 'Sugar', 'Diamonds and Sauce'];
const CURED_FORMS: ConcentrateForm[] = ['Badder', 'Sugar', 'Diamonds and Sauce', 'Crumble'];
const LIVE_ROSIN_FORMS: ConcentrateForm[] = [
  'Hash Rosin',
  'Temple Ball',
  'Jam',
  'Full Melt',
  'Bubble Hash',
];

function getConcentrateFormOptions(cat: ConcentrateCategory): ConcentrateForm[] {
  if (cat === 'Live Rosin') return LIVE_ROSIN_FORMS;
  if (cat === 'Cured') return CURED_FORMS;
  return LIVE_RESIN_FORMS;
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

    if (Math.abs(halfUnits - halfUnitsRounded) > 1e-6) return `${grams} g`;

    const isHalfOnly = halfUnitsRounded === 1;
    const isEven = halfUnitsRounded % 2 === 0;

    let ozLabel: string;
    if (isHalfOnly) ozLabel = '½ oz';
    else if (isEven) ozLabel = `${halfUnitsRounded / 2} oz`;
    else {
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

/* --------------------------- normalizers --------------------------- */

function normalizeSmokeableKind(v: any): SmokeableKind | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'flower') return 'Flower';
  if (s === 'concentrate' || s === 'concentrates' || s === 'extract' || s === 'extracts')
    return 'Concentrate';
  return undefined;
}

function normalizeConcentrateCategory(v: any): ConcentrateCategory | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return undefined;

  if (s === 'cured' || s.startsWith('cure')) return 'Cured';

  // live resin variants
  if (s === 'live resin' || (s.includes('live') && s.includes('res'))) return 'Live Resin';

  // live rosin variants
  if (s === 'live rosin' || (s.includes('live') && s.includes('ros'))) return 'Live Rosin';

  return undefined;
}

function normalizeConcentrateForm(v: any): ConcentrateForm | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return undefined;

  if (s.startsWith('sug')) return 'Sugar';
  if (s.startsWith('bad')) return 'Badder';
  if (s.startsWith('cru')) return 'Crumble';
  if (s.includes('diamond')) return 'Diamonds and Sauce';

  if (s.includes('hash rosin')) return 'Hash Rosin';
  if (s.includes('temple')) return 'Temple Ball';
  if (s === 'jam') return 'Jam';
  if (s.includes('full melt')) return 'Full Melt';
  if (s.includes('bubble')) return 'Bubble Hash';

  return undefined;
}

function parseToNumber(v: any, fallback: number) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/* --------------------------- types --------------------------- */

type Props = {
  uid: string;
  purchaseId: string;
  initialValues: {
    strainName: string;
    strainType: StrainType | '';
    lineage: string;
    brand: string;
    thcPercent: string | number;
    thcaPercent: string | number;
    grams: string | number;
    dollars: string | number;
    purchaseDateISO: string;

    smokeableKind?: SmokeableKind | string;
    concentrateCategory?: ConcentrateCategory | string;
    concentrateForm?: ConcentrateForm | string;

    batchId?: string;
  };
  onSaved?: () => void;
};

export default function EditPurchaseForm({ uid, purchaseId, initialValues, onSaved }: Props) {
  const router = useRouter();

  // Strains (optional usage)
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

  // ---- state ----
  const [strainName, setStrainName] = useState(initialValues.strainName || '');
  const [strainType, setStrainType] = useState<StrainType>(
    (initialValues.strainType as StrainType) || 'Hybrid'
  );
  const [brand, setBrand] = useState(initialValues.brand || '');
  const [lineage, setLineage] = useState(initialValues.lineage || '');

  const [thcPercent, setThcPercent] = useState(
    initialValues.thcPercent === 0 || initialValues.thcPercent ? String(initialValues.thcPercent) : ''
  );
  const [thcaPercent, setThcaPercent] = useState(
    initialValues.thcaPercent === 0 || initialValues.thcaPercent ? String(initialValues.thcaPercent) : ''
  );

  const [smokeableKind, setSmokeableKind] = useState<SmokeableKind>('Flower');
  const [concentrateCategory, setConcentrateCategory] = useState<ConcentrateCategory>('Live Resin');
  const [concentrateForm, setConcentrateForm] = useState<ConcentrateForm>('Badder');

  const [grams, setGrams] = useState<number>(parseToNumber(initialValues.grams, G_PER_EIGHTH));
  const [gramsManual, setGramsManual] = useState<string>(
    String(parseToNumber(initialValues.grams, G_PER_EIGHTH) || 1)
  );

  const [dollars, setDollars] = useState(
    initialValues.dollars === 0 || initialValues.dollars ? String(initialValues.dollars) : ''
  );
  const [purchaseDateISO, setPurchaseDateISO] = useState(
    initialValues.purchaseDateISO || new Date().toISOString().slice(0, 10)
  );

  /**
   * ✅ THE FIX THAT USUALLY MATTERS:
   * Build a seed string from the fields we care about.
   * Even if the parent MUTATES initialValues (same object reference),
   * changes to any of these will change the seed → effect runs.
   */
  const initialSeed = useMemo(() => {
    const s = [
      purchaseId,
      initialValues.strainName ?? '',
      initialValues.strainType ?? '',
      initialValues.brand ?? '',
      initialValues.lineage ?? '',
      initialValues.thcPercent ?? '',
      initialValues.thcaPercent ?? '',
      initialValues.grams ?? '',
      initialValues.dollars ?? '',
      initialValues.purchaseDateISO ?? '',
      initialValues.smokeableKind ?? '',
      initialValues.concentrateCategory ?? '',
      initialValues.concentrateForm ?? '',
    ];
    return s.join('|');
  }, [
    purchaseId,
    initialValues.strainName,
    initialValues.strainType,
    initialValues.brand,
    initialValues.lineage,
    initialValues.thcPercent,
    initialValues.thcaPercent,
    initialValues.grams,
    initialValues.dollars,
    initialValues.purchaseDateISO,
    initialValues.smokeableKind,
    initialValues.concentrateCategory,
    initialValues.concentrateForm,
  ]);

  useEffect(() => {
    // Basic fields
    setStrainName(initialValues.strainName || '');
    setStrainType(((initialValues.strainType as StrainType) || 'Hybrid') as StrainType);
    setBrand(initialValues.brand || '');
    setLineage(initialValues.lineage || '');

    setThcPercent(
      initialValues.thcPercent === 0 || initialValues.thcPercent ? String(initialValues.thcPercent) : ''
    );
    setThcaPercent(
      initialValues.thcaPercent === 0 || initialValues.thcaPercent ? String(initialValues.thcaPercent) : ''
    );

    setDollars(
      initialValues.dollars === 0 || initialValues.dollars ? String(initialValues.dollars) : ''
    );
    setPurchaseDateISO(initialValues.purchaseDateISO || new Date().toISOString().slice(0, 10));

    // ✅ Derive kind robustly
    const normalizedKind = normalizeSmokeableKind(initialValues.smokeableKind);
    const normalizedCat = normalizeConcentrateCategory(initialValues.concentrateCategory);
    const normalizedForm = normalizeConcentrateForm(initialValues.concentrateForm);

    const nextKind: SmokeableKind =
      normalizedKind ||
      (normalizedCat || normalizedForm || initialValues.concentrateCategory || initialValues.concentrateForm
        ? 'Concentrate'
        : 'Flower');

    setSmokeableKind(nextKind);

    // Category/Form
    const nextCat: ConcentrateCategory = normalizedCat || 'Live Resin';
    setConcentrateCategory(nextCat);

    const allowed = getConcentrateFormOptions(nextCat);
    const nextForm: ConcentrateForm = normalizedForm || allowed[0];
    setConcentrateForm(allowed.includes(nextForm) ? nextForm : allowed[0]);

    // Grams
    const nextGrams = parseToNumber(initialValues.grams, G_PER_EIGHTH);
    setGrams(nextGrams);
    setGramsManual(String(nextGrams || 1));
  }, [initialSeed]); // ✅ depends on seed, not object reference

  // Ensure concentrate form is valid when category changes
  useEffect(() => {
    if (smokeableKind !== 'Concentrate') return;
    const opts = getConcentrateFormOptions(concentrateCategory);
    if (!opts.includes(concentrateForm)) setConcentrateForm(opts[0]);
  }, [smokeableKind, concentrateCategory, concentrateForm]);

  // Keep grams inputs in sync when switching product type
  useEffect(() => {
    if (smokeableKind === 'Concentrate') {
      if (!gramsManual || Number.isNaN(Number(gramsManual))) setGramsManual(String(grams || 1));
    } else {
      if (!Number.isFinite(grams) || grams <= 0) setGrams(G_PER_EIGHTH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smokeableKind]);

  const weightOptions = useMemo(() => buildWeightOptions(), []);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!uid) {
      setErr('Not signed in. Please log in first.');
      router.push('/login');
      return;
    }
    if (!strainName.trim()) {
      setErr('Cultivar name is required.');
      return;
    }

    // ✅ ALWAYS number (never null)
    const gramsToSend =
      smokeableKind === 'Concentrate'
        ? Number(gramsManual)
        : Number(grams ?? NaN);

    if (!Number.isFinite(gramsToSend) || gramsToSend <= 0) {
      setErr('Total amount must be a number greater than 0.');
      return;
    }

    try {
      setSubmitting(true);

      // Clear concentrate fields if Flower (prevents old concentrate data sticking around)
      const patch: any = {
        strainName: strainName.trim(),
        strainType,
        lineage: lineage.trim() || undefined,
        brand: brand.trim() || undefined,
        thcPercent: thcPercent ? parseFloat(thcPercent) : undefined,
        thcaPercent: thcaPercent ? parseFloat(thcaPercent) : undefined,
        grams: gramsToSend,
        dollars: dollars ? parseFloat(dollars) : undefined,
        purchaseDateISO,

        smokeableKind,
        concentrateCategory: smokeableKind === 'Concentrate' ? concentrateCategory : undefined,
        concentrateForm: smokeableKind === 'Concentrate' ? concentrateForm : undefined,
      };

      await updatePurchase(uid, purchaseId, patch);
      onSaved?.();
      router.push('/purchases');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save purchase.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={`card ${styles.formRoot}`} onSubmit={onSubmit} noValidate>
      <h2 className={styles.heading}>Edit Purchase</h2>

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
          {submitting ? 'Saving…' : 'Save Changes'}
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
