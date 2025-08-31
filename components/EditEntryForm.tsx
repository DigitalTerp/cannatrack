'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { updateEntry, upsertStrainByName } from '@/lib/firestore';
import type { Entry, Method, StrainType, Strain } from '@/lib/types';

const METHODS: Method[] = ['Pre-Roll', 'Bong', 'Pipe', 'Vape', 'Dab'];
const TYPES: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];

function parseWeight(input: string): number | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase().replace(/grams?/, '').replace(/g\b/, '').trim();
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
function parseList(input: string): string[] | undefined {
  if (!input) return undefined;
  const arr = input.split(/[;,]/g).map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}
function joinList(list?: string[]): string {
  return Array.isArray(list) ? list.join(', ') : '';
}

type Props = {
  entry?: Entry | null;     // allow undefined/null on first paint
  strain?: Strain | null;
};

export default function EditEntryForm({ entry, strain }: Props) {
  const router = useRouter();

  // ---- SAFE defaults; we hydrate when props arrive ----
  const [strainName, setStrainName] = useState<string>('');
  const [strainType, setStrainType] = useState<StrainType>('Hybrid');
  const [method, setMethod] = useState<Method>('Pre-Roll');
  const [weightText, setWeightText] = useState<string>('');
  const [timeIso, setTimeIso] = useState<string>(() => {
    const d = new Date(Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState<string>('');

  const [effectsText, setEffectsText] = useState<string>('');
  const [aromaText, setAromaText] = useState<string>('');
  const [flavorsText, setFlavorsText] = useState<string>('');

  // Cultivar metadata
  const [cultivator, setCultivator] = useState<string>('');
  const [lineage, setLineage] = useState<string>('');
  const [thc, setThc] = useState<string>('');
  const [thca, setThca] = useState<string>('');
  const [cbd, setCbd] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 🔄 Hydrate from `entry` when it arrives
  useEffect(() => {
    if (!entry) return;
    setStrainName(entry.strainName ?? '');
    setStrainType(entry.strainType ?? 'Hybrid');
    setMethod(entry.method ?? 'Pre-Roll');
    setWeightText(entry.weight != null ? String(entry.weight) : '');
    const d = new Date(typeof entry.time === 'number' ? entry.time : Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setTimeIso(d.toISOString().slice(0, 16));
    setRating(typeof entry.rating === 'number' ? entry.rating : undefined);
    setNotes(entry.notes ?? '');
    setEffectsText(joinList(entry.effects));
    setAromaText(joinList(entry.aroma));
    setFlavorsText(joinList(entry.flavors));
  }, [entry]);

  useEffect(() => {
    setCultivator(strain?.brand ?? '');
    setLineage(strain?.lineage ?? '');
    setThc(typeof strain?.thcPercent === 'number' ? String(strain.thcPercent) : '');
    setThca(typeof strain?.thcaPercent === 'number' ? String(strain.thcaPercent) : '');
    setCbd(typeof strain?.cbdPercent === 'number' ? String(strain.cbdPercent) : '');
  }, [strain]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!entry) throw new Error('Entry not loaded yet.');
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in.');
      setSaving(true);
      setErr(null);

      // Upsert cultivar metadata and get id
      const newStrainId = await upsertStrainByName(uid, {
        name: strainName.trim(),
        type: strainType,
        brand: cultivator.trim() || undefined, // stored as "brand" in Firestore
        lineage: lineage.trim() || undefined,
        thcPercent: thc ? Number(thc) : undefined,
        thcaPercent: thca ? Number(thca) : undefined,
        cbdPercent: cbd ? Number(cbd) : undefined,
      });

      const patch: Partial<Entry> = {
        strainName: strainName.trim(),
        strainType,
        method,
        weight: parseWeight(weightText),
        time: new Date(timeIso).getTime(),
        rating,
        notes: notes.trim() || undefined,
        effects: parseList(effectsText),
        aroma: parseList(aromaText),
        flavors: parseList(flavorsText),
        strainId: newStrainId,
      };

      await updateEntry(uid, entry.id, patch);
      router.replace('/tracker');
    } catch (er: any) {
      setErr(er?.message ?? 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  if (!entry) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Edit Session</h2>
        <p className="subtle">Loading session…</p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2 style={{ marginTop: 0 }}>Edit Session</h2>
      {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <label>Cultivar name *</label>
          <input
            className="input"
            value={strainName}
            onChange={(e) => setStrainName(e.target.value)}
            placeholder="Eg. Blue Dream"
          />
        </div>

        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          <div>
            <label>Type</label>
            <select
              className="input"
              value={strainType}
              onChange={(e) => setStrainType(e.target.value as StrainType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Method of Consumption</label>
            <select
              className="input"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Weight (g)</label>
            <input
              className="input"
              inputMode="decimal"
              value={weightText}
              onChange={(e) => setWeightText(e.target.value)}
              placeholder="Eg. 0.35 g"
            />
          </div>

          <div>
            <label>Date & time</label>
            <input
              className="input"
              type="datetime-local"
              value={timeIso}
              onChange={(e) => setTimeIso(e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <div>
            <label>Effects</label>
            <input
              className="input"
              value={effectsText}
              onChange={(e) => setEffectsText(e.target.value)}
              placeholder="Eg. euphoric, relaxed, focused"
            />
          </div>

          <div>
            <label>Smell (Aroma)</label>
            <input
              className="input"
              value={aromaText}
              onChange={(e) => setAromaText(e.target.value)}
              placeholder="Eg. pine, citrus, diesel"
            />
            <div className="help">Comma or semicolon separated.</div>
          </div>

          <div>
            <label>Taste (Flavors)</label>
            <input
              className="input"
              value={flavorsText}
              onChange={(e) => setFlavorsText(e.target.value)}
              placeholder="Eg. blueberry, sweet, earthy"
            />
            <div className="help">Comma or semicolon separated.</div>
          </div>
        </div>

        <div>
          <label>Cultivator</label>
          <input
            className="input"
            value={cultivator}
            onChange={(e) => setCultivator(e.target.value)}
            placeholder="Eg. Alien Labs"
          />
        </div>

        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          <div>
            <label>Lineage</label>
            <input
              className="input"
              value={lineage}
              onChange={(e) => setLineage(e.target.value)}
              placeholder="Eg. Blueberry × Haze"
            />
          </div>
          <div>
            <label>THC %</label>
            <input
              className="input"
              inputMode="decimal"
              value={thc}
              onChange={(e) => setThc(e.target.value)}
            />
          </div>
          <div>
            <label>THCA %</label>
            <input
              className="input"
              inputMode="decimal"
              value={thca}
              onChange={(e) => setThca(e.target.value)}
            />
          </div>
          <div>
            <label>CBD %</label>
            <input
              className="input"
              inputMode="decimal"
              value={cbd}
              onChange={(e) => setCbd(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label>Rating</label>
          <input
            className="input"
            type="number"
            min={0}
            max={10}
            step={1}
            value={rating ?? ''}
            onChange={(e) =>
              setRating(e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </div>

        <div>
          <label>Notes</label>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Eg. Smooth, uplifting, helped with focus."
          />
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
