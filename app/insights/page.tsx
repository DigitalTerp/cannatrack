'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { listEntriesForDay } from '@/lib/firestore';
import type { Entry, Method, StrainType } from '@/lib/types';

import styles from './insights.module.css';

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
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}
function shortLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

/* --------------------------- Graph Utilities & Colors --------------------------- */
const METHOD_LIST: Method[] = ['Pre-Roll', 'Bong', 'Pipe', 'Vape', 'Dab'];
const TYPE_LIST: StrainType[] = ['Indica', 'Hybrid', 'Sativa'];

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

const tooltipContentStyle: React.CSSProperties = {
  background: 'rgba(17,24,39,0.96)', 
  border: '1px solid #374151',       
  color: '#E5E7EB',                  
  borderRadius: 8,
  padding: '8px 10px',
};
const tooltipLabelStyle: React.CSSProperties = { color: '#9CA3AF', marginBottom: 4 };
const tooltipItemStyle: React.CSSProperties = { color: '#E5E7EB' }; 

/* ---------------------------- Page Components ---------------------------- */
export default function InsightsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // keyed by yyyy-mm-dd
  const [weekEntries, setWeekEntries] = useState<Record<string, Entry[]>>({});
  const [monthEntries, setMonthEntries] = useState<Record<string, Entry[]>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // load last 7 & 30 days of entries
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

  const bigBadge: React.CSSProperties = { fontSize: '.95rem', padding: '.4rem .7rem' };

  /* ----------- Weight Consumption ( 7-Day ) Component  ----------- */
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

  /* ----------- Consumption Method ( 30 Days ) Components ----------- */
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

  /* ----------- Top Cultivars (30 Days) Component ----------- */
  const topCultivars30 = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const e of flat30) {
      const key = (e.strainName || 'Unknown').trim();
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }
    return Array.from(countMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [flat30]);

  if (!user) {
    return (
      <div className="container">
        <div className="card">Please log in to view Insights.</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-hero">
        <h1>Your Consumption Log</h1>
      </div>
      <div className="card" style={{ padding: '.75rem 1rem', marginTop: '-.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Last 7 Days</h2>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <span className="badge" style={bigBadge}>Sessions: {badges7.totalSessions}</span>
            <span className="badge" style={bigBadge}>Weight: {badges7.totalGrams} g</span>
          </div>
        </div>
      </div>

      {err && <div className="card">{err}</div>}
      {loading && <div className="card">Loading…</div>}

      {!loading && !err && (
        <div className={styles.dashboardGrid}>
          {/* --- Last 7 Days Sessions --- */}
          <div className="card">
            <h2>Sessions<br /> ( Last 7 Days )</h2>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessions7} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Bar dataKey="count" name="Sessions" fill={COLORS.emerald} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- Last 7 Days Weight Consumed Graph --- */}
          <div className="card">
            <h2>Weight Consumed<br /> ( Over 7 Days )</h2>
            <div className="subtle">Total Consumption: <strong>{badges7.totalGrams} g</strong></div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grams7} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(val: any) => [`${val} g`, 'Weight']}
                  />
                  <Bar dataKey="grams" fill={COLORS.blue} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- Consumption Method Graph ( 30 Days ) --- */}
          <div className="card">
            <h2>Consumption Method<br /> ( Last 30 Days )</h2>
            <div className="subtle">Sessions vs. total grams, by consumption method.</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={methodMix30} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" />
                  <YAxis />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend />
                  <Bar dataKey="sessions" name="Sessions" fill={COLORS.slate} />
                  <Bar dataKey="grams" name="Grams" fill={COLORS.teal} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- Top Consumed Type Graph ( 30 Days ) --- */}
          <div className="card">
            <h2>Cultivar Type Consumed<br />( Last 30 Days )</h2>
            <div className="subtle">Sessions vs. total grams, by Indica / Hybrid / Sativa.</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeMix30} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend />
                  <Bar dataKey="sessions" name="Sessions" fill={COLORS.cyan} />
                  <Bar dataKey="grams" name="Grams" fill={COLORS.lime} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- Top Cultivars Graph ( 30 Days ) --- */}
          <div className="card">
            <h2>Top Cultivars<br />( Last 30 Days )</h2>
            {topCultivars30.length === 0 ? (
              <div className="subtle">No data yet.</div>
            ) : (
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCultivars30} margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                    />
                    <Legend />
                    <Bar dataKey="count" name="Sessions" fill={COLORS.indigo} />
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
