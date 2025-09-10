'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEntry, listStrains } from '@/lib/firestore';
import type { CreateEntryInput, Method, StrainType, Strain, EdibleType } from '@/lib/types';
import { auth } from '@/lib/firebase';

/* ---------- datetime-local helpers ---------- */
function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}
function fromDatetimeLocal(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/* ---------- Options ---------- */
const METHOD_OPTIONS: Method[] = ['Pre-Roll', 'Bong', 'Pipe', 'Vape', 'Dab']; // 'Edible' is auto-set for edible sessions
const TYPE_OPTIONS: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];
const EDIBLE_TYPES: EdibleType[] = ['Gummy', 'Chocolate', 'Pill', 'Beverage']; // (Firestore will coerce to 'Other' if needed)

/* ---------- helpers ---------- */
const toNum = (s: string) => {
  if (!s || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export default function AddEntryForm() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean>(!!auth.currentUser);

  // auth state watcher
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setAuthed(!!u));
    return () => unsub();
  }, []);

  // ---------- Cultivar picker (for smokeables only) ----------
  const [strains, setStrains] = useState<Strain[]>([]);
  const [selectedStrainId, setSelectedStrainId] = useState<string>('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    (async () => {
      try {
        const list = await listStrains(uid);
        setStrains(list);
      } catch {
        // ignore
      }
    })();
  }, [authed]);

  // ---------- Session Type ----------
  const [sessionType, setSessionType] = useState<'smokeable' | 'edible'>('smokeable');

  // ---------- Common ----------
  const [timeLocal, setTimeLocal] = useState<string>(() => toDatetimeLocal(Date.now()));
  const [notes, setNotes] = useState('');

  // ---------- Smokeable fields ----------
  const [strainName, setStrainName] = useState('');
  const [strainType, setStrainType] = useState<StrainType>('Hybrid');
  const [brand, setBrand] = useState('');        // Cultivator (also used for edibles)
  const [lineage, setLineage] = useState('');
  const [thcPercent, setThcPercent] = useState('');
  const [thcaPercent, setThcaPercent] = useState('');
  const [method, setMethod] = useState<Method>('Pre-Roll');
  const [weight, setWeight] = useState('');      // grams
  const [effects, setEffects] = useState('');
  const [aroma, setAroma] = useState('');
  const [flavors, setFlavors] = useState('');
  const [rating, setRating] = useState('');

  // ---------- Edible-only fields ----------
  const [edibleName, setEdibleName] = useState('');
  const [edibleType, setEdibleType] = useState<EdibleType>('Gummy'); // category (Gummy/Chocolate/...)
  const [thcMg, setThcMg] = useState(''); // user input; we send this as edibleMg

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authed) {
      const t = setTimeout(() => router.push('/login?next=/tracker'), 0);
      return () => clearTimeout(t);
    }
  }, [authed, router]);

  // When user picks a previous cultivar, pre-fill fields (still editable)
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
      typeof s.thcPercent === 'number' && Number.isFinite(s.thcPercent)
        ? String(s.thcPercent)
        : ''
    );
    setThcaPercent(
      typeof s.thcaPercent === 'number' && Number.isFinite(s.thcaPercent)
        ? String(s.thcaPercent)
        : ''
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setErr('Not signed in. Please log in first.');
      router.push('/login?next=/tracker');
      return;
    }

    const timeMs = fromDatetimeLocal(timeLocal) ?? Date.now();

    let payload: CreateEntryInput;

    if (sessionType === 'edible') {
      // Edible session — Firestore will store edibleType (category) and edibleMg
      payload = {
        time: timeMs,
        method: 'Edible',
        isEdibleSession: true,
        // Use strainName so the UI shows the edible name consistently
        strainName: edibleName.trim(),
        strainType, // keep I/H/S classification separate from edible category
        brand: brand.trim() || undefined,

        edibleName: edibleName.trim(),
        edibleType,                // category: Gummy/Chocolate/Pill/Beverage
        edibleMg: toNum(thcMg),    // <— IMPORTANT: send edibleMg (not thcMg)

        // no smokeable-only fields for edibles
        weight: undefined,
        lineage: undefined,
        thcPercent: undefined,
        thcaPercent: undefined,

        // edibles don’t track these
        effects: undefined,
        aroma: undefined,
        flavors: undefined,
        rating: undefined,

        notes: notes.trim() || undefined,
      } as CreateEntryInput;
    } else {
      // Smokeable session — original fields preserved
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

        effects: effects
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        aroma: aroma
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        flavors: flavors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),

        rating: toNum(rating),
        notes: notes.trim() || undefined,
      } as CreateEntryInput;
    }

    try {
      setSubmitting(true);
      await createEntry(uid, payload);
      router.push('/tracker');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save entry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h2 style={{ marginTop: 0 }}>Log Session</h2>

      {/* Session type toggle */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${sessionType === 'smokeable' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSessionType('smokeable')}
        >
          Smokeable
        </button>
        <button
          type="button"
          className={`btn ${sessionType === 'edible' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSessionType('edible')}
        >
          Edible
        </button>
      </div>

      {/* Time */}
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="time">Time</label>
        <input
          id="time"
          type="datetime-local"
          className="input"
          value={timeLocal}
          onChange={(e) => setTimeLocal(e.target.value)}
          required
        />
        <div className="help">Auto-filled to current date and time — adjust if needed.</div>
      </div>

      {/* Smokeable: previous cultivars */}
      {sessionType === 'smokeable' && strains.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
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
          <div className="help">
            Selecting one just pre-fills the fields. Each session is still saved separately.
          </div>
        </div>
      )}

      {/* Smokeable fields */}
      {sessionType === 'smokeable' && (
        <>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
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

          {/* method + weight */}
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: '1fr 1fr',
              marginTop: '0.75rem',
            }}
          >
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

          {/* effects, aroma, flavors */}
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
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

          {/* rating + notes */}
          <div
            style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr', marginTop: '0.75rem' }}
          >
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

      {/* Edible fields */}
      {sessionType === 'edible' && (
        <>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
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

      {/* Notes (common) */}
      <div style={{ marginTop: '0.75rem' }}>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          className="input"
          placeholder="Any observations you want to remember…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {err && (
        <p className="error" style={{ marginTop: '0.5rem' }}>
          {err}
        </p>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Session'}
        </button>
        <button
          className="btn btn-ghost"
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
