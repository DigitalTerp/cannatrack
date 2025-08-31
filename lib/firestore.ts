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
  if (obj === null || typeof obj !== 'object') return obj;
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
 * Create a new entry (session) and ensure its cultivar exists/updates.
 * Note: userId is derived from `uid` and set internally. */
export async function createEntry(
  uid: string,
  payload: Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<string> {
  // normalize timestamps and weight; keep lowercased helpers
  const weight = parseWeightToNumber((payload as any).weight ?? (payload as any).dose);
  const strainName = (payload as any).strainName?.trim?.() || '';
  const brand = (payload as any).brand?.trim?.() || undefined;

  // Ensure cultivar exists/updates if a name was provided
  let strainId = (payload as any).strainId as string | undefined;
  if (strainName) {
    try {
      strainId = await upsertStrainByName(uid, {
        name: strainName,
        type: ((payload as any).strainType as StrainType) || 'Hybrid',
        brand,
        lineage: (payload as any).lineage?.trim?.() || undefined,
        thcPercent: isFiniteNumber((payload as any).thcPercent) ? (payload as any).thcPercent : undefined,
        thcaPercent: isFiniteNumber((payload as any).thcaPercent) ? (payload as any).thcaPercent : undefined,
        cbdPercent: isFiniteNumber((payload as any).cbdPercent) ? (payload as any).cbdPercent : undefined,
      });
    } catch {
      // ignore cultivar upsert errors so entry creation can still proceed
    }
  }

  const data = stripUndefined({
    ...payload,
    userId: uid,
    strainId: strainId || (payload as any).strainId || undefined,
    weight,
    time: isFiniteNumber((payload as any).time) ? (payload as any).time : now(),
    strainName,
    strainNameLower: strainName ? strainName.toLowerCase() : undefined,
    brand,
    brandLower: brand ? brand.toLowerCase() : undefined,
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
  const weight = parseWeightToNumber((patch as any).weight ?? (patch as any).dose);
  const strainName = (patch as any).strainName?.trim?.();
  const brand = (patch as any).brand?.trim?.();

  const norm = stripUndefined({
    ...patch,
    weight,
    strainName,
    strainNameLower: typeof strainName === 'string' ? strainName.toLowerCase() : undefined,
    brand,
    brandLower: typeof brand === 'string' ? brand.toLowerCase() : undefined,
    updatedAt: now(),
  });

  await updateDoc(entryRef(uid, entryId), norm as any);

  if (typeof strainName === 'string' && strainName) {
    try {
      await upsertStrainByName(uid, {
        name: strainName,
        type: ((patch as any).strainType as StrainType) || 'Hybrid',
        brand,
        lineage: (patch as any).lineage?.trim?.() || undefined,
        thcPercent: isFiniteNumber((patch as any).thcPercent) ? (patch as any).thcPercent : undefined,
        thcaPercent: isFiniteNumber((patch as any).thcaPercent) ? (patch as any).thcaPercent : undefined,
        cbdPercent: isFiniteNumber((patch as any).cbdPercent) ? (patch as any).cbdPercent : undefined,
      });
    } catch {
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

    const entry: Entry = {
      id: snap.id,
      userId: uid,
      createdAt: isFiniteNumber(raw?.createdAt) ? raw.createdAt : now(),
      updatedAt: isFiniteNumber(raw?.updatedAt) ? raw.updatedAt : now(),

      time: isFiniteNumber(raw?.time) ? raw.time : now(),
      method: raw?.method ?? 'Pre-Roll',

      // linkage & identity
      strainId: raw?.strainId ?? undefined,
      strainName: raw?.strainName ?? '',
      strainType: raw?.strainType ?? 'Hybrid',
      strainNameLower: raw?.strainNameLower ?? (raw?.strainName ? String(raw.strainName).toLowerCase() : undefined),

      // curated convenience fields kept on entry
      brand: raw?.brand ?? undefined,
      brandLower: raw?.brandLower ?? (raw?.brand ? String(raw.brand).toLowerCase() : undefined),
      lineage: raw?.lineage ?? undefined,
      thcPercent: isFiniteNumber(raw?.thcPercent) ? raw.thcPercent : undefined,
      thcaPercent: isFiniteNumber(raw?.thcaPercent) ? raw.thcaPercent : undefined,
      cbdPercent: isFiniteNumber(raw?.cbdPercent) ? raw.cbdPercent : undefined,

      // normalized weight 
      weight: parseWeightToNumber(raw?.weight ?? raw?.dose),

      // experience
      moodBefore: raw?.moodBefore ?? undefined,
      moodAfter: raw?.moodAfter ?? undefined,
      effects: Array.isArray(raw?.effects) ? raw.effects : undefined,
      flavors: Array.isArray(raw?.flavors) ? raw.flavors : undefined,
      aroma: Array.isArray(raw?.aroma) ? raw.aroma : undefined,
      rating: isFiniteNumber(raw?.rating) ? raw.rating : undefined,
      notes: raw?.notes ?? undefined,
    } as Entry;

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
