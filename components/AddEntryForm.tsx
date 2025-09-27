'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createEntry, listStrains, createEntryWithPurchaseDeduction } from '@/lib/firestore';
import type { CreateEntryInput, Method, StrainType, Strain, EdibleType } from '@/lib/types';
import styles from './FormEntry.module.css';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ---------- datetime-local helpers ---------- */
function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocal(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

const METHOD_OPTIONS: Method[] = ['Pre-Roll', 'Bong', 'Pipe', 'Vape', 'Dab'];
const TYPE_OPTIONS: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];
const EDIBLE_TYPES: EdibleType[] = ['Gummy', 'Chocolate', 'Pill', 'Beverage'];

/* ---------- helpers ---------- */
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

async function findLatestEligiblePurchaseId(uid: string, strainName: string): Promise<string | null> {
  if (!uid || !strainName) return null;
  const nameLower = strainName.trim().toLowerCase();
  try {
    const qy = query(
      collection(db, 'users', uid, 'purchases'),
      where('strainNameLower', '==', nameLower)
    );
    const snap = await getDocs(qy);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const eligible = rows
      .filter((p) => (p?.status ?? 'active') === 'active' && Number(p?.remainingGrams ?? 0) > 0)
      .sort((a, b) => Number(b?.updatedAt ?? 0) - Number(a?.updatedAt ?? 0));
    return eligible[0]?.id || null;
  } catch {
    return null;
  }
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
    } catch {
    }
  }, [uid]);

  useEffect(() => {
    loadStrains();
  }, [loadStrains]);

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
  const [weight, setWeight] = useState(''); // grams
  const [effects, setEffects] = useState('');
  const [aroma, setAroma] = useState('');
  const [flavors, setFlavors] = useState('');
  const [rating, setRating] = useState('');

  const [edibleName, setEdibleName] = useState('');
  const [edibleType, setEdibleType] = useState<EdibleType>('Gummy');
  const [thcMg, setThcMg] = useState(''); 

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function handlePickStrain(id: string) {
    setSelectedStrainId(id);
    if (!id) return;
    const s = strains.find((x) => x.id === id);
    if (!s) return;
    setStrainName(s.name || '');
    setStrainType((s.type as StrainType) || 'Hybrid');
    setBrand(s.brand || '');
    setLineage(s.lineage || '');
    setThcPercent(
      typeof s.thcPercent === 'number' && Number.isFinite(s.thcPercent) ? String(s.thcPercent) : ''
    );
    setThcaPercent(
      typeof s.thcaPercent === 'number' && Number.isFinite(s.thcaPercent) ? String(s.thcaPercent) : ''
    );
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

    // ---- Smokeable payload ----
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
    } as CreateEntryInput;

    try {
      setSubmitting(true);
      const w = payload.weight ?? 0;
      const name = payload.strainName?.trim();
      let usedDeduct = false;

      if (name && w && w > 0) {
        const purchaseId = await findLatestEligiblePurchaseId(uid, name);
        if (purchaseId) {
          await createEntryWithPurchaseDeduction(uid, purchaseId, payload as any);
          usedDeduct = true;
        }
      }

      if (!usedDeduct) {
        await createEntry(uid, payload);
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
        <div className={styles.help}>Auto-filled to current date and time — adjust if needed.</div>
      </div>

      {sessionType === 'smokeable' && strains.length > 0 && (
        <div className={styles.field}>
          <label htmlFor="prev-cultivar">Previous Cultivars (optional)</label>
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
          <div className={styles.help}>
            Selecting one just pre-fills the fields. Each session is still saved separately.
          </div>
        </div>
      )}

      {sessionType === 'smokeable' && (
        <>
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
            </div>

            <div>
              <label htmlFor="weight">Weight (g)</label>
              <input
                id="weight"
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="e.g., 0.35"
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
