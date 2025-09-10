import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Entry, Strain, StrainType } from './types';

/* ----------------------------- UTILITIES ----------------------------- */
const now = () => Date.now();
const isFiniteNumber = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);

function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj as T;
  if (Array.isArray(obj)) {
    const arr = (obj as unknown as any[])
      .map((v) => stripUndefined(v))
      .filter((v) => v !== undefined);
    return arr as unknown as T;
  }
  const out: any = {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v as any);
  }
  return out as T;
}

/** Accepts number or numeric string; strips "g"/"grams" if present. */
function parseWeightToNumber(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase().replace(/grams?/, '').replace(/g\b/, '').trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Accepts number or numeric string; strips "mg"/"milligram(s)" if present. */
function parseMgToNumber(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const s = v
      .trim()
      .toLowerCase()
      .replace(/milligrams?/, '')
      .replace(/\bmg\b/, '')
      .trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Convert a field to number if possible; otherwise undefined. */
function toNum(v: any): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Normalize to a string array (comma-separated string or array of strings). */
function toList(v: any): string[] | undefined {
  if (Array.isArray(v)) {
    const out = v
      .map((x) => (typeof x === 'string' ? x.trim() : String(x)))
      .filter((s) => s.length > 0);
    return out.length ? out : undefined;
  }
  if (typeof v === 'string') {
    const parts = v
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return parts.length ? parts : undefined;
  }
  return undefined;
}

/** Indica/Hybrid/Sativa */
function normalizeStrainType(v: any): StrainType | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'indica') return 'Indica';
  if (s === 'sativa') return 'Sativa';
  if (s === 'hybrid') return 'Hybrid';
  return undefined;
}

/** Edible category: Chocolate/Gummy/Pill/Beverage/Other */
type EdibleCategory = 'Chocolate' | 'Gummy' | 'Pill' | 'Beverage' | 'Other';
function normalizeEdibleCategory(v: any): EdibleCategory | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return undefined;
  if (s.startsWith('choc')) return 'Chocolate';
  if (s.startsWith('gum')) return 'Gummy';
  if (s.startsWith('pill') || s.startsWith('cap')) return 'Pill';
  if (s.startsWith('bev') || s.startsWith('drink')) return 'Beverage';
  if (s === 'other') return 'Other';
  return undefined;
}

/** Best-effort edible category from multiple possible field names. */
function coerceEdibleCategory(raw: any): EdibleCategory | undefined {
  // Try known fields in priority order; ignore I/H/S strings accidentally saved into edibleType
  return (
    normalizeEdibleCategory(raw?.edibleType) ||
    normalizeEdibleCategory(raw?.edibleKind) ||
    normalizeEdibleCategory(raw?.edibleForm) ||
    normalizeEdibleCategory(raw?.edibleCategory) ||
    undefined
  );
}

/* --------------------------- refs/helpers --------------------------- */
const entriesCol = (uid: string) => collection(db, 'users', uid, 'entries');
const strainsCol = (uid: string) => collection(db, 'users', uid, 'strains');
const entryRef   = (uid: string, entryId: string) => doc(db, 'users', uid, 'entries', entryId);
const strainRef  = (uid: string, strainId: string) => doc(db, 'users', uid, 'strains', strainId);

/* --------------------------- Cultivars ( Strains )--------------------------- */

type UpsertStrainInput = {
  name: string;
  type: StrainType;
  brand?: string;
  lineage?: string;
  thcPercent?: number;
  thcaPercent?: number;
  cbdPercent?: number;
  effects?: string[];
  flavors?: string[];
  aroma?: string[];
  rating?: number;
  notes?: string;
};

/** Create or update a cultivar by name (case-insensitive). Returns the doc ID. */
export async function upsertStrainByName(uid: string, input: UpsertStrainInput): Promise<string> {
  const name = input.name.trim();
  const nameLower = name.toLowerCase();

  // find by modern (nameLower) or legacy (name_lc)
  let found = await getDocs(query(strainsCol(uid), where('nameLower', '==', nameLower), limit(1)));
  if (found.empty) {
    found = await getDocs(query(strainsCol(uid), where('name_lc', '==', nameLower), limit(1)));
  }

  const base = stripUndefined({
    name,
    nameLower,
    name_lc: nameLower,
    type: input.type,
    brand: input.brand?.trim() || undefined,
    lineage: input.lineage?.trim() || undefined,
    thcPercent: isFiniteNumber(input.thcPercent) ? input.thcPercent : undefined,
    thcaPercent: isFiniteNumber(input.thcaPercent) ? input.thcaPercent : undefined,
    cbdPercent: isFiniteNumber(input.cbdPercent) ? input.cbdPercent : undefined,
    effects: Array.isArray(input.effects) ? input.effects : undefined,
    flavors: Array.isArray(input.flavors) ? input.flavors : undefined,
    aroma:   Array.isArray(input.aroma)   ? input.aroma   : undefined,
    rating:  isFiniteNumber(input.rating) ? input.rating  : undefined,
    notes:   typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : undefined,
    updatedAt: now(),
  });

  if (!found.empty) {
    const id = found.docs[0].id;
    await updateDoc(strainRef(uid, id), base as any);
    return id;
  } else {
    const res = await addDoc(strainsCol(uid), { ...base, createdAt: now() });
    return res.id;
  }
}

export async function getStrainById(uid: string, strainId: string): Promise<Strain | null> {
  if (!uid) throw new Error('getStrainById: missing uid');
  if (!strainId) throw new Error('getStrainById: missing strainId');
  try {
    const snap = await getDoc(strainRef(uid, strainId));
    if (!snap.exists()) return null;
    const raw = snap.data() as any;
    const name = String(raw?.name ?? '');
    const nameLower: string = (raw?.nameLower ?? raw?.name_lc ?? name).toString().toLowerCase();

    const strain: Strain = {
      id: snap.id,
      name,
      nameLower,
      type: raw?.type ?? 'Hybrid',
      brand: raw?.brand ?? undefined,
      lineage: raw?.lineage ?? undefined,
      thcPercent: isFiniteNumber(raw?.thcPercent) ? raw.thcPercent : undefined,
      thcaPercent: isFiniteNumber(raw?.thcaPercent) ? raw.thcaPercent : undefined,
      cbdPercent: isFiniteNumber(raw?.cbdPercent) ? raw.cbdPercent : undefined,
      createdAt: isFiniteNumber(raw?.createdAt) ? raw.createdAt : undefined,
      updatedAt: isFiniteNumber(raw?.updatedAt) ? raw.updatedAt : undefined,
      effects: Array.isArray(raw?.effects) ? raw.effects : undefined,
      flavors: Array.isArray(raw?.flavors) ? raw.flavors : undefined,
      aroma:   Array.isArray(raw?.aroma)   ? raw.aroma   : undefined,
      rating:  isFiniteNumber(raw?.rating) ? raw.rating  : undefined,
      notes:   typeof raw?.notes === 'string' ? raw.notes : undefined,
    };
    return strain;
  } catch (err: any) {
    if (err?.code === 'permission-denied') return null;
    throw err;
  }
}

export async function listStrains(uid: string): Promise<Strain[]> {
  const q = query(strainsCol(uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as any;
    const name = String(raw?.name ?? '');
    const nameLower: string = (raw?.nameLower ?? raw?.name_lc ?? name).toString().toLowerCase();
    return {
      id: d.id,
      name,
      nameLower,
      type: raw?.type ?? 'Hybrid',
      brand: raw?.brand ?? undefined,
      lineage: raw?.lineage ?? undefined,
      thcPercent: isFiniteNumber(raw?.thcPercent) ? raw.thcPercent : undefined,
      thcaPercent: isFiniteNumber(raw?.thcaPercent) ? raw.thcaPercent : undefined,
      cbdPercent: isFiniteNumber(raw?.cbdPercent) ? raw.cbdPercent : undefined,
      createdAt: isFiniteNumber(raw?.createdAt) ? raw.createdAt : undefined,
      updatedAt: isFiniteNumber(raw?.updatedAt) ? raw.updatedAt : undefined,
      effects: Array.isArray(raw?.effects) ? raw.effects : undefined,
      flavors: Array.isArray(raw?.flavors) ? raw.flavors : undefined,
      aroma:   Array.isArray(raw?.aroma)   ? raw.aroma   : undefined,
      rating:  isFiniteNumber(raw?.rating) ? raw.rating  : undefined,
      notes:   typeof raw?.notes === 'string' ? raw.notes : undefined,
    } as Strain;
  });
}

export async function deleteStrain(uid: string, strainId: string): Promise<void> {
  await deleteDoc(strainRef(uid, strainId));
}

/* ------------------------------- ENTRIES ------------------------------- */

/**
 * Create a new entry (session).
 * - Smokeables: behaves like before (and upserts cultivar).
 * - Edibles: saves edible fields and **does not** upsert cultivar.
 */
export async function createEntry(
  uid: string,
  payload: Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<string> {
  const methodStr = String((payload as any).method || '').trim();
  const isEdible =
    methodStr.toLowerCase() === 'edible' || (payload as any).isEdibleSession === true;

  const weight = !isEdible
    ? parseWeightToNumber((payload as any).weight ?? (payload as any).dose)
    : undefined;

  // Normalize cultivar details (used for smokeables only)
  const strainNameRaw = (payload as any).strainName?.trim?.() || '';
  const strainType = normalizeStrainType((payload as any).strainType) || 'Hybrid';
  const brand      = (payload as any).brand?.trim?.() || undefined;
  const lineage    = (payload as any).lineage?.trim?.() || undefined;
  const flavors = toList((payload as any).flavors ?? (payload as any).taste);
  const aroma   = toList((payload as any).aroma   ?? (payload as any).smell);
  const effects = toList((payload as any).effects);
  const rating  = toNum((payload as any).rating);
  const notes   = (payload as any).notes?.trim?.() || undefined;
  const thcPercent  = toNum((payload as any).thcPercent);
  const thcaPercent = toNum((payload as any).thcaPercent);
  const cbdPercent  = toNum((payload as any).cbdPercent);

  // ---- Edible-specific fields ----
  const edibleName = (payload as any).edibleName?.trim?.() || undefined;
  // CATEGORY (Chocolate/Gummy/...) goes into edibleType (and mirrored to edibleKind)
  const edibleCategory: EdibleCategory | undefined =
    coerceEdibleCategory(payload as any) ||
    normalizeEdibleCategory((payload as any).edibleType) || // if caller already sends proper category
    undefined;
  const edibleMg = parseMgToNumber((payload as any).edibleMg ?? (payload as any).dose ?? (payload as any).mg);

  // Upsert cultivar ONLY for smokeables and when we have a name
  let strainId = (payload as any).strainId as string | undefined;
  if (!isEdible && strainNameRaw) {
    try {
      strainId = await upsertStrainByName(uid, {
        name: strainNameRaw,
        type: strainType,
        brand,
        lineage,
        thcPercent,
        thcaPercent,
        cbdPercent,
        effects,
        flavors,
        aroma,
        rating,
        notes,
      });
    } catch {
      // don't block entry creation if strain upsert fails
    }
  }

  const data = stripUndefined({
    ...payload,
    userId: uid,
    time: isFiniteNumber((payload as any).time) ? (payload as any).time : now(),
    method: methodStr || (isEdible ? 'Edible' : (payload as any).method) || 'Pre-Roll',

    // --- Common (kept on entry) ---
    strainId: !isEdible ? (strainId || (payload as any).strainId || undefined) : undefined,
    strainName: !isEdible ? strainNameRaw : undefined,
    strainNameLower: !isEdible && strainNameRaw ? strainNameRaw.toLowerCase() : undefined,
    strainType, // I/H/S always kept here
    brand,
    brandLower: brand ? brand.toLowerCase() : undefined,
    lineage,
    thcPercent,
    thcaPercent,
    cbdPercent,
    effects,
    flavors,
    aroma,
    rating,
    notes,

    // --- Measurements ---
    weight,      // grams (smokeables)
    edibleMg,    // mg (edibles)

    // --- Edible flags/meta ---
    isEdibleSession: isEdible || undefined,
    edibleName: isEdible ? edibleName || strainNameRaw || undefined : undefined,
    edibleType: isEdible ? (edibleCategory ?? 'Other') : undefined, // <- CATEGORY saved here
    edibleKind: isEdible ? (edibleCategory ?? 'Other') : undefined, // mirror for compatibility

    createdAt: now(),
    updatedAt: now(),
  });

  const res = await addDoc(entriesCol(uid), data as any);
  return res.id;
}

export async function updateEntry(
  uid: string,
  entryId: string,
  patch: Partial<Entry>
): Promise<void> {
  const methodStr = String((patch as any).method ?? '').trim();
  const isEdiblePatch =
    methodStr.toLowerCase() === 'edible' ||
    (patch as any).isEdibleSession === true ||
    (patch as any).edibleName != null ||
    (patch as any).edibleMg != null ||
    (patch as any).edibleType != null ||
    (patch as any).edibleKind != null;

  const weight = !isEdiblePatch
    ? parseWeightToNumber((patch as any).weight ?? (patch as any).dose)
    : undefined;

  // smokeable-only cultivar fields
  const strainName = !isEdiblePatch ? (patch as any).strainName?.trim?.() : undefined;
  const strainType = normalizeStrainType((patch as any).strainType) || 'Hybrid';
  const brand      = !isEdiblePatch ? (patch as any).brand?.trim?.() : undefined;
  const lineage    = !isEdiblePatch ? (patch as any).lineage?.trim?.() : undefined;

  const flavors = !isEdiblePatch ? toList((patch as any).flavors ?? (patch as any).taste) : undefined;
  const aroma   = !isEdiblePatch ? toList((patch as any).aroma   ?? (patch as any).smell) : undefined;

  const effects = toList((patch as any).effects);
  const rating  = toNum((patch as any).rating);
  const notes   = (patch as any).notes?.trim?.();

  const thcPercent  = !isEdiblePatch ? toNum((patch as any).thcPercent)  : undefined;
  const thcaPercent = !isEdiblePatch ? toNum((patch as any).thcaPercent) : undefined;
  const cbdPercent  = !isEdiblePatch ? toNum((patch as any).cbdPercent)  : undefined;

  // edible fields (CATEGORY goes to edibleType & edibleKind)
  const edibleName = isEdiblePatch ? (patch as any).edibleName?.trim?.() : undefined;
  const edibleCategory: EdibleCategory | undefined = isEdiblePatch
    ? (coerceEdibleCategory(patch as any) ||
       normalizeEdibleCategory((patch as any).edibleType) ||
       normalizeEdibleCategory((patch as any).edibleKind) ||
       undefined)
    : undefined;
  const edibleMg   = isEdiblePatch ? parseMgToNumber((patch as any).edibleMg ?? (patch as any).dose ?? (patch as any).mg) : undefined;

  const norm = stripUndefined({
    ...patch,
    method: methodStr || (patch as any).method,
    weight,

    // smokeable-only cultivar fields
    strainName,
    strainNameLower: typeof strainName === 'string' ? strainName.toLowerCase() : undefined,
    brand,
    brandLower: typeof brand === 'string' ? brand.toLowerCase() : undefined,
    lineage,
    thcPercent,
    thcaPercent,
    cbdPercent,

    // common
    strainType, // keep I/H/S on entry
    effects,
    flavors,
    aroma,
    rating,
    notes,
    updatedAt: now(),

    // edible fields
    isEdibleSession: isEdiblePatch ? true : (patch as any).isEdibleSession,
    edibleName,
    edibleType: edibleCategory, // CATEGORY saved here
    edibleKind: edibleCategory, // mirror
    edibleMg,
  });
  await updateDoc(entryRef(uid, entryId), norm as any);

  // Refresh the strain doc ONLY for smokeables
  const shouldTouchStrain =
    !isEdiblePatch &&
    (typeof strainName === 'string' ||
      brand !== undefined ||
      lineage !== undefined ||
      thcPercent !== undefined ||
      thcaPercent !== undefined ||
      cbdPercent !== undefined ||
      effects !== undefined ||
      flavors !== undefined ||
      aroma !== undefined ||
      rating !== undefined ||
      notes !== undefined);

  if (shouldTouchStrain) {
    const effectiveName =
      typeof strainName === 'string' && strainName
        ? strainName
        : (patch as any).strainName || '';
    if (effectiveName) {
      try {
        await upsertStrainByName(uid, {
          name: effectiveName,
          type: strainType,
          brand,
          lineage,
          thcPercent,
          thcaPercent,
          cbdPercent,
          effects,
          flavors,
          aroma,
          rating,
          notes,
        });
      } catch {
        // ignore cultivar upsert errors
      }
    }
  }
}

export async function deleteEntry(uid: string, entryId: string): Promise<void> {
  await deleteDoc(entryRef(uid, entryId));
}

export async function getEntry(uid: string, entryId: string): Promise<Entry | null> {
  if (!uid) throw new Error('getEntry: missing uid');
  if (!entryId) throw new Error('getEntry: missing entryId');

  try {
    const snap = await getDoc(entryRef(uid, entryId));
    if (!snap.exists()) return null;

    const raw = snap.data() as any;
    const isEdible =
      raw?.isEdibleSession === true || String(raw?.method || '').toLowerCase() === 'edible';

    const entry: Entry = {
      id: snap.id,
      userId: uid,
      createdAt: isFiniteNumber(raw?.createdAt) ? raw.createdAt : now(),
      updatedAt: isFiniteNumber(raw?.updatedAt) ? raw.updatedAt : now(),

      time: isFiniteNumber(raw?.time) ? raw.time : now(),
      method: raw?.method ?? 'Pre-Roll',

      // linkage & identity
      strainId: !isEdible ? (raw?.strainId ?? undefined) : undefined,
      strainName: !isEdible ? (raw?.strainName ?? '') : '',
      strainType: normalizeStrainType(raw?.strainType) || 'Hybrid',
      strainNameLower:
        !isEdible
          ? (raw?.strainNameLower ??
            (raw?.strainName ? String(raw.strainName).toLowerCase() : undefined))
          : undefined,

      // curated convenience fields kept on entry (smokeables)
      brand: !isEdible ? (raw?.brand ?? undefined) : undefined,
      brandLower: !isEdible
        ? (raw?.brandLower ?? (raw?.brand ? String(raw.brand).toLowerCase() : undefined))
        : undefined,
      lineage: !isEdible ? (raw?.lineage ?? undefined) : undefined,
      thcPercent: !isEdible && isFiniteNumber(raw?.thcPercent) ? raw.thcPercent : undefined,
      thcaPercent: !isEdible && isFiniteNumber(raw?.thcaPercent) ? raw.thcaPercent : undefined,
      cbdPercent: !isEdible && isFiniteNumber(raw?.cbdPercent) ? raw.cbdPercent : undefined,

      // normalized measurements
      weight: !isEdible ? parseWeightToNumber(raw?.weight ?? raw?.dose) : undefined,

      // experience
      moodBefore: raw?.moodBefore ?? undefined,
      moodAfter: raw?.moodAfter ?? undefined,
      effects: Array.isArray(raw?.effects) ? raw.effects : undefined,
      flavors: Array.isArray(raw?.flavors) ? raw.flavors : undefined,
      aroma: Array.isArray(raw?.aroma) ? raw.aroma : undefined,
      rating: isFiniteNumber(raw?.rating) ? raw.rating : undefined,
      notes: raw?.notes ?? undefined,
    } as Entry;

    // attach edible fields for convenience (not in Entry type)
    if (isEdible) {
      (entry as any).isEdibleSession = true;
      (entry as any).edibleName = raw?.edibleName ?? raw?.strainName ?? undefined;

      // CATEGORY (Chocolate/Gummy/...) — prefer any correct field, ignore I/H/S mistakes
      const cat = coerceEdibleCategory(raw);
      (entry as any).edibleType = cat; // what the app reads
      (entry as any).edibleKind = cat; // for compatibility

      (entry as any).edibleMg = parseMgToNumber(raw?.edibleMg ?? raw?.dose ?? raw?.mg);
    }

    return entry;
  } catch (err: any) {
    if (err?.code === 'permission-denied') return null;
    throw err;
  }
}

export async function listAllEntries(uid: string): Promise<Entry[]> {
  const q = query(entriesCol(uid), orderBy('time', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as any;
    return {
      id: d.id,
      userId: uid,
      ...(raw as Omit<Entry, 'id' | 'userId'>),
    } as Entry;
  });
}

export async function listEntriesBetween(
  uid: string,
  startMs: number,
  endMs: number
): Promise<Entry[]> {
  const q = query(
    entriesCol(uid),
    where('time', '>=', startMs),
    where('time', '<', endMs),
    orderBy('time', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as any;
    return {
      id: d.id,
      userId: uid,
      ...(raw as Omit<Entry, 'id' | 'userId'>),
    } as Entry;
  });
}

/** List entries for the local calendar day containing `dayMs` (newest first). */
export async function listEntriesForDay(uid: string, dayMs: number): Promise<Entry[]> {
  const start = new Date(dayMs); start.setHours(0, 0, 0, 0);
  const end = new Date(start);   end.setDate(start.getDate() + 1);
  const q = query(
    entriesCol(uid),
    where('time', '>=', start.getTime()),
    where('time', '<', end.getTime()),
    orderBy('time', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as any;
    return {
      id: d.id,
      userId: uid,
      ...(raw as Omit<Entry, 'id' | 'userId'>),
    } as Entry;
  });
}
