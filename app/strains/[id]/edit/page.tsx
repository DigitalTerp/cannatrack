'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getStrainById } from '@/lib/firestore';
import type { StrainType } from '@/lib/types';

/* Avoid sending undefined to Firestore */
function stripUndefined<T extends Record<string, any>>(obj: T) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
function parseCSV(str: string): string[] {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const TYPES: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];

export default function EditStrainPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [name, setName] = useState('');
  const [type, setType] = useState<StrainType>('Hybrid');
  const [brand, setBrand] = useState('');
  const [lineage, setLineage] = useState('');
  const [thcPercent, setThcPercent] = useState<string>('');   // keep as string, parse on save
  const [thcaPercent, setThcaPercent] = useState<string>('');

  // Experience fields (stored on the cultivar doc for easy editing)
  const [effectsStr, setEffectsStr] = useState('');  // comma-separated input
  const [flavorsStr, setFlavorsStr] = useState('');
  const [aromaStr, setAromaStr] = useState('');
  const [ratingStr, setRatingStr] = useState('');    // 0-10
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // load cultivar once we have a user
  useEffect(() => {
    (async () => {
      if (!user || !id) return;
      setLoading(true);
      setError(null);
      try {
        // normalized fields via helper
        const s = await getStrainById(user.uid, id);
        if (!s) {
          setError('Not found or no access.');
          setLoading(false);
          return;
        }
        // hydrate basic fields
        setName(s.name || '');
        setType((s.type as StrainType) || 'Hybrid');
        setBrand(s.brand || '');
        setLineage(s.lineage || '');
        setThcPercent(typeof s.thcPercent === 'number' ? String(s.thcPercent) : '');
        setThcaPercent(typeof s.thcaPercent === 'number' ? String(s.thcaPercent) : '');

        // load optional experience fields directly from raw doc
        const ref = doc(db, 'users', user.uid, 'strains', id);
        const snap = await getDoc(ref);
        const raw = snap.exists() ? (snap.data() as any) : {};

        const effects = Array.isArray(raw.effects) ? raw.effects : [];
        const flavors = Array.isArray(raw.flavors) ? raw.flavors : [];
        const aroma   = Array.isArray(raw.aroma)   ? raw.aroma   : [];
        const rating  = typeof raw.rating === 'number' ? raw.rating : undefined;
        const notes   = typeof raw.notes === 'string' ? raw.notes : '';

        setEffectsStr(effects.join(', '));
        setFlavorsStr(flavors.join(', '));
        setAromaStr(aroma.join(', '));
        setRatingStr(rating !== undefined ? String(rating) : '');
        setNotes(notes || '');
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load cultivar.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, id]);

  const canSave = useMemo(
    () => name.trim().length > 0 && !!user && !!id,
    [name, user, id]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !id || !canSave) return;

    setSaving(true);
    setError(null);
    try {
      // allow any number of decimal places, and leading ".53"
      const nThc  = thcPercent.trim()  === '' ? undefined : Number(thcPercent);
      const nThca = thcaPercent.trim() === '' ? undefined : Number(thcaPercent);

      if ((nThc !== undefined && Number.isNaN(nThc)) ||
          (nThca !== undefined && Number.isNaN(nThca))) {
        setError('THC/THCA must be valid numbers (e.g., .53, 18.275).');
        setSaving(false);
        return;
      }

      // rating 0–10 if provided
      const nRating = ratingStr.trim() === '' ? undefined : Number(ratingStr);
      if (nRating !== undefined && (Number.isNaN(nRating) || nRating < 0 || nRating > 10)) {
        setError('Rating must be a number from 0 to 10.');
        setSaving(false);
        return;
      }

      const payload = stripUndefined({
        name: name.trim(),
        nameLower: name.trim().toLowerCase(),
        name_lc: name.trim().toLowerCase(), // keep legacy field in sync
        type,
        brand: brand.trim() || undefined,
        lineage: lineage.trim() || undefined,
        thcPercent: nThc,
        thcaPercent: nThca,

        // experience fields
        effects: parseCSV(effectsStr),
        flavors: parseCSV(flavorsStr),
        aroma:   parseCSV(aromaStr),
        rating:  nRating,
        notes:   notes.trim() || undefined,

        updatedAt: Date.now(),
      });

      const ref = doc(db, 'users', user.uid, 'strains', id);
      await updateDoc(ref, payload);

      router.push('/strains'); // back to list
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    // not logged in → send to login with redirect back here
    router.replace(`/login?next=/strains/${id}/edit`);
    return null;
  }

  return (
    <div className="container">
      <div className="page-hero">
        <h1>Edit Cultivar</h1>
      </div>

      {loading ? (
        <div className="card">Loading…</div>
      ) : error ? (
        <div className="card"><p className="error">{error}</p></div>
      ) : (
        <form className="card" onSubmit={handleSave}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label htmlFor="name">Cultivar Name</label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Blue Dream"
                required
              />
            </div>

            <div>
              <label htmlFor="type">Type</label>
              <select
                id="type"
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as StrainType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="brand">Cultivator</label>
              <input
                id="brand"
                className="input"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Acme Farms"
              />
            </div>

            <div>
              <label htmlFor="lineage">Lineage</label>
              <input
                id="lineage"
                className="input"
                value={lineage}
                onChange={(e) => setLineage(e.target.value)}
                placeholder="e.g., Blueberry × Haze"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="thc">THC %</label>
                <input
                  id="thc"
                  className="input"
                  type="number"
                  step="any"         // ← allow any decimals
                  inputMode="decimal"// ← better mobile keyboard
                  min="0"
                  value={thcPercent}
                  onChange={(e) => setThcPercent(e.target.value)}
                  placeholder="e.g., .53 or 18.275"
                />
              </div>
              <div>
                <label htmlFor="thca">THCA %</label>
                <input
                  id="thca"
                  className="input"
                  type="number"
                  step="any"         // ← allow any decimals
                  inputMode="decimal"
                  min="0"
                  value={thcaPercent}
                  onChange={(e) => setThcaPercent(e.target.value)}
                  placeholder="e.g., .53 or 23.742"
                />
              </div>
            </div>

            {/* Experience fields */}
            <div>
              <label htmlFor="effects">Effects (comma-separated)</label>
              <input
                id="effects"
                className="input"
                value={effectsStr}
                onChange={(e) => setEffectsStr(e.target.value)}
                placeholder="relaxed, euphoric, focused"
              />
            </div>

            <div>
              <label htmlFor="flavors">Flavors (comma-separated)</label>
              <input
                id="flavors"
                className="input"
                value={flavorsStr}
                onChange={(e) => setFlavorsStr(e.target.value)}
                placeholder="berry, citrus, pine"
              />
            </div>

            <div>
              <label htmlFor="aroma">Smells / Aroma (comma-separated)</label>
              <input
                id="aroma"
                className="input"
                value={aromaStr}
                onChange={(e) => setAromaStr(e.target.value)}
                placeholder="sweet, earthy, diesel"
              />
            </div>

            <div>
              <label htmlFor="rating">Rating (0–10)</label>
              <input
                id="rating"
                className="input"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={ratingStr}
                onChange={(e) => setRatingStr(e.target.value)}
                placeholder="e.g., 8.5"
              />
            </div>

            <div>
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth remembering about this cultivar…"
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={!canSave || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => router.push('/strains')}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
