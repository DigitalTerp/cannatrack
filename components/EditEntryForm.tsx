'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { updateEntry, upsertStrainByName } from '@/lib/firestore';
import type { Entry, Method, StrainType, Strain, EdibleType } from '@/lib/types';

const METHODS: Method[] = ['Pre-Roll', 'Bong', 'Pipe', 'Vape', 'Dab'];
const TYPES: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];
const EDIBLE_TYPES: EdibleType[] = ['Gummy', 'Chocolate', 'Pill', 'Beverage'];

const looksEdible = (e?: Entry | null) => !!e && String(e.method) === 'Edible';

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
const toNum = (s: string) => {
  if (!s || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

type Props = {
  entry?: Entry | null;     // allow undefined/null on first paint
  strain?: Strain | null;   // smokeable auxiliary info only
};

export default function EditEntryForm({ entry, strain }: Props) {
  const router = useRouter();

  // Session type toggle
  const [sessionType, setSessionType] = useState<'smokeable' | 'edible'>(
    looksEdible(entry) ? 'edible' : 'smokeable'
  );

  // ---- Common ----
  const [timeIso, setTimeIso] = useState<string>(() => {
    const d = new Date(Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ---- Smokeable fields ----
  const [strainName, setStrainName] = useState<string>('');
  const [strainType, setStrainType] = useState<StrainType>('Hybrid');
  const [method, setMethod] = useState<Method>('Pre-Roll');
  const [weightText, setWeightText] = useState<string>('');
  const [rating, setRating] = useState<number | undefined>(undefined);

  const [effectsText, setEffectsText] = useState<string>('');
  const [aromaText, setAromaText] = useState<string>('');
  const [flavorsText, setFlavorsText] = useState<string>('');

  // Cultivar metadata (smokeables)
  const [cultivator, setCultivator] = useState<string>('');
  const [lineage, setLineage] = useState<string>('');
  const [thc, setThc] = useState<string>('');
  const [thca, setThca] = useState<string>('');
  const [cbd, setCbd] = useState<string>('');

  // ---- Edible-only fields ----
  const [edibleName, setEdibleName] = useState<string>('');
  const [edibleType, setEdibleType] = useState<EdibleType>('Gummy'); // category (Gummy/Chocolate/...)
  const [thcMgText, setThcMgText] = useState<string>(''); // mg

  // 🔄 Hydrate from `entry` when it arrives
  useEffect(() => {
    if (!entry) return;

    const edible = looksEdible(entry);

    // Common time/notes
    const d = new Date(typeof entry.time === 'number' ? entry.time : Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setTimeIso(d.toISOString().slice(0, 16));
    setNotes(entry.notes ?? '');
    setStrainType(entry.strainType ?? 'Hybrid');

    if (edible) {
      // ------- Edible hydrate -------
      setSessionType('edible');

      const name = (entry as any).edibleName || entry.strainName || '';
      setEdibleName(name);

      // CATEGORY comes from edibleKind in Firestore
      const kind = (entry as any).edibleKind as EdibleType | undefined;
      setEdibleType(kind && EDIBLE_TYPES.includes(kind) ? kind : 'Gummy');

      // MG comes from edibleMg
      const mg = (entry as any).edibleMg;
      setThcMgText(typeof mg === 'number' ? String(mg) : '');

      // Brand (we keep 'brand' on entries even for edibles)
      setCultivator(entry.brand ?? '');

      // Clear smokeable UI bits
      setMethod('Pre-Roll');
      setWeightText('');
      setRating(undefined);
      setEffectsText('');
      setAromaText('');
      setFlavorsText('');
      setLineage('');
      setThc('');
      setThca('');
      setCbd('');
      setStrainName(''); // we use edibleName instead
    } else {
      // ------- Smokeable hydrate -------
      setSessionType('smokeable');

      setStrainName(entry.strainName ?? '');
      setMethod((entry.method as Method) ?? 'Pre-Roll');
      setWeightText(entry.weight != null ? String(entry.weight) : '');
      setRating(typeof entry.rating === 'number' ? entry.rating : undefined);
      setEffectsText(joinList(entry.effects));
      setAromaText(joinList(entry.aroma));
      setFlavorsText(joinList(entry.flavors));

      // cultivar aux from `strain` if provided, else from entry-like fields
      setCultivator(strain?.brand ?? entry.brand ?? '');
      setLineage(strain?.lineage ?? entry.lineage ?? '');
      setThc(
        typeof (strain?.thcPercent ?? entry.thcPercent) === 'number'
          ? String(strain?.thcPercent ?? entry.thcPercent)
          : ''
      );
      setThca(
        typeof (strain?.thcaPercent ?? entry.thcaPercent) === 'number'
          ? String(strain?.thcaPercent ?? entry.thcaPercent)
          : ''
      );
      setCbd(
        typeof (strain?.cbdPercent ?? entry.cbdPercent) === 'number'
          ? String(strain?.cbdPercent ?? entry.cbdPercent)
          : ''
      );

      // Clear edible UI bits
      setEdibleName('');
      setEdibleType('Gummy');
      setThcMgText('');
    }
  }, [entry, strain]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!entry) throw new Error('Entry not loaded yet.');
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in.');
      setSaving(true);
      setErr(null);

      const patchTime = new Date(timeIso).getTime();

      if (sessionType === 'edible') {
        //  No cultivar upsert for edibles
        const patch: any = {
          time: patchTime,
          method: 'Edible',

          // keep display name consistent across app
          strainName: edibleName.trim(),
          strainType,
          brand: cultivator.trim() || undefined,

          // edible specifics (category + mg)
          edibleName: edibleName.trim(),
          edibleKind: edibleType,           // <— CATEGORY saved as edibleKind
          edibleMg: toNum(thcMgText),       // <— milligrams

          // ensure smokeable-specific fields aren’t set
          strainId: undefined,
          weight: undefined,
          lineage: undefined,
          thcPercent: undefined,
          thcaPercent: undefined,
          cbdPercent: undefined,
          effects: undefined,
          aroma: undefined,
          flavors: undefined,
          rating: undefined,

          notes: notes.trim() || undefined,
        };

        await updateEntry(uid, entry.id, patch);
      } else {
        // Smokeable: keep existing behavior (upsert cultivar metadata)
        const newStrainId = await upsertStrainByName(uid, {
          name: strainName.trim(),
          type: strainType,
          brand: cultivator.trim() || undefined,
          lineage: lineage.trim() || undefined,
          thcPercent: toNum(thc),
          thcaPercent: toNum(thca),
          cbdPercent: toNum(cbd),
        });

        const patch: Partial<Entry> = {
          time: patchTime,
          strainName: strainName.trim(),
          strainType,
          method,
          weight: parseWeight(weightText),

          rating,
          notes: notes.trim() || undefined,
          effects: parseList(effectsText),
          aroma: parseList(aromaText),
          flavors: parseList(flavorsText),

          // keep cultivar linkage & metadata in-entry
          strainId: newStrainId,
          brand: cultivator.trim() || undefined,
          lineage: lineage.trim() || undefined,
          thcPercent: toNum(thc),
          thcaPercent: toNum(thca),
          cbdPercent: toNum(cbd),

          // ensure edible-only fields aren’t set (Firestore ignores unknowns anyway)
        };

        await updateEntry(uid, entry.id, patch as any);
      }

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

      <div style={{ marginBottom: '1rem' }}>
        <label>Date &amp; time</label>
        <input
          className="input"
          type="datetime-local"
          value={timeIso}
          onChange={(e) => setTimeIso(e.target.value)}
        />
      </div>

      {/* --- Edible fields --- */}
      {sessionType === 'edible' && (
        <>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              marginBottom: '0.5rem',
            }}
          >
            <div>
              <label>Edible name *</label>
              <input
                className="input"
                value={edibleName}
                onChange={(e) => setEdibleName(e.target.value)}
                placeholder="Eg. Midnight Berry 10mg"
              />
            </div>

            <div>
              <label>Type (Indica/Hybrid/Sativa)</label>
              <select
                className="input"
                value={strainType}
                onChange={(e) => setStrainType(e.target.value as StrainType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Brand</label>
              <input
                className="input"
                value={cultivator}
                onChange={(e) => setCultivator(e.target.value)}
                placeholder="Eg. Kiva"
              />
            </div>

            <div>
              <label>Edible type</label>
              <select
                className="input"
                value={edibleType}
                onChange={(e) => setEdibleType(e.target.value as EdibleType)}
              >
                {EDIBLE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label>THC (mg)</label>
              <input
                className="input"
                inputMode="decimal"
                type="number"
                step="0.1"
                value={thcMgText}
                onChange={(e) => setThcMgText(e.target.value)}
                placeholder="Eg. 10"
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Eg. onset in ~45m, mellow, good sleep."
            />
          </div>
        </>
      )}

      {sessionType === 'smokeable' && (
        <>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            <div>
              <label>Cultivar name *</label>
              <input
                className="input"
                value={strainName}
                onChange={(e) => setStrainName(e.target.value)}
                placeholder="Eg. Blue Dream"
              />
            </div>

            <div>
              <label>Type</label>
              <select
                className="input"
                value={strainType}
                onChange={(e) => setStrainType(e.target.value as StrainType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Method of consumption</label>
              <select
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
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
                placeholder="Eg. 0.35"
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              marginTop: '0.75rem',
            }}
          >
            <div>
              <label>Cultivator</label>
              <input
                className="input"
                value={cultivator}
                onChange={(e) => setCultivator(e.target.value)}
                placeholder="Eg. Alien Labs"
              />
            </div>
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

          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              marginTop: '0.75rem',
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

          <div style={{ marginTop: '0.75rem' }}>
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

          <div style={{ marginTop: '0.75rem' }}>
            <label>Notes</label>
            <textarea
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Eg. Smooth, uplifting, helped with focus."
            />
          </div>
        </>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
