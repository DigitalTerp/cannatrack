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
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Entry, Strain, StrainType } from './types';

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

function toNum(v: any): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

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

function normalizeStrainType(v: any): StrainType | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'indica') return 'Indica';
  if (s === 'sativa') return 'Sativa';
  if (s === 'hybrid') return 'Hybrid';
  return undefined;
}

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
function coerceEdibleCategory(raw: any): EdibleCategory | undefined {
  return (
    normalizeEdibleCategory(raw?.edibleType) ||
    normalizeEdibleCategory(raw?.edibleKind) ||
    normalizeEdibleCategory(raw?.edibleForm) ||
    normalizeEdibleCategory(raw?.edibleCategory) ||
    undefined
  );
}

const entriesCol = (uid: string) => collection(db, 'users', uid, 'entries');
const strainsCol = (uid: string) => collection(db, 'users', uid, 'strains');
const entryRef = (uid: string, entryId: string) => doc(db, 'users', uid, 'entries', entryId);
const strainRef = (uid: string, strainId: string) => doc(db, 'users', uid, 'strains', strainId);

const purchasesCol = (uid: string) => collection(db, 'users', uid, 'purchases');
const purchaseRef = (uid: string, purchaseId: string) => doc(db, 'users', uid, 'purchases', purchaseId);

const toCents = (v: any): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
};

const G_PER_OZ = 28;
const STEP_EIGHTH = 3.5;
const STEP_QUARTER = 7;

function snapPurchaseGrams(g: number): number {
  const grams = Math.max(0, Number(g));

  if (grams > 0 && grams <= 1.01) return 1;

  if (grams <= G_PER_OZ + 1e-9) {
    const steps = Math.round(grams / STEP_EIGHTH);
    const snapped = Number((steps * STEP_EIGHTH).toFixed(2));
    return snapped > 0 ? snapped : STEP_EIGHTH;
  }

  const steps = Math.round(grams / STEP_QUARTER);
  const snapped = Number((steps * STEP_QUARTER).toFixed(2));
  return snapped > 0 ? snapped : STEP_QUARTER;
}

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

export async function upsertStrainByName(uid: string, input: UpsertStrainInput): Promise<string> {
  const name = input.name.trim();
  const nameLower = name.toLowerCase();

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
    aroma: Array.isArray(input.aroma) ? input.aroma : undefined,
    rating: isFiniteNumber(input.rating) ? input.rating : undefined,
    notes: typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : undefined,
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
      aroma: Array.isArray(raw?.aroma) ? raw.aroma : undefined,
      rating: isFiniteNumber(raw?.rating) ? raw.rating : undefined,
      notes: typeof raw?.notes === 'string' ? raw.notes : undefined,
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
      aroma: Array.isArray(raw?.aroma) ? raw.aroma : undefined,
      rating: isFiniteNumber(raw?.rating) ? raw.rating : undefined,
      notes: typeof raw?.notes === 'string' ? raw.notes : undefined,
    } as Strain;
  });
}

export async function deleteStrain(uid: string, strainId: string): Promise<void> {
  await deleteDoc(strainRef(uid, strainId));
}

/* --------------------------- Entries --------------------------- */

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

  const strainNameRaw = (payload as any).strainName?.trim?.() || '';
  const strainType = normalizeStrainType((payload as any).strainType) || 'Hybrid';
  const brand = (payload as any).brand?.trim?.() || undefined;
  const lineage = (payload as any).lineage?.trim?.() || undefined;
  const flavors = toList((payload as any).flavors ?? (payload as any).taste);
  const aroma = toList((payload as any).aroma ?? (payload as any).smell);
  const effects = toList((payload as any).effects);
  const rating = toNum((payload as any).rating);
  const notes = (payload as any).notes?.trim?.() || undefined;
  const thcPercent = toNum((payload as any).thcPercent);
  const thcaPercent = toNum((payload as any).thcaPercent);
  const cbdPercent = toNum((payload as any).cbdPercent);

  const edibleName = (payload as any).edibleName?.trim?.() || undefined;
  const edibleCategory: EdibleCategory | undefined =
    coerceEdibleCategory(payload as any) ||
    normalizeEdibleCategory((payload as any).edibleType) ||
    undefined;
  const edibleMg = parseMgToNumber(
    (payload as any).edibleMg ?? (payload as any).dose ?? (payload as any).mg
  );

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
    } catch {}
  }

  const data = stripUndefined({
    ...payload,
    userId: uid,
    time: isFiniteNumber((payload as any).time) ? (payload as any).time : now(),
    method: methodStr || (isEdible ? 'Edible' : (payload as any).method) || 'Pre-Roll',

    strainId: !isEdible ? strainId || (payload as any).strainId || undefined : undefined,
    strainName: !isEdible ? strainNameRaw : undefined,
    strainNameLower: !isEdible && strainNameRaw ? strainNameRaw.toLowerCase() : undefined,
    strainType,
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

    weight,
    edibleMg,

    isEdibleSession: isEdible || undefined,
    edibleName: isEdible ? edibleName || strainNameRaw || undefined : undefined,
    edibleType: isEdible ? (edibleCategory ?? 'Other') : undefined,
    edibleKind: isEdible ? (edibleCategory ?? 'Other') : undefined,

    createdAt: now(),
    updatedAt: now(),
  });

  const res = await addDoc(entriesCol(uid), data as any);
  return res.id;
}

export async function updateEntry(uid: string, entryId: string, patch: Partial<Entry>): Promise<void> {
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

  const strainName = !isEdiblePatch ? (patch as any).strainName?.trim?.() : undefined;
  const strainType = normalizeStrainType((patch as any).strainType) || 'Hybrid';
  const brand = !isEdiblePatch ? (patch as any).brand?.trim?.() : undefined;
  const lineage = !isEdiblePatch ? (patch as any).lineage?.trim?.() : undefined;

  const flavors = !isEdiblePatch ? toList((patch as any).flavors ?? (patch as any).taste) : undefined;
  const aroma = !isEdiblePatch ? toList((patch as any).aroma ?? (patch as any).smell) : undefined;

  const effects = toList((patch as any).effects);
  const rating = toNum((patch as any).rating);
  const notes = (patch as any).notes?.trim?.();

  const thcPercent = !isEdiblePatch ? toNum((patch as any).thcPercent) : undefined;
  const thcaPercent = !isEdiblePatch ? toNum((patch as any).thcaPercent) : undefined;
  const cbdPercent = !isEdiblePatch ? toNum((patch as any).cbdPercent) : undefined;

  const edibleName = isEdiblePatch ? (patch as any).edibleName?.trim?.() : undefined;
  const edibleCategory: EdibleCategory | undefined = isEdiblePatch
    ? coerceEdibleCategory(patch as any) ||
      normalizeEdibleCategory((patch as any).edibleType) ||
      normalizeEdibleCategory((patch as any).edibleKind) ||
      undefined
    : undefined;
  const edibleMg = isEdiblePatch
    ? parseMgToNumber((patch as any).edibleMg ?? (patch as any).dose ?? (patch as any).mg)
    : undefined;

  const norm = stripUndefined({
    ...patch,
    method: methodStr || (patch as any).method,
    weight,

    strainName,
    strainNameLower: typeof strainName === 'string' ? strainName.toLowerCase() : undefined,
    brand,
    brandLower: typeof brand === 'string' ? brand.toLowerCase() : undefined,
    lineage,
    thcPercent,
    thcaPercent,
    cbdPercent,

    strainType,
    effects,
    flavors,
    aroma,
    rating,
    notes,
    updatedAt: now(),

    isEdibleSession: isEdiblePatch ? true : (patch as any).isEdibleSession,
    edibleName,
    edibleType: edibleCategory,
    edibleKind: edibleCategory,
    edibleMg,
  });

  await updateDoc(entryRef(uid, entryId), norm as any);

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
      typeof strainName === 'string' && strainName ? strainName : (patch as any).strainName || '';
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
      } catch {}
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

      strainId: !isEdible ? raw?.strainId ?? undefined : undefined,
      strainName: !isEdible ? raw?.strainName ?? '' : '',
      strainType: normalizeStrainType(raw?.strainType) || 'Hybrid',
      strainNameLower: !isEdible
        ? raw?.strainNameLower ?? (raw?.strainName ? String(raw.strainName).toLowerCase() : undefined)
        : undefined,

      brand: !isEdible ? raw?.brand ?? undefined : undefined,
      brandLower: !isEdible
        ? raw?.brandLower ?? (raw?.brand ? String(raw.brand).toLowerCase() : undefined)
        : undefined,

      lineage: !isEdible ? raw?.lineage ?? undefined : undefined,
      thcPercent: !isEdible && isFiniteNumber(raw?.thcPercent) ? raw.thcPercent : undefined,
      thcaPercent: !isEdible && isFiniteNumber(raw?.thcaPercent) ? raw.thcaPercent : undefined,
      cbdPercent: !isEdible && isFiniteNumber(raw?.cbdPercent) ? raw.cbdPercent : undefined,

      weight: !isEdible ? parseWeightToNumber(raw?.weight ?? raw?.dose) : undefined,

      moodBefore: raw?.moodBefore ?? undefined,
      moodAfter: raw?.moodAfter ?? undefined,
      effects: Array.isArray(raw?.effects) ? raw.effects : undefined,
      flavors: Array.isArray(raw?.flavors) ? raw.flavors : undefined,
      aroma: Array.isArray(raw?.aroma) ? raw.aroma : undefined,
      rating: isFiniteNumber(raw?.rating) ? raw.rating : undefined,
      notes: raw?.notes ?? undefined,
    } as Entry;

    if (isEdible) {
      (entry as any).isEdibleSession = true;
      (entry as any).edibleName = raw?.edibleName ?? raw?.strainName ?? undefined;

      const cat = coerceEdibleCategory(raw);
      (entry as any).edibleType = cat;
      (entry as any).edibleKind = cat;

      (entry as any).edibleMg = parseMgToNumber(raw?.edibleMg ?? raw?.dose ?? raw?.mg);
    }

    return entry;
  } catch (err: any) {
    if (err?.code === 'permission-denied') return null;
    throw err;
  }
}

export async function listAllEntries(uid: string): Promise<Entry[]> {
  const qy = query(entriesCol(uid), orderBy('time', 'desc'));
  const snap = await getDocs(qy);

  const rows = snap.docs.map((d) => ({
    id: d.id,
    userId: uid,
    ...(d.data() as Omit<Entry, 'id' | 'userId'>),
  })) as Entry[];

  return rows.filter((e: any) => e?.isPurchaseArchive !== true && e?.hiddenFromDaily !== true);
}

export async function listEntriesBetween(uid: string, startMs: number, endMs: number): Promise<Entry[]> {
  const qy = query(
    entriesCol(uid),
    where('time', '>=', startMs),
    where('time', '<', endMs),
    orderBy('time', 'desc')
  );
  const snap = await getDocs(qy);

  const rows = snap.docs.map((d) => ({
    id: d.id,
    userId: uid,
    ...(d.data() as Omit<Entry, 'id' | 'userId'>),
  })) as Entry[];

  return rows.filter((e: any) => e?.isPurchaseArchive !== true && e?.hiddenFromDaily !== true);
}

export async function listEntriesForDay(uid: string, dayMs: number): Promise<Entry[]> {
  const start = new Date(dayMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const qy = query(
    entriesCol(uid),
    where('time', '>=', start.getTime()),
    where('time', '<', end.getTime()),
    orderBy('time', 'desc')
  );
  const snap = await getDocs(qy);

  const rows = snap.docs.map((d) => ({
    id: d.id,
    userId: uid,
    ...(d.data() as Omit<Entry, 'id' | 'userId'>),
  })) as Entry[];

  return rows.filter((e: any) => e?.isPurchaseArchive !== true && e?.hiddenFromDaily !== true);
}

/* --------------------------- Purchases --------------------------- */

export async function createPurchase(
  uid: string,
  input: {
    strainName: string;
    strainType: StrainType;
    lineage?: string;
    brand?: string;
    thcPercent?: number;
    thcaPercent?: number;
    grams: number;
    dollars?: number;
    purchaseDateISO?: string;
  }
): Promise<string> {
  try {
    await upsertStrainByName(uid, {
      name: input.strainName,
      type: input.strainType,
      brand: input.brand,
      lineage: input.lineage,
      thcPercent: input.thcPercent,
      thcaPercent: input.thcaPercent,
    });
  } catch {}

  const rawGrams =
    typeof input.grams === 'number' ? input.grams : parseWeightToNumber((input as any).grams);

  if (!isFiniteNumber(rawGrams) || rawGrams <= 0) {
    throw new Error(`Invalid grams value: ${String(input.grams)}`);
  }

  const snappedGrams = snapPurchaseGrams(rawGrams);
  if (!isFiniteNumber(snappedGrams) || snappedGrams <= 0) {
    throw new Error(`Weight snapping produced invalid value: ${String(snappedGrams)}`);
  }

  const docData = stripUndefined({
    strainName: input.strainName.trim(),
    strainNameLower: input.strainName.trim().toLowerCase(),
    strainType: input.strainType,
    lineage: input.lineage?.trim() || undefined,
    brand: input.brand?.trim() || undefined,
    thcPercent: isFiniteNumber(input.thcPercent) ? input.thcPercent : undefined,
    thcaPercent: isFiniteNumber(input.thcaPercent) ? input.thcaPercent : undefined,

    totalGrams: snappedGrams,
    remainingGrams: snappedGrams,
    totalCostCents: toCents(input.dollars) ?? 0,

    purchaseDate: input.purchaseDateISO || new Date().toISOString().slice(0, 10),
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
  });

  const res = await addDoc(purchasesCol(uid), docData as any);
  return res.id;
}

export async function listPurchases(uid: string) {
  const qy = query(purchasesCol(uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(qy);

  return snap.docs.map((d) => {
    const raw = d.data() as any;
    const totalGrams = parseWeightToNumber(raw?.totalGrams) ?? 0;
    const remainingGrams = parseWeightToNumber(raw?.remainingGrams) ?? 0;

    const status =
      raw?.status === 'active' || raw?.status === 'depleted'
        ? raw.status
        : remainingGrams > 0
          ? 'active'
          : 'depleted';

    return {
      id: d.id,
      ...raw,
      totalGrams,
      remainingGrams,
      status,
    };
  });
}

export async function incrementPurchaseGrams(uid: string, purchaseId: string, addGrams: number) {
  await runTransaction(db, async (tx) => {
    const ref = purchaseRef(uid, purchaseId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Purchase not found');
    const p = snap.data() as any;

    const rawAdd = typeof addGrams === 'number' ? addGrams : Number(addGrams);
    if (!Number.isFinite(rawAdd) || rawAdd <= 0) throw new Error('Invalid add grams amount');

    const snappedAdd = snapPurchaseGrams(rawAdd);
    const totalGrams = Number(((parseWeightToNumber(p.totalGrams) ?? 0) + snappedAdd).toFixed(2));
    const remainingGrams = Number(((parseWeightToNumber(p.remainingGrams) ?? 0) + snappedAdd).toFixed(2));

    tx.update(ref, {
      totalGrams,
      remainingGrams,
      status: remainingGrams <= 0 ? 'depleted' : 'active',
      updatedAt: now(),
    });
  });
}

export async function createEntryWithPurchaseDeduction(
  uid: string,
  purchaseId: string | undefined,
  payload: Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<string> {
  if (!purchaseId) {
    return createEntry(uid, payload);
  }

  const grams = parseWeightToNumber((payload as any).weight ?? (payload as any).dose) ?? 0;
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error('Session weight (grams) is required to deduct from a purchase.');
  }

  return await runTransaction(db, async (tx) => {
    const pref = purchaseRef(uid, purchaseId);
    const psnap = await tx.get(pref);
    if (!psnap.exists()) throw new Error('Linked purchase not found');

    const p = psnap.data() as any;

    const pTotal = parseWeightToNumber(p.totalGrams) ?? 0;
    const pRemaining = parseWeightToNumber(p.remainingGrams) ?? 0;

    const newRemainingRaw = Number((pRemaining - grams).toFixed(2));
    if (newRemainingRaw < -0.001) throw new Error('Not enough inventory in this purchase');

    const newRemaining = Math.max(0, newRemainingRaw);
    const becameDepleted = newRemaining <= 0.000001;

    const sessionRef = doc(collection(db, 'users', uid, 'entries'));
    tx.set(
      sessionRef,
      stripUndefined({
        ...payload,
        userId: uid,
        time: isFiniteNumber((payload as any).time) ? (payload as any).time : now(),
        createdAt: now(),
        updatedAt: now(),
        purchaseId,
      }) as any
    );

    if (!becameDepleted) {
      tx.update(pref, {
        remainingGrams: newRemaining,
        status: 'active',
        updatedAt: now(),
      });
      return sessionRef.id;
    }

    const nowMs = now();
    const purchaseFinishedDateISO = new Date(nowMs).toISOString().slice(0, 10);
    const purchaseMadeDateISO: string | null = p?.purchaseDate ?? null;

    const wasteGrams = newRemaining > 0 ? newRemaining : 0;
    const wastePercent =
      pTotal > 0 && wasteGrams > 0 ? Math.max(0, Math.min(100, (wasteGrams / pTotal) * 100)) : null;

    const archiveRef = doc(collection(db, 'users', uid, 'entries'));
    tx.set(
      archiveRef,
      stripUndefined({
        userId: uid,
        time: nowMs,
        method: 'Purchase',
        journalType: 'purchase-archive',
        isPurchaseArchive: true,
        hiddenFromDaily: true,

        purchaseMadeDateISO,
        purchaseFinishedDateISO,
        purchaseFinishedAtMs: nowMs,

        strainName: p.strainName || 'Untitled',
        strainNameLower: (p.strainName || 'Untitled').toLowerCase(),
        strainType: p.strainType || 'Hybrid',
        brand: p.brand || undefined,
        brandLower: p.brand ? p.brand.toLowerCase() : undefined,
        lineage: p.lineage || undefined,
        thcPercent: typeof p.thcPercent === 'number' ? p.thcPercent : undefined,
        thcaPercent: typeof p.thcaPercent === 'number' ? p.thcaPercent : undefined,

        purchaseId: pref.id,
        purchaseSnapshot: stripUndefined({
          totalGrams: pTotal,
          remainingGrams: newRemaining,
          totalCostCents: p.totalCostCents ?? 0,
          purchaseDate: purchaseMadeDateISO,
        }),

        ...(wasteGrams > 0
          ? {
              wasteGrams,
              wastePercent: typeof wastePercent === 'number' ? Math.round(wastePercent * 100) / 100 : undefined,
            }
          : {}),

        createdAt: nowMs,
        updatedAt: nowMs,
      }) as any
    );

    tx.delete(pref);

    return sessionRef.id;
  });
}

export async function findPurchaseForStrain(
  uid: string,
  strainName: string
): Promise<{ id: string } | undefined> {
  const nameLower = (strainName || '').trim().toLowerCase();
  if (!nameLower) return undefined;

  const qy = query(purchasesCol(uid), where('strainNameLower', '==', nameLower));
  const snap = await getDocs(qy);
  if (snap.empty) return undefined;

  const rows = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((p: any) => (parseWeightToNumber(p?.remainingGrams) ?? 0) > 0)
    .sort((a: any, b: any) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0));

  return rows.length ? { id: rows[0].id } : undefined;
}

export async function createEntryAutoDeduct(
  uid: string,
  payload: Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<string> {
  const methodStr = String((payload as any).method || '').toLowerCase();
  const isEdible = methodStr === 'edible' || (payload as any).isEdibleSession === true;

  if (isEdible) return createEntry(uid, payload);

  const strainName = ((payload as any).strainName || '').trim();
  if (!strainName) return createEntry(uid, payload);

  const match = await findPurchaseForStrain(uid, strainName);
  if (!match) return createEntry(uid, payload);

  return createEntryWithPurchaseDeduction(uid, match.id, payload);
}

export async function finishAndArchivePurchase(
  uid: string,
  purchaseId: string
): Promise<{ archivedEntryId: string; purchaseFinishedDateISO: string; removedPurchaseId: string }> {
  if (!uid) throw new Error('finishAndArchivePurchase: missing uid');
  if (!purchaseId) throw new Error('finishAndArchivePurchase: missing purchaseId');

  return await runTransaction(db, async (tx) => {
    const pref = purchaseRef(uid, purchaseId);
    const psnap = await tx.get(pref);
    if (!psnap.exists()) throw new Error('Purchase not found');
    const p = psnap.data() as any;

    const nowMs = now();
    const purchaseFinishedDateISO = new Date(nowMs).toISOString().slice(0, 10);
    const purchaseMadeDateISO: string | null = p?.purchaseDate ?? null;

    const newEntryRef = doc(collection(db, 'users', uid, 'entries'));
    tx.set(
      newEntryRef,
      stripUndefined({
        userId: uid,
        time: nowMs,
        method: 'Purchase',
        journalType: 'purchase-archive',
        isPurchaseArchive: true,
        hiddenFromDaily: true,
        purchaseMadeDateISO,
        purchaseFinishedDateISO,
        purchaseFinishedAtMs: nowMs,
        strainName: p.strainName || 'Untitled',
        strainNameLower: (p.strainName || 'Untitled').toLowerCase(),
        strainType: p.strainType || 'Hybrid',
        brand: p.brand || undefined,
        brandLower: p.brand ? p.brand.toLowerCase() : undefined,
        lineage: p.lineage || undefined,
        thcPercent: typeof p.thcPercent === 'number' ? p.thcPercent : undefined,
        thcaPercent: typeof p.thcaPercent === 'number' ? p.thcaPercent : undefined,
        purchaseId: pref.id,
        purchaseSnapshot: {
          totalGrams: p.totalGrams,
          remainingGrams: p.remainingGrams,
          totalCostCents: p.totalCostCents ?? 0,
          purchaseDate: purchaseMadeDateISO,
        },
        createdAt: nowMs,
        updatedAt: nowMs,
      }) as any
    );

    tx.delete(pref);

    return {
      archivedEntryId: newEntryRef.id,
      purchaseFinishedDateISO,
      removedPurchaseId: purchaseId,
    };
  });
}

export async function listEntriesForStrain(
  uid: string,
  strainNameLower: string,
  displayName?: string
): Promise<Entry[]> {
  const entriesRef = entriesCol(uid);
  const qLower = query(entriesRef, where('strainNameLower', '==', strainNameLower));
  const qName = displayName ? query(entriesRef, where('strainName', '==', displayName)) : null;

  const [snapLower, snapName] = await Promise.all([
    getDocs(qLower),
    qName ? getDocs(qName) : Promise.resolve(null as any),
  ]);

  const map = new Map<string, any>();
  const add = (snap: any) => {
    if (!snap) return;
    for (const d of snap.docs) {
      const row = { id: d.id, userId: uid, ...(d.data() as any) };
      if (row?.isPurchaseArchive === true || row?.hiddenFromDaily === true) continue;
      map.set(d.id, row);
    }
  };

  add(snapLower);
  add(snapName);

  if (map.size === 0) {
    const recentQ = query(entriesRef, orderBy('time', 'desc'), limit(200));
    const recentSnap = await getDocs(recentQ);

    const toLower = (s: any) => (typeof s === 'string' ? s : '').trim().toLowerCase();

    for (const d of recentSnap.docs) {
      const row = { id: d.id, userId: uid, ...(d.data() as any) };
      if (row?.isPurchaseArchive === true || row?.hiddenFromDaily === true) continue;

      const nmLower =
        toLower(row.strainNameLower) ||
        toLower(row.strainName) ||
        toLower((row as any).strain) ||
        toLower((row as any).cultivar);

      if (nmLower && nmLower === strainNameLower) {
        map.set(d.id, row);
      }
    }
  }

  const out = Array.from(map.values()) as Entry[];
  out.sort((a: any, b: any) => (b?.time ?? 0) - (a?.time ?? 0));

  try {
    if (out.length) {
      const batch = writeBatch(db);
      let touched = 0;

      const toLower = (s: any) => (typeof s === 'string' ? s : '').trim().toLowerCase();

      for (const e of out) {
        const needsStrainLower =
          !(e as any).strainNameLower &&
          typeof (e as any).strainName === 'string' &&
          (e as any).strainName.trim().length > 0;

        const needsBrandLower =
          typeof (e as any).brand === 'string' &&
          (e as any).brand.trim().length > 0 &&
          typeof (e as any).brandLower !== 'string';

        if (needsStrainLower || needsBrandLower) {
          const ref = entryRef(uid, e.id as string);
          const patch: any = {};
          if (needsStrainLower) patch.strainNameLower = toLower((e as any).strainName) || strainNameLower;
          if (needsBrandLower) patch.brandLower = toLower((e as any).brand);
          batch.update(ref, patch);
          if (++touched >= 400) break;
        }
      }

      if (touched > 0) {
        await batch.commit();
      }
    }
  } catch {}

  return out;
}

export async function listActivePurchasesForStrain(uid: string, strainNameLower: string) {
  const qy = query(purchasesCol(uid), where('strainNameLower', '==', strainNameLower));
  const snap = await getDocs(qy);

  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  return rows
    .filter((p: any) => (p?.status === 'active') && (parseWeightToNumber(p?.remainingGrams) ?? 0) > 0)
    .sort((a: any, b: any) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0));
}

export const listCurrentPurchasesForStrain = listActivePurchasesForStrain;

export async function listArchivedPurchasesForStrain(uid: string, strainNameLower: string) {
  const qy = query(entriesCol(uid), where('journalType', '==', 'purchase-archive'));
  const snap = await getDocs(qy);

  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  const mine = all.filter((e: any) => {
    const lower = (e?.strainNameLower ?? (e?.strainName || '')).toLowerCase();
    return lower === strainNameLower;
  });

  const finishedMs = (e: any) =>
    (typeof e?.purchaseFinishedAtMs === 'number' && e.purchaseFinishedAtMs) ||
    (e?.purchaseFinishedDateISO ? Date.parse(e.purchaseFinishedDateISO) : 0) ||
    (typeof e?.time === 'number' ? e.time : 0);

  return mine.sort((a, b) => finishedMs(b) - finishedMs(a));
}

export async function getCultivatorRollups(uid: string, strainNameLower: string) {
  const rows = await listEntriesForStrain(uid, strainNameLower);

  type Row = {
    brand?: string;
    brandLower?: string;
    thcPercent?: number;
    thcaPercent?: number;
    rating?: number;
    weight?: number;
  };

  const byBrand = new Map<
    string,
    {
      brand: string;
      sessions: number;
      grams: number;
      ratingSum: number;
      ratingCount: number;
      thcSum: number;
      thcCount: number;
    }
  >();

  const sumPotency = (a?: number | null, b?: number | null) => {
    const A = typeof a === 'number' ? a : 0;
    const B = typeof b === 'number' ? b : 0;
    const v = Math.round((A + B) * 10) / 10;
    return Number.isInteger(v) ? Number(v.toFixed(0)) : Number(v.toFixed(1));
  };

  rows.forEach((r: Row) => {
    const key = r.brandLower || 'unknown';
    const brand = r.brand || 'Unknown';
    const g =
      byBrand.get(key) || {
        brand,
        sessions: 0,
        grams: 0,
        ratingSum: 0,
        ratingCount: 0,
        thcSum: 0,
        thcCount: 0,
      };

    g.sessions += 1;
    g.grams += typeof r.weight === 'number' ? r.weight : 0;

    if (typeof r.rating === 'number') {
      g.ratingSum += r.rating;
      g.ratingCount += 1;
    }
    if (typeof r.thcPercent === 'number' || typeof r.thcaPercent === 'number') {
      g.thcSum += sumPotency(r.thcPercent, r.thcaPercent);
      g.thcCount += 1;
    }

    byBrand.set(key, g);
  });

  return Array.from(byBrand.values())
    .map((g) => ({
      brand: g.brand,
      sessions: g.sessions,
      grams: Number(g.grams.toFixed(2)),
      avgRating: g.ratingCount ? Number((g.ratingSum / g.ratingCount).toFixed(2)) : null,
      avgPotency: g.thcCount ? Number((g.thcSum / g.thcCount).toFixed(1)) : null,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.grams - a.grams);
}
