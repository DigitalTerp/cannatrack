'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { listEntriesForDay } from '@/lib/firestore';
import type { Entry, Method, StrainType } from '@/lib/types';
import styles from './insights.module.css';
import typeStyles from '@/app/strains/cultivars.module.css'; // for type-colored badges
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, } from 'recharts';

/* ------------------------- Date helpers (local) ------------------------- */
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

/* --------------------------- Colors & helpers --------------------------- */
const COLORS = {
  emerald: '#059669',
  blue: '#3b82f6',
  slate: '#64748b',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  lime: '#84cc16',
  indigo: '#6366f1',
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}
function gramsOf(e: Entry) {
  return typeof e.weight === 'number' ? e.weight : 0;
}

/* Type badge helper (matches Cultivars/Daily pages) */
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

/* ---------------------------- Page ---------------------------- */
export default function InsightsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [weekEntries, setWeekEntries] = useState<Record<string, Entry[]>>({});
  const [monthEntries, setMonthEntries] = useState<Record<string, Entry[]>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
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

  /* ----------- 7-Day (badges) ----------- */
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
    return { totalSessions, totalGrams };
  }, [sessions7, grams7]);

  /* ----------- 30-Day aggregates ----------- */
  const flat30 = useMemo(() => Object.values(monthEntries).flat(), [monthEntries]);

  const methodMix30 = useMemo(() => {
    const base: Record<Method, { sessions: number; grams: number }> = {
      'Pre-Roll': { sessions: 0, grams: 0 },
      Bong: { sessions: 0, grams: 0 },
      Pipe: { sessions: 0, grams: 0 },
      Vape: { sessions: 0, grams: 0 },
      Dab: { sessions: 0, grams: 0 },
    };
    for (const e of flat30) {
      const m = (e.method as Method) || 'Pre-Roll';
      if (!base[m]) continue;
      base[m].sessions += 1;
      base[m].grams += gramsOf(e);
    }
    return (Object.keys(base) as Method[]).map((m) => ({
      method: m,
      sessions: base[m].sessions,
      grams: Number(base[m].grams.toFixed(2)),
    }));
  }, [flat30]);

  const typeMix30 = useMemo(() => {
    const base: Record<StrainType, { sessions: number; grams: number }> = {
      Indica: { sessions: 0, grams: 0 },
      Hybrid: { sessions: 0, grams: 0 },
      Sativa: { sessions: 0, grams: 0 },
    };
    for (const e of flat30) {
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
  }, [flat30]);

  // Most preferred type by grams (used elsewhere on the page)
  const preferredType = useMemo(() => {
    if (typeMix30.length === 0) return '—';
    const max = [...typeMix30].sort((a, b) => b.grams - a.grams)[0];
    if (!max || (max.grams ?? 0) === 0) return '—';
    return max.type;
  }, [typeMix30]);

  /* ----------- Sessions & Grams (30 days; compacted to days with data) ----------- */
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

  /* ----------- Top Cultivars (30 Days) — sessions + grams ----------- */
  const topCultivars30 = useMemo(() => {
    const m = new Map<string, { count: number; grams: number }>();
    for (const e of flat30) {
      const name = (e.strainName || 'Unknown').trim();
      const g = gramsOf(e);
      const prev = m.get(name) || { count: 0, grams: 0 };
      m.set(name, { count: prev.count + 1, grams: prev.grams + g });
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, count: v.count, grams: Number(v.grams.toFixed(2)) }))
      .sort((a, b) => b.grams - a.grams)
      .slice(0, 5);
  }, [flat30]);

  const topCultivarBadge = useMemo(() => {
    if (!topCultivars30.length) return null;
    const topName = topCultivars30[0].name?.trim() || 'Unknown';
    const counts: Record<StrainType, number> = { Indica: 0, Hybrid: 0, Sativa: 0 };
    for (const e of flat30) {
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
  }, [topCultivars30, flat30]);

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
        <h1>Your Consumption Log</h1>
        <p className="subtle">
          This page summarizes your recent sessions. How often you consumed, how much you logged,
          which methods you favored, and the cultivar types you reached for most.
        </p>
      </div>

      {/* Last 7 Days stats bar */}
      <div className={`card ${styles.statsBarCard}`}>
        <div className={styles.statsBar}>
          <div>
            <h2>Last 7 Days</h2>
            <div className="subtle"><em><strong>{range7}</strong></em></div>
          </div>
          <div className={styles.statsBadges}>
            <span className={`badge ${styles.badgeBig}`}>Sessions: {badges7.totalSessions}</span>
            <span className={`badge ${styles.badgeBig}`}>Weight: {badges7.totalGrams} g</span>
          </div>
        </div>
      </div>

      {err && <div className="card">{err}</div>}
      {loading && <div className="card">Loading…</div>}

    {!loading && !err && (
       <div className={styles.dashboardGrid}>
        {/* Sessions (30 days) */}
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
                   angle={manySessionBars ? -25 : 0}
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

        {/* Weight (30 days) */}
        <div className="card">
          <h2>Weight Consumed<br /> ( Last 30 Days )</h2>
          <div className="subtle"><em><strong>{range30}</strong></em></div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '.35rem' }}>
            <span className={`badge ${styles.badgeBig}`}>Total: {totalGrams30} g</span>
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
                  angle={manyGramBars ? -25 : 0}
                  textAnchor={manyGramBars ? 'end' : 'middle'}
                  height={manyGramBars ? 56 : undefined}
                />
                <YAxis />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(val: any) => [`${val} g`, 'Weight']}
                />
                <Bar dataKey="grams" name="Grams" fill={COLORS.blue} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Method (30 days) */}
        <div className="card">
          <h2>Consumption Method<br /> ( Last 30 Days )</h2>
          <div className="subtle"><em><strong>{range30}</strong></em></div>
          <div className="subtle">Sessions vs. total grams, by consumption method.</div>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodMix30} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                <Legend />
                <Bar dataKey="sessions" name="Sessions" fill={COLORS.slate} />
                <Bar dataKey="grams" name="Grams" fill={COLORS.teal} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

         {/* Type (30 days) */}
         <div className="card">
          <h2>Cultivar Type Consumed<br />( Last 30 Days )</h2>
          <div className="subtle"><em><strong>{range30}</strong></em></div>
            <div className={styles.centerRow}>
              <span className={`subtle ${styles.subtleStrong}`}>
                  Most Type Consumed:
                </span>
              <span className={`badge ${badgeClass(preferredType as StrainType)}`}>
                {preferredType}
              </span>
            </div>

          <div className="subtle">Sessions vs. total grams, by Indica / Hybrid / Sativa.</div>
          <div className={styles.chartWrap}>
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={typeMix30} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" />
                 <XAxis dataKey="type" />
                 <YAxis />
                 <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                 <Legend />
                 <Bar dataKey="sessions" name="Sessions" fill={COLORS.cyan} />
                 <Bar dataKey="grams" name="Grams" fill={COLORS.lime} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Top cultivars (30 days) */}
          <div className="card">
            <h2>Top Cultivars<br />( Last 30 Days )</h2>
            <div className="subtle"><em><strong>{range30}</strong></em></div>
                
            {topCultivarBadge && (
              <div className={styles.centerRow}>
                <span className={`subtle ${styles.subtleStrong}`}>
        Top Cultivar Strain:
                </span>
                  <span className={`badge ${badgeClass(topCultivarBadge.type as StrainType)}`}>
                    {topCultivarBadge.name}
                  </span>
                </div>
                )}
            <div className="subtle">
              Ranked by total grams consumed; bars show sessions and grams per cultivar.
            </div>
            {topCultivars30.length === 0 ? (
              <div className="subtle">No data yet.</div>
            ) : (
              <div className={`${styles.chartWrap} ${styles.chartTall}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCultivars30} margin={{ top: 8, right: 0, bottom: 24, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={56} />
                    <YAxis yAxisId="left" allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(val: any, name: string) =>
                        name === 'Grams' ? [`${val} g`, 'Grams'] : [val, 'Sessions']
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
        </div>
      )}
    </div>
  );
}
