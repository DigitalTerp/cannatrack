'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createEntry, listStrains, createEntryWithPurchaseDeduction } from '@/lib/firestore';
import type {
  CreateEntryInput,
  Method,
  StrainType,
  Strain,
  EdibleType,
  SmokeableKind,
  ConcentrateCategory,
  ConcentrateForm,
} from '@/lib/types';
import styles from './FormEntry.module.css';
import { collection, getDocs, getDoc, query, where, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
function fromDatetimeLocal(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

const METHOD_OPTIONS: Method[] = ['Pre-Roll', 'Bong', 'Pipe', 'Vape', 'Dab'];
const TYPE_OPTIONS: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];
const EDIBLE_TYPES: EdibleType[] = ['Gummy', 'Chocolate', 'Pill', 'Beverage'];

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

const toNum = (s: string) => {
  if (!s || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

function niceName() {
  const u = auth.currentUser;
  const fromProfile = u?.displayName?.trim();
  if (fromProfile) return fromProfile.split(/\s+/)[0];
  const email = u?.email || '';
  const raw = email.split('@')[0] || 'there';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function findLatestEligiblePurchaseId(
  uid: string,
  strainName: string,
  opts?: {
    smokeableKind?: SmokeableKind;
    concentrateCategory?: ConcentrateCategory;
    concentrateForm?: ConcentrateForm;
  }
): Promise<string | null> {
  if (!uid || !strainName) return null;
  const nameLower = strainName.trim().toLowerCase();

  try {
    const qy = query(collection(db, 'users', uid, 'purchases'), where('strainNameLower', '==', nameLower));
    const snap = await getDocs(qy);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const eligible = rows
      .filter((p) => (p?.status ?? 'active') === 'active' && Number(p?.remainingGrams ?? 0) > 0)
      .filter((p) => {
        const pk: SmokeableKind | undefined = p?.smokeableKind;
        const pc: ConcentrateCategory | undefined = p?.concentrateCategory;
        const pf: ConcentrateForm | undefined = p?.concentrateForm;

        if (!opts?.smokeableKind) return true;

        if (pk && pk !== opts.smokeableKind) return false;

        if (opts.smokeableKind === 'Concentrate') {
          if (opts.concentrateCategory && pc && pc !== opts.concentrateCategory) return false;
          if (opts.concentrateForm && pf && pf !== opts.concentrateForm) return false;
        }

        return true;
      })
      .sort((a, b) => Number(b?.updatedAt ?? 0) - Number(a?.updatedAt ?? 0));

    return eligible[0]?.id || null;
  } catch {
    return null;
  }
}

/** Pull smokeableKind + concentrate details from the latest active purchase and apply to the form */
async function prefillFromLatestPurchase(params: {
  uid: string;
  strainName: string;
  apply: (v: {
    smokeableKind?: SmokeableKind;
    concentrateCategory?: ConcentrateCategory;
    concentrateForm?: ConcentrateForm;
  }) => void;
}) {
  const { uid, strainName, apply } = params;

  const purchaseId = await findLatestEligiblePurchaseId(uid, strainName);
  if (!purchaseId) return;

  try {
    const ref = doc(db, 'users', uid, 'purchases', purchaseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const p = snap.data() as any;

    // default to Flower when missing (older purchases)
    const smokeableKind: SmokeableKind =
      p?.smokeableKind === 'Concentrate' ? 'Concentrate' : 'Flower';

    let concentrateCategory: ConcentrateCategory | undefined = undefined;
    let concentrateForm: ConcentrateForm | undefined = undefined;

    if (smokeableKind === 'Concentrate') {
      const catRaw = p?.concentrateCategory;
      const cat: ConcentrateCategory = CONCENTRATE_CATEGORY_OPTIONS.includes(catRaw)
        ? catRaw
        : 'Live Resin';

      const allowedForms = getConcentrateFormOptions(cat);
      const formRaw = p?.concentrateForm;
      const form: ConcentrateForm = allowedForms.includes(formRaw) ? formRaw : allowedForms[0];

      concentrateCategory = cat;
      concentrateForm = form;
    }

    apply({ smokeableKind, concentrateCategory, concentrateForm });
  } catch {
    // non-fatal
  }
}

type PastEdible = {
  key: string;
  lastUsed: number;
  edibleName: string;
  edibleType?: string;
  mg?: number;
  strainType: StrainType;
  brand?: string;
};

const asNumber = (v: any): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};
const getEdibleMg = (e: any): number | undefined =>
  asNumber(e?.edibleMg) ?? asNumber(e?.thcMg) ?? asNumber(e?.mg) ?? asNumber(e?.dose);

async function loadPastEdibles(uid: string): Promise<PastEdible[]> {
  const base = collection(db, 'users', uid, 'entries');
  const [snapA, snapB] = await Promise.all([
    getDocs(query(base, where('method', '==', 'Edible'))),
    getDocs(query(base, where('isEdibleSession', '==', true))),
  ]);
  const rows = [...snapA.docs, ...snapB.docs].map((d) => ({ id: d.id, ...(d.data() as any) }));

  const map = new Map<string, PastEdible>();
  for (const r of rows) {
    const name = (r.edibleName || r.strainName || '').trim();
    if (!name) continue;
    const mg = getEdibleMg(r);
    const eType = (r.edibleType || r.edibleKind || '').trim() || undefined;
    const sType = (r.strainType as StrainType) || 'Hybrid';
    const brand = (r.brand || '').trim() || undefined;
    const lastUsed = Number(r.time) || 0;

    const key = `${name}|${eType ?? ''}|${mg ?? ''}|${sType}|${brand ?? ''}`;
    const current = map.get(key);
    if (!current || lastUsed > current.lastUsed) {
      map.set(key, { key, lastUsed, edibleName: name, edibleType: eType, mg, strainType: sType, brand });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastUsed - a.lastUsed);
}

export default function AddEntryForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('there');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace('/login?next=/tracker');
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

  const [pastEdibles, setPastEdibles] = useState<PastEdible[]>([]);
  const [selectedEdibleKey, setSelectedEdibleKey] = useState<string>('');
  useEffect(() => {
    (async () => {
      if (!uid) return;
      try {
        const list = await loadPastEdibles(uid);
        setPastEdibles(list);
      } catch {}
    })();
  }, [uid]);

  const [sessionType, setSessionType] = useState<'smokeable' | 'edible'>('smokeable');
  const [timeLocal, setTimeLocal] = useState<string>(() => toDatetimeLocal(Date.now()));
  const [notes, setNotes] = useState('');
  const [strainName, setStrainName] = useState('');
  const [strainType, setStrainType] = useState<StrainType>('Hybrid');
  const [brand, setBrand] = useState('');
  const [lineage, setLineage] = useState('');
  const [thcPercent, setThcPercent] = useState('');
  const [thcaPercent, setThcaPercent] = useState('');
  const [method, setMethod] = useState<Method>('Pre-Roll');
  const [weight, setWeight] = useState('');
  const [effects, setEffects] = useState('');
  const [aroma, setAroma] = useState('');
  const [flavors, setFlavors] = useState('');
  const [rating, setRating] = useState('');

  const [edibleName, setEdibleName] = useState('');
  const [edibleType, setEdibleType] = useState<EdibleType>('Gummy');
  const [thcMg, setThcMg] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // smokeable fields
  const [smokeableKind, setSmokeableKind] = useState<SmokeableKind>('Flower');
  const [concentrateCategory, setConcentrateCategory] = useState<ConcentrateCategory>('Live Resin');
  const [concentrateForm, setConcentrateForm] = useState<ConcentrateForm>('Badder');

  // Keep concentrate form valid when category changes
  useEffect(() => {
    const allowed = getConcentrateFormOptions(concentrateCategory);
    if (!allowed.includes(concentrateForm)) setConcentrateForm(allowed[0]);
  }, [concentrateCategory, concentrateForm]);

  // Nudge method based on smokeable kind
  useEffect(() => {
    if (sessionType !== 'smokeable') return;
    if (smokeableKind === 'Concentrate') {
      if (method !== 'Dab') setMethod('Dab');
    } else {
      if (method === 'Dab') setMethod('Pre-Roll');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smokeableKind, sessionType]);

  async function handlePickStrain(id: string) {
    setSelectedStrainId(id);
    if (!id) return;

    const s = strains.find((x) => x.id === id);
    if (!s) return;

    // 1) Prefill from STRAIN LIBRARY (what you already had)
    const nextName = s.name || '';
    setStrainName(nextName);
    setStrainType((s.type as StrainType) || 'Hybrid');
    setBrand(s.brand || '');
    setLineage(s.lineage || '');
    setThcPercent(typeof s.thcPercent === 'number' && Number.isFinite(s.thcPercent) ? String(s.thcPercent) : '');
    setThcaPercent(typeof s.thcaPercent === 'number' && Number.isFinite(s.thcaPercent) ? String(s.thcaPercent) : '');

    // 2) Prefill from LATEST ACTIVE PURCHASE for this strain (this is the missing piece)
    if (uid && nextName) {
      await prefillFromLatestPurchase({
        uid,
        strainName: nextName,
        apply: ({ smokeableKind, concentrateCategory, concentrateForm }) => {
          if (smokeableKind) setSmokeableKind(smokeableKind);

          if (smokeableKind === 'Concentrate') {
            if (concentrateCategory) setConcentrateCategory(concentrateCategory);
            if (concentrateForm) setConcentrateForm(concentrateForm);
            // also nudge method
            setMethod('Dab');
          } else if (smokeableKind === 'Flower') {
            // (optional) reset concentrate fields for cleaner UX
            setConcentrateCategory('Live Resin');
            setConcentrateForm('Badder');
          }
        },
      });
    }
  }

  function handlePickEdible(key: string) {
    setSelectedEdibleKey(key);
    if (!key) return;
    const found = pastEdibles.find((p) => p.key === key);
    if (!found) return;

    setEdibleName(found.edibleName || '');
    setBrand(found.brand || '');
    const typed = EDIBLE_TYPES.includes((found.edibleType as any)) ? (found.edibleType as EdibleType) : 'Gummy';
    setEdibleType(typed);
    setStrainType(found.strainType || 'Hybrid');
    setThcMg(found.mg != null ? String(found.mg) : '');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!uid) {
      setErr('Not signed in. Please log in first.');
      router.push('/login?next=/tracker');
      return;
    }

    const timeMs = fromDatetimeLocal(timeLocal) ?? Date.now();

    let payload: CreateEntryInput;

    if (sessionType === 'edible') {
      payload = {
        time: timeMs,
        method: 'Edible',
        isEdibleSession: true,
        strainName: edibleName.trim(),
        strainType,
        brand: brand.trim() || undefined,

        edibleName: edibleName.trim(),
        edibleType,
        edibleMg: toNum(thcMg),

        weight: undefined,
        lineage: undefined,
        thcPercent: undefined,
        thcaPercent: undefined,
        effects: undefined,
        aroma: undefined,
        flavors: undefined,
        rating: undefined,

        notes: notes.trim() || undefined,
      } as CreateEntryInput;

      try {
        setSubmitting(true);
        await createEntry(uid, payload);
        router.push('/tracker');
      } catch (e: any) {
        setErr(e?.message || 'Failed to save entry.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    payload = {
      time: timeMs,
      method,
      strainName: strainName.trim(),
      strainType,
      brand: brand.trim() || undefined,
      lineage: lineage.trim() || undefined,
      thcPercent: toNum(thcPercent),
      thcaPercent: toNum(thcaPercent),
      weight: toNum(weight),

      effects: effects.split(',').map((s) => s.trim()).filter(Boolean),
      aroma: aroma.split(',').map((s) => s.trim()).filter(Boolean),
      flavors: flavors.split(',').map((s) => s.trim()).filter(Boolean),

      rating: toNum(rating),
      notes: notes.trim() || undefined,

      smokeableKind,
      concentrateCategory: smokeableKind === 'Concentrate' ? concentrateCategory : undefined,
      concentrateForm: smokeableKind === 'Concentrate' ? concentrateForm : undefined,
    } as any;

    try {
      setSubmitting(true);

      const w = (payload as any).weight ?? 0;
      const name = (payload as any).strainName?.trim();
      let usedDeduct = false;

      if (name && w && w > 0) {
        const purchaseId = await findLatestEligiblePurchaseId(uid, name, {
          smokeableKind,
          concentrateCategory: smokeableKind === 'Concentrate' ? concentrateCategory : undefined,
          concentrateForm: smokeableKind === 'Concentrate' ? concentrateForm : undefined,
        });

        if (purchaseId) {
          await createEntryWithPurchaseDeduction(uid, purchaseId, payload as any);
          usedDeduct = true;
        }
      }

      if (!usedDeduct) {
        await createEntry(uid, payload as any);
      }

      router.push('/tracker');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save entry.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  return (
    <form className={`card ${styles.formRoot}`} onSubmit={onSubmit} noValidate>
      <h2 className={styles.heading}>What did you consume, {displayName}?</h2>

      <div className={styles.toggleRow}>
        <button
          type="button"
          className={`btn ${sessionType === 'smokeable' ? 'btn-primary' : 'btn-ghost'} ${styles.btnWide}`}
          onClick={() => setSessionType('smokeable')}
        >
          SMOKEABLE
        </button>
        <button
          type="button"
          className={`btn ${sessionType === 'edible' ? 'btn-primary' : 'btn-ghost'} ${styles.btnWide}`}
          onClick={() => setSessionType('edible')}
        >
          EDIBLE
        </button>
      </div>

      <div className={styles.field}>
        <label htmlFor="time">Time</label>
        <input
          id="time"
          type="datetime-local"
          className="input"
          value={timeLocal}
          onChange={(e) => setTimeLocal(e.target.value)}
          required
        />
        <div className={styles.help}>Auto-filled to current date and time — <i>adjust if needed.</i></div>
      </div>

      {sessionType === 'edible' && pastEdibles.length > 0 && (
        <div className={styles.field}>
          <label htmlFor="prev-edible">Previous Edibles (optional)</label>
          <select
            id="prev-edible"
            className="input"
            value={selectedEdibleKey}
            onChange={(e) => handlePickEdible(e.target.value)}
          >
            <option value="">— New Edible —</option>
            {pastEdibles.map((p) => (
              <option key={p.key} value={p.key}>
                {p.edibleName}
                {p.brand ? ` : ${p.brand}` : ''} •{p.mg != null ? ` ${p.mg} mg` : ''}
                {p.edibleType ? ` (${p.edibleType})` : ''} — {p.strainType}
              </option>
            ))}
          </select>
          <div className={styles.help}>Selecting one pre-fills the edible fields. You can still tweak anything before saving.</div>
        </div>
      )}

      {strains.length > 0 && (
        <div className={styles.field}>
          <label htmlFor="prev-cultivar">Current Cultivars ( <i>Select One</i> )</label>
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
          <div className={styles.help}>Selecting one pre-fills the fields. Each session is still saved separately.</div>
        </div>
      )}

      {sessionType === 'smokeable' && (
        <>
          <div className={`${styles.gridTwo} ${styles.section}`}>
            <div>
              <label htmlFor="smokeableKind">Smokeable Type</label>
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
              <div className={styles.help}>Choose Flower or Concentrate.</div>
            </div>

            {smokeableKind === 'Concentrate' ? (
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
                <div className={styles.help}>Cured, Live Resin, or Live Rosin.</div>
              </div>
            ) : (
              <div />
            )}
          </div>

          {smokeableKind === 'Concentrate' && (
            <div className={`${styles.gridTwo} ${styles.section}`}>
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

                <div className={styles.help}>Sugar / Badder / Crumble / Diamonds &amp; Sauce.</div><br />
              </div>
              <div />
            </div>
          )}

          {/* rest of your form stays the same */}
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
              <label htmlFor="method">Method of Consumption</label>
              <select
                id="method"
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
                required
              >
                {METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {smokeableKind === 'Concentrate' && (
                <div className={styles.help}>Tip: “Dab” is usually right for concentrates.</div>
              )}
            </div>

            <div>
              <label htmlFor="weight">Weight (g)</label>
              <input
                id="weight"
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder={smokeableKind === 'Concentrate' ? 'e.g., 0.10' : 'e.g., 0.35'}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>

          <div className={`${styles.stack} ${styles.section}`}>
            <div>
              <label htmlFor="effects">Effects</label>
              <input
                id="effects"
                className="input"
                placeholder="e.g., Relaxing with slight creativity..."
                value={effects}
                onChange={(e) => setEffects(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="aroma">Smell</label>
              <input
                id="aroma"
                className="input"
                placeholder="e.g., citrus, pine"
                value={aroma}
                onChange={(e) => setAroma(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="flavors">Taste</label>
              <input
                id="flavors"
                className="input"
                placeholder="e.g., Berry with a strong chemical exhale"
                value={flavors}
                onChange={(e) => setFlavors(e.target.value)}
              />
            </div>
          </div>

          <div className={`${styles.gridTwo} ${styles.section}`}>
            <div>
              <label htmlFor="rating">Rating (0–10)</label>
              <input
                id="rating"
                className="input"
                type="number"
                min={0}
                max={10}
                step={1}
                placeholder="e.g., 8"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
            </div>
            <div />
          </div>
        </>
      )}

      {sessionType === 'edible' && (
        <>
          <div className={styles.gridTwo}>
            <div>
              <label htmlFor="edibleName">Edible Name</label>
              <input
                id="edibleName"
                className="input"
                placeholder="e.g., Midnight Berry 10mg"
                value={edibleName}
                onChange={(e) => setEdibleName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="strainTypeEdible">Type (Indica/Hybrid/Sativa)</label>
              <select
                id="strainTypeEdible"
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
              <label htmlFor="brandEdible">Brand</label>
              <input
                id="brandEdible"
                className="input"
                placeholder="e.g., Kiva"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="edibleType">Edible Type</label>
              <select
                id="edibleType"
                className="input"
                value={edibleType}
                onChange={(e) => setEdibleType(e.target.value as EdibleType)}
              >
                {EDIBLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="thcMg">THC (mg)</label>
              <input
                id="thcMg"
                className="input"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="e.g., 10"
                value={thcMg}
                onChange={(e) => setThcMg(e.target.value)}
                required
              />
            </div>

            <div />
          </div>
        </>
      )}

      <div className={styles.section}>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          className="input"
          placeholder="Any observations you want to remember…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {err && <p className={styles.error}>{err}</p>}

      <div className={styles.actions}>
        <button className={`btn btn-primary ${styles.btnWide}`} type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Session'}
        </button>
        </div>
        <div className={styles.actions}>
        <button
          className={`btn btn-ghost ${styles.btnWide}`}
          type="button"
          onClick={() => router.push('/tracker')}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
