'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { listEntriesForDay, deleteEntry } from '@/lib/firestore';
import {
  collection,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import type { Entry, StrainType } from '@/lib/types';
import styles from './history.module.css';
import typeStyles from '../strains/cultivars.module.css';

/* ---------- SHARED HELPERS ---------- */
function pad(n: number) { return String(n).padStart(2, '0'); }
function toDateInputValue(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateInputToLocalMs(v: string): number {
  const [y, m, d] = v.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}
function shiftDateStr(v: string, days: number) {
  const ms = dateInputToLocalMs(v);
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return toDateInputValue(d.getTime());
}

function shiftMonthStr(v: string, months: number) {
  const ms = dateInputToLocalMs(v);
  const d = new Date(ms);
  d.setMonth(d.getMonth() + months);
  d.setDate(1);
  return toDateInputValue(d.getTime());
}
function monthStart(ms: number) {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function nextMonthStart(ms: number) {
  const d = new Date(monthStart(ms));
  d.setMonth(d.getMonth() + 1);
  return d.getTime();
}
function monthLabelFromDateStr(v: string) {
  const ms = dateInputToLocalMs(v);
  const d = new Date(ms);
  return d.toLocaleString([], { month: 'long', year: 'numeric' });
}
function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function badgeClass(t: StrainType | undefined) {
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${typeStyles.typeBadge} ${typeStyles['type-indica']}`;
  if (key === 'sativa') return `${typeStyles.typeBadge} ${typeStyles['type-sativa']}`;
  return `${typeStyles.typeBadge} ${typeStyles['type-hybrid']}`;
}
const isEdible = (e: Entry) => String(e.method) === 'Edible';

type ArchiveEntry = {
  id: string;
  time: number;
  method?: string;
  hiddenFromDaily?: boolean;
  journalType?: 'purchase-archive';
  isPurchaseArchive?: boolean;
  purchaseId?: string;

  purchaseMadeDateISO?: string | null;
  purchaseFinishedDateISO?: string | null;
  purchaseFinishedAtMs?: number | null;

  finishedDate?: string | null;

  strainName?: string;
  strainType?: StrainType;
  brand?: string;
  thcPercent?: number | null;
  thcaPercent?: number | null;

  purchaseSnapshot?: {
    totalGrams?: number;
    remainingGrams?: number;
    totalCostCents?: number;
    purchaseDate?: string | null;
  };
};

function centsToDollarString(cents?: number | null) {
  if (cents == null || Number.isNaN(cents)) return '';
  return (cents / 100).toFixed(2);
}
function sumPotency(thc?: number | null, thca?: number | null) {
  const a = typeof thc === 'number' ? thc : 0;
  const b = typeof thca === 'number' ? thca : 0;
  const v = Math.round((a + b) * 10) / 10;
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}
function formatToMDY(d?: string | number | Date | null) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [yyyy, mm, dd] = d.split('-');
    return `${mm}-${dd}-${yyyy}`;
  }
  const dt = new Date(d as any);
  if (Number.isNaN(dt.getTime())) return String(d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}
const G_PER_OZ = 28;
function formatWeight(g?: number | null) {
  const grams = Math.max(0, Number(g || 0));
  if (grams >= G_PER_OZ) {
    const oz = Math.floor(grams / G_PER_OZ);
    const rem = +(grams % G_PER_OZ).toFixed(2);
    return rem > 0 ? `${oz} oz + ${rem} g` : `${oz} oz`;
  }
  return `${+grams.toFixed(2)} g`;
}
function finishedMs(e: ArchiveEntry): number {
  if (typeof e.purchaseFinishedAtMs === 'number' && Number.isFinite(e.purchaseFinishedAtMs)) {
    return e.purchaseFinishedAtMs;
  }
  const iso = e.purchaseFinishedDateISO ?? e.finishedDate ?? null;
  if (iso) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return t;
  }
  return typeof e.time === 'number' ? e.time : 0;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dateStr, setDateStr] = useState<string>(() => toDateInputValue(Date.now()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [purchMonthStr, setPurchMonthStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return toDateInputValue(d.getTime());
  });
  const [aRows, setARows] = useState<ArchiveEntry[]>([]);
  const [bRows, setBRows] = useState<ArchiveEntry[]>([]);
  const [loadingPurch, setLoadingPurch] = useState(true);
  const [deletePurchId, setDeletePurchId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.push('/login?next=/history');
    });
    return () => unsub();
  }, [router]);

  async function loadForDate(s: string, u: User | null) {
    if (!u) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await listEntriesForDay(u.uid, dateInputToLocalMs(s));
      setEntries(list);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadForDate(dateStr, user); }, [user, dateStr]);

  async function handleDelete(id: string) {
    if (!user) return;
    if (!confirm('Remove this session?')) return;
    try {
      await deleteEntry(user.uid, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Remove failed.');
    }
  }

  const totals = useMemo(() => {
    const sessions = entries.length;
    const grams = entries.reduce(
      (sum, e) => sum + (typeof e.weight === 'number' ? e.weight : 0),
      0
    );
    const mg = entries.reduce((sum, e) => {
      if (!isEdible(e)) return sum;
      const dose = (e as any).thcMg;
      return sum + (typeof dose === 'number' ? dose : 0);
    }, 0);
    return { sessions, grams: Number(grams.toFixed(2)), mg: Number(mg.toFixed(2)) };
  }, [entries]);

  useEffect(() => {
    if (!user) return;

    const base = collection(db, 'users', user.uid, 'entries');
    const qArchive = query(base, where('journalType', '==', 'purchase-archive'));
    const qLegacy = query(base, where('hiddenFromDaily', '==', true));

    const unsubA = onSnapshot(qArchive, (snap) => {
      setARows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ArchiveEntry[]);
      setLoadingPurch(false);
    });
    const unsubB = onSnapshot(qLegacy, (snap) => {
      setBRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ArchiveEntry[]);
      setLoadingPurch(false);
    });

    return () => { unsubA(); unsubB(); };
  }, [user]);

  const purchases = useMemo(() => {
    const legacyFiltered = bRows.filter(
      (e) => e.method === 'Purchase' || e.method === 'Journal'
    );

    const m = new Map<string, ArchiveEntry>();
    for (const e of aRows) m.set(e.id, e);
    for (const e of legacyFiltered) if (!m.has(e.id)) m.set(e.id, e);

    const all = Array.from(m.values());

    const start = monthStart(dateInputToLocalMs(purchMonthStr));
    const end = nextMonthStart(start);

    return all
      .filter((e) => {
        const t = finishedMs(e);
        return t >= start && t < end;
      })
      .sort((x, y) => finishedMs(y) - finishedMs(x));
  }, [aRows, bRows, purchMonthStr]);

  const purchaseTotals = useMemo(() => {
    const count = purchases.length;
    const spent = purchases.reduce((acc, e) => acc + (e.purchaseSnapshot?.totalCostCents ?? 0), 0);
    const grams = purchases.reduce((acc, e) => acc + (e.purchaseSnapshot?.totalGrams ?? 0), 0);
    const qtyPretty = formatWeight(grams);
    return { count, spent, grams, qtyPretty };
  }, [purchases]);

  async function handleRemovePurchase(entryId: string) {
    if (!user || !entryId) return;
    const ok = confirm('Remove this archived purchase?');
    if (!ok) return;
    try {
      setDeletePurchId(entryId);
      await deleteDoc(doc(db, 'users', user.uid, 'entries', entryId));
    } catch (e: any) {
      alert(e?.message || 'Remove failed.');
    } finally {
      setDeletePurchId(null);
    }
  }

  return (
    <div className="container">
      <div className="page-hero" style={{ marginBottom: '0.75rem' }}>
        <h1 style={{ marginTop: 0 }}>History</h1>
      </div>

      <div className={styles.controls}>
        <div className={styles.dateRow}>
          <label htmlFor="hist-date" className="subtle" style={{ marginRight: '.25rem' }}>
            Pick A Date
          </label>
          <input
            id="hist-date"
            className="input"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>

        <div className={styles.pagerRow}>
          <button className="btn btn-ghost" onClick={() => setDateStr(shiftDateStr(dateStr, -1))}>
            ◀ Previous
          </button>
          <button className="btn btn-ghost" onClick={() => setDateStr(toDateInputValue(Date.now()))}>
            Today
          </button>
          <button className="btn btn-ghost" onClick={() => setDateStr(shiftDateStr(dateStr, +1))}>
            Next ▶
          </button>
        </div>
      </div>

      {!loading && (
        <div className={`card ${styles.totalsCard}`}>
          <div className={styles.totalsWrap}>
            <span className="badge">Sessions: {totals.sessions}</span>
            <span className="badge">Total Weight: {totals.grams} g</span>
            {totals.mg > 0 && <span className="badge">Edibles: {totals.mg} mg</span>}
          </div>
        </div>
      )}

      {err && <div className="card"><p className="error">{err}</p></div>}
      {loading && <div className="card">Loading…</div>}
      {!loading && entries.length === 0 && (
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>No sessions on this day.</p>
        </div>
      )}

      <div className={styles.grid}>
        {entries.map((e) => {
          const edible = isEdible(e);
          const edibleName = (e as any).edibleName as string | undefined;
          const doseMg = (e as any).thcMg as number | undefined;
          const edibleType = (e as any).edibleType as string | undefined;

          const entryThc = (e as any).thcPercent as number | undefined;
          const entryThca = (e as any).thcaPercent as number | undefined;
          const potencyCombined =
            entryThc != null || entryThca != null ? sumPotency(entryThc, entryThca) : undefined;

          return (
            <div key={e.id} className={`card ${styles.entryCard}`}>
              <div className={styles.headerRow}>
                <h3 className={styles.name}>
                  {edible ? (edibleName || e.strainName || 'Untitled') : (e.strainName || 'Untitled')}
                </h3>
                <span className={`badge ${badgeClass(e.strainType)}`}>{e.strainType || '—'}</span>
              </div>

              <div className={typeStyles.kvList}>
                {edible ? (
                  <>
                    <div className={typeStyles.kvRow}>
                      <span className={typeStyles.kvLabel}>Method</span>
                      <span className={typeStyles.kvValue}>{e.method}</span>
                    </div>
                    {edibleType && (
                      <div className={typeStyles.kvRow}>
                        <span className={typeStyles.kvLabel}>Type</span>
                        <span className={typeStyles.kvValue}>{edibleType}</span>
                      </div>
                    )}
                    {typeof doseMg === 'number' && (
                      <div className={typeStyles.kvRow}>
                        <span className={typeStyles.kvLabel}>Dose</span>
                        <span className={typeStyles.kvValue}>{doseMg.toFixed(2)} mg</span>
                      </div>
                    )}
                    <div className={typeStyles.kvRow}>
                      <span className={typeStyles.kvLabel}>Time</span>
                      <span className={typeStyles.kvValue}>{fmtTime(e.time)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={typeStyles.kvRow}>
                      <span className={typeStyles.kvLabel}>Method</span>
                      <span className={typeStyles.kvValue}>{e.method}</span>
                    </div>
                    {typeof e.weight === 'number' && (
                      <div className={typeStyles.kvRow}>
                        <span className={typeStyles.kvLabel}>Weight</span>
                        <span className={typeStyles.kvValue}>{e.weight.toFixed(2)}g</span>
                      </div>
                    )}
                    {potencyCombined && (
                      <div className={typeStyles.kvRow}>
                        <span className={typeStyles.kvLabel}>Potency</span>
                        <span className={typeStyles.kvValue}>{potencyCombined}%</span>
                      </div>
                    )}
                    <div className={typeStyles.kvRow}>
                      <span className={typeStyles.kvLabel}>Time</span>
                      <span className={typeStyles.kvValue}>{fmtTime(e.time)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.actions}>
                <button
                  className="btn btn-ghost"
                  onClick={() => router.push(`/entries/${e.id}/edit`)}
                  aria-label="Edit entry"
                >
                  Edit
                </button>
                <button
                  className={`btn ${typeStyles.deleteBtn}`}
                  onClick={() => handleDelete(e.id)}
                  aria-label="Delete entry"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="page-hero" style={{ margin: '1.25rem 0 1.25rem' }}>
        <h2 style={{ margin: 1 }}>Finished Purchases : {monthLabelFromDateStr(purchMonthStr)}</h2>
      </div>
      <div className={styles.pagerRow} style={{ marginTop: '-0.25rem' }}>
        <button
          className="btn btn-ghost"
          onClick={() => setPurchMonthStr(shiftMonthStr(purchMonthStr, -1))}
        >
          ◀ Prev
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setPurchMonthStr(shiftMonthStr(toDateInputValue(Date.now()), 0))}
        >
          Current Month
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setPurchMonthStr(shiftMonthStr(purchMonthStr, +1))}
        >
          Next ▶
        </button>
      </div>

      {!loadingPurch && (
        <div className={`card ${styles.totalsCard}`}>
          <div className={styles.totalsWrap}>
            <span className="badge">Purchases: {purchaseTotals.count}</span>
            <span className="badge">Spent: ${centsToDollarString(purchaseTotals.spent)}</span>
            <span className="badge">Purchased: {purchaseTotals.qtyPretty}</span>
          </div>
        </div>
      )}

      {loadingPurch && <div className="card">Loading purchases…</div>}

      {!loadingPurch && purchases.length === 0 && (
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>No finished purchases in this month.</p>
        </div>
      )}

      <div className={styles.grid}>
        {purchases.map((p) => {
          const purchasedISO = p.purchaseMadeDateISO || p.purchaseSnapshot?.purchaseDate || null;
          const purchased = purchasedISO ? formatToMDY(purchasedISO) : null;
          const finished =
            p.purchaseFinishedDateISO
              ? formatToMDY(p.purchaseFinishedDateISO)
              : p.purchaseFinishedAtMs
              ? formatToMDY(p.purchaseFinishedAtMs)
              : p.finishedDate
              ? formatToMDY(p.finishedDate)
              : formatToMDY(p.time);

          const grams = p.purchaseSnapshot?.totalGrams;
          const qtyPretty = formatWeight(grams);
          const spent = p.purchaseSnapshot?.totalCostCents;
          const potency = sumPotency(p.thcPercent, p.thcaPercent);
          const removing = deletePurchId === p.id;

          return (
            <div key={p.id} className={`card ${styles.entryCard}`}>
              <div className={styles.headerRow}>
                <h3 className={styles.name}>{p.strainName || 'Untitled'}</h3>
                <span className={`badge ${badgeClass(p.strainType)}`}>{p.strainType || 'Hybrid'}</span>
              </div>

              <div className={typeStyles.kvList}>
                {p.brand && (
                  <div className={typeStyles.kvRow}>
                    <span className={typeStyles.kvLabel}>Brand</span>
                    <span className={typeStyles.kvValue}>{p.brand}</span>
                  </div>
                )}
                {purchased && (
                  <div className={typeStyles.kvRow}>
                    <span className={typeStyles.kvLabel}>Purchased</span>
                    <span className={typeStyles.kvValue}>{purchased}</span>
                  </div>
                )}
                <div className={typeStyles.kvRow}>
                  <span className={typeStyles.kvLabel}>Finished</span>
                  <span className={typeStyles.kvValue}>{finished}</span>
                </div>
                {typeof grams === 'number' && (
                  <div className={typeStyles.kvRow}>
                    <span className={typeStyles.kvLabel}>Quantity</span>
                    <span className={typeStyles.kvValue}>{qtyPretty}</span>
                  </div>
                )}
                {spent != null && (
                  <div className={typeStyles.kvRow}>
                    <span className={typeStyles.kvLabel}>Spent</span>
                    <span className={typeStyles.kvValue}>${centsToDollarString(spent)}</span>
                  </div>
                )}
                {(p.thcPercent != null || p.thcaPercent != null) && (
                  <div className={typeStyles.kvRow}>
                    <span className={typeStyles.kvLabel}>Potency</span>
                    <span className={typeStyles.kvValue}>{potency}%</span>
                  </div>
                )}
              </div>

              <div className={styles.actions}>
                <button
                  className={`btn ${typeStyles.deleteBtn}`}
                  onClick={() => handleRemovePurchase(p.id)}
                  aria-label="Delete archived purchase"
                  disabled={removing}
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
