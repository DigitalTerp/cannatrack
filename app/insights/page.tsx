'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { listEntriesForDay } from '@/lib/firestore';
import type { Entry, Method, StrainType } from '@/lib/types';
import styles from './insights.module.css';
import typeStyles from '@/app/strains/cultivars.module.css';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/* ------------------------- Date Helpers (local) ------------------------- */
function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDaysLocal(d: Date, days: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}
function lastNDaysLocal(n: number): Date[] {
  const today = startOfDayLocal(new Date());
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) days.push(addDaysLocal(today, -i));
  return days;
}
function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function shortLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}
function mdLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}
function formatRangeNDays(n: number): string {
  const days = lastNDaysLocal(n);
  const start = days[0];
  const end = days[days.length - 1];
  const fmtMD = (x: Date) => x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (start.getFullYear() === end.getFullYear()) {
    return `${fmtMD(start)} – ${fmtMD(end)}, ${end.getFullYear()}`;
  }
  const fmtMDY = (x: Date) =>
    x.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmtMDY(start)} – ${fmtMDY(end)}`;
}

/* --------------------------- User's Name Helpers --------------------------- */
function niceName() {
  const u = auth.currentUser;
  const fromProfile = u?.displayName?.trim();
  if (fromProfile) return fromProfile;
  const email = u?.email || '';
  const raw = email.split('@')[0] || 'there';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
function possessive(name: string) {
  const n = name.trim();
  return n.endsWith('s') || n.endsWith('S') ? `${n}'` : `${n}'s`;
}

/* --------------------------- Colors & helpers --------------------------- */
const COLORS = {
  emerald: '#059669',
  blue: '#3b82f6',
  slate: '#64748b',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  lime: '#84cc16',
  indigo: '#6366f1',
  violet: '#7c3aed',
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}
function gramsOf(e: Entry) {
  return typeof e.weight === 'number' ? e.weight : 0;
}
function mgOf(e: Entry) {
  const v = (e as any).thcMg ?? (e as any).edibleMg;
  return typeof v === 'number' ? v : 0;
}
const isEdible = (e: Entry) => String(e.method) === 'Edible';

/* Type badge helper (matches other pages) */
function badgeClass(t?: StrainType) {
  const key = (t || 'Hybrid').toLowerCase();
  if (key === 'indica') return `${typeStyles.typeBadge} ${typeStyles['type-indica']}`;
  if (key === 'sativa') return `${typeStyles.typeBadge} ${typeStyles['type-sativa']}`;
  return `${typeStyles.typeBadge} ${typeStyles['type-hybrid']}`;
}

/* Tooltip styles */
const tooltipContentStyle: React.CSSProperties = {
  background: 'rgba(17,24,39,0.96)',
  border: '1px solid #374151',
  color: '#E5E7EB',
  borderRadius: 8,
  padding: '8px 10px',
};
const tooltipLabelStyle: React.CSSProperties = { color: '#9CA3AF', marginBottom: 4 };
const tooltipItemStyle: React.CSSProperties = { color: '#E5E7EB' };

/* --------- Grams to Ounces -------------- */

const G_PER_OZ = 28;

function formatWeightTotal(g: number): string {
  if (g < G_PER_OZ) return `${g.toFixed(2)} g`;
  const oz = g / G_PER_OZ;
  if (Math.abs(g - G_PER_OZ) < 1e-6) return `1 oz`;
  return `${oz.toFixed(2)} oz\u00A0\u00A0 ( ${g.toFixed(2)}g )`;
}

function formatWeightGraph(g: number): string {
  if (g < G_PER_OZ) return `${g} g`;
  const oz = g / G_PER_OZ;
  return `${oz.toFixed(2)} oz\u00A0\u00A0 ( ${g} g )`;

}

/* ---------------------------- Page ---------------------------- */
export default function InsightsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string>(''); // Hydrate Greeting 
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [weekEntries, setWeekEntries] = useState<Record<string, Entry[]>>({});
  const [monthEntries, setMonthEntries] = useState<Record<string, Entry[]>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setDisplayName(niceName());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      setErr(null);
      try {
        // 7 days
        const d7 = lastNDaysLocal(7);
        const r7 = await Promise.all(
          d7.map((d) => listEntriesForDay(user.uid!, startOfDayLocal(d).getTime()))
        );
        const m7: Record<string, Entry[]> = {};
        d7.forEach((d, i) => (m7[dayKey(d)] = r7[i] || []));
        setWeekEntries(m7);

        // 30 days
        const d30 = lastNDaysLocal(30);
        const r30 = await Promise.all(
          d30.map((d) => listEntriesForDay(user.uid!, startOfDayLocal(d).getTime()))
        );
        const m30: Record<string, Entry[]> = {};
        d30.forEach((d, i) => (m30[dayKey(d)] = r30[i] || []));
        setMonthEntries(m30);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load insights.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  const range7 = useMemo(() => formatRangeNDays(7), [weekEntries]);
  const range30 = useMemo(() => formatRangeNDays(30), [monthEntries]);

  /* ----------- 7-Day Stats (Badges) ----------- */
  const sessions7 = useMemo(() => {
    const days = lastNDaysLocal(7);
    return days.map((d) => {
      const key = dayKey(d);
      const count = (weekEntries[key] || []).length;
      return { name: shortLabel(d), count };
    });
  }, [weekEntries]);

  const grams7 = useMemo(() => {
    const days = lastNDaysLocal(7);
    return days.map((d) => {
      const key = dayKey(d);
      const grams = sum((weekEntries[key] || []).map(gramsOf));
      return { name: shortLabel(d), grams: Number(grams.toFixed(2)) };
    });
  }, [weekEntries]);

  const badges7 = useMemo(() => {
    const totalSessions = sum(sessions7.map((x) => x.count));
    const totalGrams = Number(sum(grams7.map((x) => x.grams)).toFixed(2));

    const days = lastNDaysLocal(7);
    const totalEdibleMg = Number(
      days
        .map((d) => {
          const key = dayKey(d);
          const mg = sum((weekEntries[key] || []).filter(isEdible).map(mgOf));
          return mg;
        })
        .reduce((a, b) => a + b, 0)
        .toFixed(2)
    );

    return { totalSessions, totalGrams, totalEdibleMg };
  }, [sessions7, grams7, weekEntries]);

  /* ----------- 30-Day aggregates ----------- */
  const flat30 = useMemo(() => Object.values(monthEntries).flat(), [monthEntries]);
  const flat30Smoke = useMemo(() => flat30.filter((e) => !isEdible(e)), [flat30]);
  const edibleEntries30 = useMemo(() => flat30.filter(isEdible), [flat30]);

  // Method mix (includes "Edible" with 0 grams)
  const methodMix30 = useMemo(() => {
    const METHODS: Array<Method | 'Edible'> = ['Bong',  'Dab', 'Edible', 'Pipe', 'Pre-Roll', 'Vape'];
    const base: Record<string, { sessions: number; grams: number }> = {};
    METHODS.forEach((m) => (base[m] = { sessions: 0, grams: 0 }));

    for (const e of flat30) {
      const m = String(e.method);
      if (!base[m]) base[m] = { sessions: 0, grams: 0 };
      base[m].sessions += 1;
      base[m].grams += gramsOf(e);
    }

    return Object.keys(base).map((m) => ({
      method: m,
      sessions: base[m].sessions,
      grams: Number(base[m].grams.toFixed(2)),
    }));
  }, [flat30]);

  // Cultivar type mix — SMOKEABLES ONLY
  const typeMix30 = useMemo(() => {
    const base: Record<StrainType, { sessions: number; grams: number }> = {
      Sativa: { sessions: 0, grams: 0 },
      Hybrid: { sessions: 0, grams: 0 },
      Indica: { sessions: 0, grams: 0 },
    };
    for (const e of flat30Smoke) {
      const t = (e.strainType as StrainType) || 'Hybrid';
      if (!base[t]) continue;
      base[t].sessions += 1;
      base[t].grams += gramsOf(e);
    }
    return (Object.keys(base) as StrainType[]).map((t) => ({
      type: t,
      sessions: base[t].sessions,
      grams: Number(base[t].grams.toFixed(2)),
    }));
  }, [flat30Smoke]);

  // Most preferred type by grams — SMOKEABLES ONLY
  const preferredType = useMemo(() => {
    if (typeMix30.length === 0) return '—';
    const max = [...typeMix30].sort((a, b) => b.grams - a.grams)[0];
    if (!max || (max.grams ?? 0) === 0) return '—';
    return max.type;
  }, [typeMix30]);

  /* ----------- Sessions & Grams (30 Days) ----------- */
  const sessions30All = useMemo(() => {
    const days = lastNDaysLocal(30);
    return days.map((d) => {
      const key = dayKey(d);
      const count = (monthEntries[key] || []).length;
      return { name: mdLabel(d), count };
    });
  }, [monthEntries]);
  const sessions30 = useMemo(() => {
    const nonZero = sessions30All.filter((x) => x.count > 0);
    return nonZero.length ? nonZero : sessions30All;
  }, [sessions30All]);

  const grams30All = useMemo(() => {
    const days = lastNDaysLocal(30);
    return days.map((d) => {
      const key = dayKey(d);
      const grams = sum((monthEntries[key] || []).map(gramsOf));
      return { name: mdLabel(d), grams: Number(grams.toFixed(2)) };
    });
  }, [monthEntries]);
  const grams30 = useMemo(() => {
    const nonZero = grams30All.filter((x) => x.grams > 0);
    return nonZero.length ? nonZero : grams30All;
  }, [grams30All]);

  const totalSessions30 = useMemo(() => sum(sessions30.map((x) => x.count)), [sessions30]);
  const totalGrams30 = useMemo(
    () => Number(sum(grams30.map((x) => x.grams)).toFixed(2)),
    [grams30]
  );

  /* ----------- Top Cultivars (30 Days) ----------- */
  const topCultivars30 = useMemo(() => {
    const m = new Map<string, { count: number; grams: number }>();
    for (const e of flat30Smoke) {
      const name = (e.strainName || 'Unknown').trim();
      const g = gramsOf(e);
      const prev = m.get(name) || { count: 0, grams: 0 };
      m.set(name, { count: prev.count + 1, grams: prev.grams + g });
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, count: v.count, grams: Number(v.grams.toFixed(2)) }))
      .sort((a, b) => b.grams - a.grams)
      .slice(0, 5);
  }, [flat30Smoke]);

  // Top cultivar's most common strain type — SMOKEABLES ONLY
  const topCultivarBadge = useMemo(() => {
    if (!topCultivars30.length) return null;
    const topName = topCultivars30[0].name?.trim() || 'Unknown';
    const counts: Record<StrainType, number> = { Indica: 0, Hybrid: 0, Sativa: 0 };
    for (const e of flat30Smoke) {
      const n = (e.strainName || 'Unknown').trim();
      if (n === topName) {
        const t = (e.strainType as StrainType) || 'Hybrid';
        if (counts[t] !== undefined) counts[t] += 1;
      }
    }
    let best: StrainType = 'Hybrid';
    let max = -1;
    (['Indica', 'Hybrid', 'Sativa'] as StrainType[]).forEach((t) => {
      if (counts[t] > max) { max = counts[t]; best = t; }
    });
    return { name: topName, type: best as StrainType };
  }, [topCultivars30, flat30Smoke]);

  /* ======================= EDIBLE INSIGHTS ======================= */
  const edibleByStrainType = useMemo(() => {
    const base: Record<StrainType, { mg: number; sessions: number }> = {
      Indica: { mg: 0, sessions: 0 },
      Hybrid: { mg: 0, sessions: 0 },
      Sativa: { mg: 0, sessions: 0 },
    };
    for (const e of edibleEntries30) {
      const t = (e.strainType as StrainType) || 'Hybrid';
      base[t].mg += mgOf(e);
      base[t].sessions += 1;
    }
    return (Object.keys(base) as StrainType[]).map((t) => ({
      type: t,
      mg: Number(base[t].mg.toFixed(2)),
      sessions: base[t].sessions,
    }));
  }, [edibleEntries30]);

  const totalEdibleMg = useMemo(
    () => Number(sum(edibleByStrainType.map((x) => x.mg)).toFixed(2)),
    [edibleByStrainType]
  );

  type EdibleKindKey = 'Beverage' | 'Chocolate' | 'Gummy' | 'Pill';
  const edibleTypeSessions30 = useMemo(() => {
    const counts: Record<EdibleKindKey, number> = {
      Beverage: 0,
      Chocolate: 0,
      Gummy: 0,
      Pill: 0,
    };

    for (const e of edibleEntries30) {
      const raw = String((e as any).edibleKind ?? (e as any).edibleType ?? '').toLowerCase();
      let k: EdibleKindKey | 'Other' = 'Other';
      if (raw.startsWith('bev') || raw.includes('drink')) k = 'Beverage';
      else if (raw.startsWith('choc')) k = 'Chocolate';
      else if (raw.startsWith('gum')) k = 'Gummy';
      else if (raw.startsWith('pill') || raw.startsWith('cap')) k = 'Pill';
      if (k !== 'Other') counts[k] += 1;
    }

    const ordered: EdibleKindKey[] = ['Beverage', 'Chocolate', 'Gummy', 'Pill'];
    return ordered.map((k) => ({ type: k, sessions: counts[k] }));
  }, [edibleEntries30]);

  if (!user) {
    return (
      <div className="container">
        <div className="card">Please log in to view Insights.</div>
      </div>
    );
  }

  const manySessionBars = sessions30.length > 10;
  const manyGramBars = grams30.length > 10;

  return (
    <div className="container">
      <div className="page-hero">
        <h1>{possessive(displayName || 'Your')} Consumption Log</h1>
        <p className="subtle">
          This page summarizes your recent sessions. How often you consumed, how much you logged,
          which methods you favored, and the cultivar types you reached for most.
        </p>
      </div>

      <div className={`card ${styles.statsBarCard}`}>
        <div className={styles.statsBar}>
          <div>
            <h2>Last 7 Days</h2>
            <div className="subtle"><em><strong>{range7}</strong></em></div>
          </div>
          <div className={styles.statsBadges}>
            <span className={`badge ${styles.badgeBig}`}>Sessions: {badges7.totalSessions}</span>
            <span className={`badge ${styles.badgeBig}`}>Weight: {formatWeightTotal(badges7.totalGrams)}</span>
            {badges7.totalEdibleMg > 0 && (
              <span className={`badge ${styles.badgeBig}`}>Edibles: {badges7.totalEdibleMg} mg</span>
            )}
          </div>
        </div>
      </div>

      {err && <div className="card">{err}</div>}
      {loading && <div className="card">Loading…</div>}

      {!loading && !err && (
        <div className={styles.dashboardGrid}>
          <div className="card">
            <h2>Sessions<br /> ( Last 30 Days )</h2>
            <div className="subtle"><em><strong>{range30}</strong></em></div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '.35rem' }}>
              <span className={`badge ${styles.badgeBig}`}>Total Sessions: {totalSessions30}</span>
            </div>
            <div className="subtle">Number of sessions per day across the last thirty days.</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sessions30}
                  margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
                  barCategoryGap={sessions30.length >= 8 ? '25%' : '35%'}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    interval={manySessionBars ? 'preserveStartEnd' : 0}
                    tickMargin={10}
                    angle={manySessionBars ? -90 : 0}
                    textAnchor={manySessionBars ? 'end' : 'middle'}
                    height={manySessionBars ? 56 : undefined}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                  <Bar dataKey="count" name="Sessions" fill={COLORS.emerald} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2>Weight Consumed<br /> ( Last 30 Days )</h2>
            <div className="subtle"><em><strong>{range30}</strong></em></div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '.35rem' }}>
              <span className={`badge ${styles.badgeBig}`}>Total: {formatWeightTotal(totalGrams30)}</span>
            </div>
            <div className="subtle">Grams logged per day across the last thirty days.</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={grams30}
                  margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
                  barCategoryGap={grams30.length >= 8 ? '25%' : '35%'}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    interval={manyGramBars ? 'preserveStartEnd' : 0}
                    angle={manyGramBars ? -90 : 0}
                    textAnchor={manyGramBars ? 'end' : 'middle'}
                    height={manyGramBars ? 56 : undefined}
                  />
                  <YAxis />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(val: any) => [formatWeightGraph(Number(val)), 'Weight']}
                  />
                  <Bar dataKey="grams" name="Grams" fill={COLORS.blue} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2>Consumption Method<br /> ( Last 30 Days )</h2>
            <div className="subtle"><em><strong>{range30}</strong></em></div>
            <div className="subtle">Sessions vs. total grams, by consumption method.</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={methodMix30} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" interval={0}/>
                  <YAxis />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(val: any, name: string) =>
                    name === 'Grams'
                  ? [formatWeightGraph(Number(val)), 'Weight']
                    : [val, 'Sessions']
                  }
                  />
                  <Legend />
                  <Bar dataKey="sessions" name="Sessions" fill={COLORS.slate} />
                  <Bar dataKey="grams" name="Grams" fill={COLORS.teal} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2>Cultivar Type Consumed<br />( Last 30 Days )</h2>
            <div className="subtle"><em><strong>{range30}</strong></em></div>
            <div className={styles.centerRow}>
              <span className={`subtle ${styles.subtleStrong}`}>Most Type Consumed:</span>
              <span className={`badge ${badgeClass(preferredType as StrainType)}`}>
                {preferredType}
              </span>
            </div>
            <div className="subtle">Sessions vs. total grams, by Sativa / Hybrid / Indica.</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeMix30} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(val: any, name: string) =>
                    name === 'Grams'
                      ? [formatWeightGraph(Number(val)), 'Weight']
                      : [val, 'Sessions']
                      }
                  />

                  <Legend />
                  <Bar dataKey="sessions" name="Sessions" fill={COLORS.cyan} />
                  <Bar dataKey="grams" name="Grams" fill={COLORS.lime} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2>Top Cultivars<br />( Last 30 Days )</h2>
            <div className="subtle"><em><strong>{range30}</strong></em></div>
            {topCultivarBadge && (
              <div className={styles.centerRow}>
                <span className={`subtle ${styles.subtleStrong}`}>Top Cultivar:</span>
                <span className={`badge ${badgeClass(topCultivarBadge.type as StrainType)}`}>
                  {topCultivarBadge.name}
                </span>
              </div>
            )}
            <div className="subtle">
              Ranked by total grams consumed (smokeables only); bars show sessions and grams per cultivar.
            </div>
            {topCultivars30.length === 0 ? (
              <div className="subtle">No data yet.</div>
            ) : (
              <div className={`${styles.chartWrap} ${styles.chartTall}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCultivars30} margin={{ top: 8, right: 0, bottom: 24, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis yAxisId="left" allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(val: any, name: string) =>
                      name === 'Grams'
                        ? [formatWeightGraph(Number(val)), 'Grams']
                        : [val, 'Sessions']
                      }
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" name="Sessions" fill={COLORS.indigo} />
                    <Bar yAxisId="right" dataKey="grams" name="Grams" fill={COLORS.cyan} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Edible Intake by Type</h2>

            {(() => {
              const max = [...edibleByStrainType].sort((a, b) => b.mg - a.mg)[0];
              return max && max.mg > 0 ? (
                <div className={styles.centerRow}>
                  <span className={`subtle ${styles.subtleStrong}`}>Most Edible Type:</span>
                  <span className={`badge ${badgeClass(max.type as StrainType)}`}>{max.type}</span>
                </div>
              ) : null;
            })()}

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '.35rem' }}>
              <span className={`badge ${styles.badgeBig}`}>Total: {totalEdibleMg} mg</span>
            </div>

            <div className="subtle">THC milligrams consumed (total), grouped by Indica / Hybrid / Sativa.</div>

            {sum(edibleByStrainType.map((x) => x.mg)) === 0 ? (
              <div className="subtle" style={{ marginTop: '.5rem' }}>No edible data yet.</div>
            ) : (
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={edibleByStrainType}
                    margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(val: any) => [`${val} mg`, 'THC mg']}
                    />
                    <Legend />
                    <Bar dataKey="mg" name="THC mg" fill={COLORS.violet} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          
          <div className="card">
            <h2>Edible Types (Sessions)<br /> ( Last 30 Days )</h2>
            <div className="subtle"><em><strong>{range30}</strong></em></div>
            <div className="subtle">Number of edible sessions by type (Beverage, Chocolate, Gummy, Pill).</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={edibleTypeSessions30} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type"
                  interval={0}
                  tick={{ fontSize: 12, dy: 6 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(val: any) => [val, 'Sessions']}
                  />
                  <Legend />
                  <Bar dataKey="sessions" name="Sessions" fill={COLORS.slate} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
