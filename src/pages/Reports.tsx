import React, { useMemo, useState } from 'react';
import { LuPrinter, LuDownload } from 'react-icons/lu';
import { useStore } from '../lib/store';
import { Card, Button, PageHeader, Stat, inputCls, ProgressBar, cx } from '../components/ui';
import { BarChart, DonutChart, LineChart, PlanVsActual } from '../components/charts';
import { monthlySeries, currentMonthKey, rangeOfMonth, categorySpend, goalInfo, budgetLines } from '../lib/calc';
import { monthLabel, shiftMonthKey, monthKeysBetween } from '../lib/dates';
import { formatCompact, sum } from '../lib/money';
import { download } from '../lib/backup';

type Preset = '3' | '6' | '12' | 'ytd' | 'lastyear' | 'custom';

export default function Reports() {
  const { data, today, money } = useStore();
  const cur = currentMonthKey(data, today);
  const [preset, setPreset] = useState<Preset>('6');
  const [cFrom, setCFrom] = useState(shiftMonthKey(cur, -5));
  const [cTo, setCTo] = useState(cur);
  const { from, to } = useMemo(() => {
    const y = cur.slice(0, 4);
    if (preset === 'ytd') return { from: `${y}-01`, to: cur };
    if (preset === 'lastyear') return { from: `${Number(y) - 1}-01`, to: `${Number(y) - 1}-12` };
    if (preset === 'custom') return cFrom <= cTo ? { from: cFrom, to: cTo } : { from: cTo, to: cFrom };
    return { from: shiftMonthKey(cur, -(Number(preset) - 1)), to: cur };
  }, [preset, cFrom, cTo, cur]);
  const series = monthlySeries(data, from, to);
  const range = { from: rangeOfMonth(data, from).from, to: rangeOfMonth(data, to).to };
  const t = { income: sum(series.map((s) => s.income)), expenses: sum(series.map((s) => s.expenses)), saved: sum(series.map((s) => s.savedNet)), debt: sum(series.map((s) => s.debtPaid)) };
  const net = t.income - t.expenses - t.saved - t.debt;
  const cats = categorySpend(data, range.from, range.to);
  const fmtC = (v: number) => formatCompact(v, data.settings.currency);
  const planned = useMemo(() => {
    const acc: Record<string, { planned: number; actual: number }> = {};
    for (const k of monthKeysBetween(from, to)) for (const l of budgetLines(data, k)) { const a = (acc[l.categoryId] ||= { planned: 0, actual: 0 }); a.planned += l.limit; a.actual += l.spent; }
    return data.categories.map((c) => ({ name: c.name, color: c.color, ...(acc[c.id] || { planned: 0, actual: 0 }) })).filter((r) => r.planned > 0 || r.actual > 0);
  }, [data, from, to]);
  const years = useMemo(() => {
    const ys = [...new Set(data.transactions.map((x) => x.date.slice(0, 4)))].sort().reverse();
    return ys.map((y) => { const s = monthlySeries(data, `${y}-01`, `${y}-12`); const inc = sum(s.map((x) => x.income)); const exp = sum(s.map((x) => x.expenses)); const sav = sum(s.map((x) => x.savedNet)); const dp = sum(s.map((x) => x.debtPaid)); return { y, inc, exp, sav, dp, net: inc - exp - sav - dp, rate: inc ? Math.round((sav / inc) * 100) : 0 }; });
  }, [data]);
  const csv = () => download(`report-${from}-to-${to}.csv`, ['Month,Income,Expenses,Saved,Debt payments,Left over', ...series.map((s) => [monthLabel(s.key), s.income, s.expenses, s.savedNet, s.debtPaid, s.net].map((v, i) => i ? (Number(v) / 100).toFixed(2) : `"${v}"`).join(','))].join('\n'), 'text/csv');

  return (
    <div>
      <PageHeader title="Reports" subtitle="A calm look back. Only the numbers that help you decide what to do next."
        actions={<><Button variant="secondary" icon={<LuDownload aria-hidden />} onClick={csv}>CSV</Button><Button variant="secondary" icon={<LuPrinter aria-hidden />} onClick={() => window.print()}>Print</Button></>} />
      <Card className="no-print mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium" htmlFor="rp-range">Date range</label>
          <select id="rp-range" className={inputCls + ' w-auto'} value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            <option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="ytd">This year so far</option><option value="lastyear">Last year</option><option value="custom">Choose months…</option>
          </select>
          {preset === 'custom' && <>
            <label className="flex items-center gap-2 text-sm">From <input type="month" className={inputCls + ' w-auto'} value={cFrom} onChange={(e) => e.target.value && setCFrom(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm">To <input type="month" className={inputCls + ' w-auto'} value={cTo} onChange={(e) => e.target.value && setCTo(e.target.value)} /></label>
          </>}
          <span className="text-sm text-muted">{monthLabel(from)} – {monthLabel(to)}</span>
        </div>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Income" value={money(t.income)} tone="success" />
        <Stat label="Expenses" value={money(t.expenses)} />
        <Stat label="Moved to savings" value={money(t.saved)} />
        <Stat label="Debt payments" value={money(t.debt)} />
        <Stat label="Left over" value={money(net)} tone={net < 0 ? 'danger' : undefined} hint="Income minus everything else" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Monthly income and expenses"><BarChart label="Monthly income and expenses" labels={series.map((s) => monthLabel(s.key, 'short'))} format={fmtC} series={[{ name: 'Income', color: 'var(--success)', values: series.map((s) => s.income) }, { name: 'Expenses', color: 'var(--mauve)', values: series.map((s) => s.expenses) }]} /></Card>
        <Card title="Spending by category"><DonutChart label="Spending by category" format={money} data={data.categories.map((c) => ({ name: c.name, value: cats[c.id] || 0, color: c.color }))} /></Card>
        <Card title="Planned vs. actual spending" subtitle="All budget months in this range">{planned.length ? <PlanVsActual rows={planned} format={money} /> : <p className="text-sm text-muted">No budgets or spending in this range.</p>}</Card>
        <Card title="Savings progress">
          <BarChart label="Money moved to savings each month" labels={series.map((s) => monthLabel(s.key, 'short'))} format={fmtC} height={170} series={[{ name: 'Moved to savings', color: 'var(--success)', values: series.map((s) => Math.max(0, s.savedNet)) }]} />
          <div className="mt-4 grid gap-3">{data.goals.map((g) => { const i = goalInfo(data, g, today); return <div key={g.id}><div className="mb-1 flex justify-between text-sm"><span>{g.name}</span><span className="num text-muted">{money(i.saved)} / {money(g.target)}</span></div><ProgressBar value={i.pct} max={100} tone="success" size="sm" label={`${g.name} progress`} /></div>; })}</div>
        </Card>
        <Card title="Debt progress" subtitle="Total balance at the end of each month">{data.debts.length ? <LineChart label="Total debt over time" labels={series.map((s) => monthLabel(s.key, 'short'))} format={fmtC} series={[{ name: 'Total debt', color: 'var(--warning)', values: series.map((s) => s.debt) }]} /> : <p className="text-sm text-muted">No debts tracked.</p>}</Card>
        <Card title="Month by month">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs tracking-wide text-muted uppercase"><th className="py-2 font-medium">Month</th><th className="text-right font-medium">Income</th><th className="text-right font-medium">Expenses</th><th className="text-right font-medium">vs. prior</th><th className="text-right font-medium">Left over</th></tr></thead>
            <tbody className="divide-y divide-line">{series.map((s, i) => { const prev = i > 0 ? series[i - 1].expenses : null; const ch = prev ? Math.round(((s.expenses - prev) / prev) * 100) : null; return (
              <tr key={s.key}><td className="py-2">{monthLabel(s.key, 'short')} {s.key.slice(0, 4)}</td><td className="num text-right">{money(s.income)}</td><td className="num text-right">{money(s.expenses)}</td><td className={cx('num text-right text-xs', ch === null ? 'text-muted' : ch > 0 ? 'text-warning' : 'text-success')}>{ch === null ? '—' : `${ch > 0 ? '+' : ''}${ch}%`}</td><td className={cx('num text-right', s.net < 0 && 'text-danger')}>{money(s.net)}</td></tr>); })}</tbody>
          </table></div>
        </Card>
      </div>

      <Card className="mt-5" title="Annual overview">
        {years.length === 0 ? <p className="text-sm text-muted">Nothing recorded yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs tracking-wide text-muted uppercase"><th className="py-2 font-medium">Year</th><th className="text-right font-medium">Income</th><th className="text-right font-medium">Expenses</th><th className="text-right font-medium">Saved</th><th className="text-right font-medium">Debt paid</th><th className="text-right font-medium">Left over</th><th className="text-right font-medium">Savings rate</th></tr></thead>
            <tbody className="divide-y divide-line">{years.map((y) => <tr key={y.y}><td className="py-2 font-medium">{y.y}</td><td className="num text-right">{money(y.inc)}</td><td className="num text-right">{money(y.exp)}</td><td className="num text-right">{money(y.sav)}</td><td className="num text-right">{money(y.dp)}</td><td className="num text-right">{money(y.net)}</td><td className="num text-right">{y.rate}%</td></tr>)}</tbody>
          </table></div>
        )}
        <p className="mt-3 text-xs text-muted">Savings rate = money moved to savings ÷ income received.</p>
      </Card>
    </div>
  );
}
