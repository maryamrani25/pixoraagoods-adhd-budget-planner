// Lightweight, dependency-free SVG charts that follow the app's theme colours.
import React, { useState } from 'react';

export interface Series { name: string; color: string; values: number[]; }

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

export function Legend({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-2 text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} aria-hidden />
          <span className="text-ink">{i.name}</span>{i.value && <span className="num">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Grouped vertical bars. Values are in cents. */
export function BarChart({ labels, series, format, height = 220, label }: { labels: string[]; series: Series[]; format: (v: number) => string; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, padL = 56, padB = 28, padT = 12;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const groupW = (W - padL - 8) / Math.max(1, labels.length);
  const barW = Math.min(28, (groupW - 12) / series.length);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => t * max);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => {
          const gx = padL + 8 + i * groupW + (groupW - barW * series.length) / 2;
          return (
            <g key={l + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${l}: ${series.map((s) => `${s.name} ${format(s.values[i] || 0)}`).join(', ')}`}>
              <rect x={padL + i * groupW} y={padT} width={groupW} height={H - padT - padB} fill={hover === i ? 'var(--surface-2)' : 'transparent'} rx="8" />
              {series.map((s, j) => {
                const v = Math.max(0, s.values[i] || 0);
                return <rect key={s.name} x={gx + j * barW + 1} y={y(v)} width={barW - 2} height={Math.max(0, H - padB - y(v))} rx="4" fill={s.color}><title>{`${s.name}: ${format(v)}`}</title></rect>;
              })}
              <text x={padL + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{l}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <p className="num -mt-1 text-center text-xs text-muted" aria-live="polite">
          <span className="font-medium text-ink">{labels[hover]}</span> · {series.map((s) => `${s.name} ${format(s.values[hover] || 0)}`).join(' · ')}
        </p>
      )}
      <Legend items={series.map((s) => ({ name: s.name, color: s.color }))} />
    </figure>
  );
}

/** Donut chart with total in the middle. */
export function DonutChart({ data, format, label, centerLabel = 'Total' }: { data: { name: string; value: number; color: string }[]; format: (v: number) => string; label: string; centerLabel?: string }) {
  const total = data.reduce((a, b) => a + Math.max(0, b.value), 0);
  const R = 70, r = 46, C = 90;
  let angle = -Math.PI / 2;
  const arcs = data.filter((d) => d.value > 0).map((d) => {
    const a = (d.value / total) * Math.PI * 2;
    const large = a > Math.PI ? 1 : 0;
    const p = (rad: number, rr: number) => [C + rr * Math.cos(rad), C + rr * Math.sin(rad)];
    const end = angle + Math.min(a, Math.PI * 2 - 0.0001);
    const [x1, y1] = p(angle, R), [x2, y2] = p(end, R), [x3, y3] = p(end, r), [x4, y4] = p(angle, r);
    const path = `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large} 0 ${x4},${y4} Z`;
    angle += a;
    return { ...d, path };
  });
  return (
    <figure className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0" role="img" aria-label={label}>
        {total === 0 ? <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="var(--surface-2)" strokeWidth={R - r} /> :
          arcs.map((a) => <path key={a.name} d={a.path} fill={a.color} stroke="var(--surface)" strokeWidth="2"><title>{`${a.name}: ${format(a.value)}`}</title></path>)}
        <text x={C} y={C - 4} textAnchor="middle" fontSize="11" fill="var(--muted)">{centerLabel}</text>
        <text x={C} y={C + 14} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--ink)">{format(total)}</text>
      </svg>
      <ul className="grid w-full gap-1.5 text-sm">
        {data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value).map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
            <span className="num text-muted">{format(d.value)}</span>
            <span className="num w-10 text-right text-xs text-muted">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Simple line chart (values in cents). */
export function LineChart({ labels, series, format, height = 200, label }: { labels: string[]; series: Series[]; format: (v: number) => string; height?: number; label: string }) {
  const W = 640, H = height, padL = 60, padB = 28, padT = 14;
  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(0, ...all));
  const x = (i: number) => padL + 10 + (labels.length <= 1 ? 0 : (i * (W - padL - 30)) / (labels.length - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}><line x1={padL} x2={W} y1={y(t * max)} y2={y(t * max)} stroke="var(--line)" strokeDasharray={t ? '3 4' : undefined} />
            <text x={padL - 8} y={y(t * max) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{format(t * max)}</text></g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="2"><title>{`${labels[i]} · ${s.name}: ${format(v)}`}</title></circle>)}
          </g>
        ))}
        {labels.map((l, i) => <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{l}</text>)}
      </svg>
      {series.length > 1 && <Legend items={series.map((s) => ({ name: s.name, color: s.color }))} />}
    </figure>
  );
}

/** Horizontal planned-vs-actual bars. */
export function PlanVsActual({ rows, format }: { rows: { name: string; planned: number; actual: number; color: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.planned, r.actual]));
  return (
    <div className="grid gap-3">
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr]">
          <span className="truncate text-ink">{r.name}</span>
          <div className="grid gap-1">
            <div className="flex items-center gap-2"><div className="h-2.5 rounded-full bg-mauve/30" style={{ width: `${(r.planned / max) * 100}%`, minWidth: r.planned ? 4 : 0 }} /><span className="num text-xs text-muted">{format(r.planned)} planned</span></div>
            <div className="flex items-center gap-2"><div className={'h-2.5 rounded-full ' + (r.actual > r.planned && r.planned > 0 ? 'bg-danger' : 'bg-mauve')} style={{ width: `${(r.actual / max) * 100}%`, minWidth: r.actual ? 4 : 0 }} /><span className="num text-xs text-muted">{format(r.actual)} spent</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}
