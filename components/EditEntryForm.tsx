'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { updateEntry, upsertStrainByName } from '@/lib/firestore';
import type { Entry, Method, StrainType, Strain, EdibleType } from '@/lib/types';
import styles from './FormEntry.module.css';

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
  entry?: Entry | null;  
  strain?: Strain | null;  
};

export default function EditEntryForm({ entry, strain }: Props) {
  const router = useRouter();

  const [sessionType, setSessionType] = useState<'smokeable' | 'edible'>(
    looksEdible(entry) ? 'edible' : 'smokeable'
  );

  const [timeIso, setTimeIso] = useState<string>(() => {
    const d = new Date(Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [strainName, setStrainName] = useState<string>('');
  const [strainType, setStrainType] = useState<StrainType>('Hybrid');
  const [method, setMethod] = useState<Method>('Pre-Roll');
  const [weightText, setWeightText] = useState<string>('');
  const [rating, setRating] = useState<number | undefined>(undefined);

  const [effectsText, setEffectsText] = useState<string>('');
  const [aromaText, setAromaText] = useState<string>('');
  const [flavorsText, setFlavorsText] = useState<string>('');

  const [cultivator, setCultivator] = useState<string>('');
  const [lineage, setLineage] = useState<string>('');
  const [thc, setThc] = useState<string>('');
  const [thca, setThca] = useState<string>('');
  const [cbd, setCbd] = useState<string>('');

  const [edibleName, setEdibleName] = useState<string>('');
  const [edibleType, setEdibleType] = useState<EdibleType>('Gummy');
  const [thcMgText, setThcMgText] = useState<string>(''); // mg

  useEffect(() => {
    if (!entry) return;

    const edible = looksEdible(entry);
    const d = new Date(typeof entry.time === 'number' ? entry.time : Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setTimeIso(d.toISOString().slice(0, 16));
    setNotes(entry.notes ?? '');
    setStrainType(entry.strainType ?? 'Hybrid');

    if (edible) {
      setSessionType('edible');

      const name = (entry as any).edibleName || entry.strainName || '';
      setEdibleName(name);
      const kind = (entry as any).edibleKind as EdibleType | undefined;
      setEdibleType(kind && EDIBLE_TYPES.includes(kind) ? kind : 'Gummy');
      const mg = (entry as any).edibleMg;
      setThcMgText(typeof mg === 'number' ? String(mg) : '');
      setCultivator(entry.brand ?? '');
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
      setStrainName('');
    } else {
      
      setSessionType('smokeable');

      setStrainName(entry.strainName ?? '');
      setMethod((entry.method as Method) ?? 'Pre-Roll');
      setWeightText(entry.weight != null ? String(entry.weight) : '');
      setRating(typeof entry.rating === 'number' ? entry.rating : undefined);
      setEffectsText(joinList(entry.effects));
      setAromaText(joinList(entry.aroma));
      setFlavorsText(joinList(entry.flavors));
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
        const patch: any = {
          time: patchTime,
          method: 'Edible',
          strainName: edibleName.trim(),
          strainType,
          brand: cultivator.trim() || undefined,
          edibleName: edibleName.trim(),
          edibleKind: edibleType,
          edibleMg: toNum(thcMgText),
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
        <h2 className={styles.heading}>Edit Session</h2>
        <p className="subtle">Loading session…</p>
      </div>
    );
  }
const displayTitle =
  sessionType === 'edible'
    ? (edibleName?.trim() || 'Unnamed edible')
    : (strainName?.trim() || 'Unnamed cultivar');


  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h2 className={styles.heading}>{displayTitle}</h2>
<div className={styles.subheading}>
  {sessionType === 'edible'
    ? ['Edible', edibleType, cultivator].filter(Boolean).join(' • ')
    : [method, strainType, cultivator].filter(Boolean).join(' • ')}
</div>

      {err && <div className={styles.errorTop}>{err}</div>}

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
        <label>Date &amp; time</label>
        <input
          className="input"
          type="datetime-local"
          value={timeIso}
          onChange={(e) => setTimeIso(e.target.value)}
        />
      </div>

      {sessionType === 'edible' && (
        <>
          <div className={`${styles.gridAutoSmall} ${styles.section}`}>
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

          <div className={styles.section}>
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
          <div className={styles.gridAutoSmall}>
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

          <div className={`${styles.gridAutoSmall} ${styles.section}`}>
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

          <div className={`${styles.gridAutoMed} ${styles.section}`}>
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
            </div>

            <div>
              <label>Taste (Flavors)</label>
              <input
                className="input"
                value={flavorsText}
                onChange={(e) => setFlavorsText(e.target.value)}
                placeholder="Eg. blueberry, sweet, earthy"
              />
            </div>
          </div>

          <div className={styles.section}>
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

          <div className={styles.section}>
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

      <div className={styles.actions}>
        <button className={`btn btn-primary ${styles.btnWide}`} disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
