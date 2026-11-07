import type { ISODate, Frequency } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s: ISODate): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayISO = (): ISODate => toISO(new Date());
export const isValidISO = (s: unknown): s is ISODate => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISO(s).getTime()) && toISO(parseISO(s)) === s;

export const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
export const addDays = (s: ISODate, n: number): ISODate => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
/** Adds months, keeping the requested day of month but clamping to the month's last day. */
export const addMonths = (s: ISODate, n: number, day?: number): ISODate => {
  const d = parseISO(s);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
  const want = day ?? d.getDate();
  target.setDate(Math.min(want, daysInMonth(target.getFullYear(), target.getMonth())));
  return toISO(target);
};
export const diffDays = (a: ISODate, b: ISODate) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

// ---- Financial months (a month can start on a custom day, e.g. the 15th) ----
export const monthKeyOf = (s: ISODate, startDay = 1): string => {
  const d = parseISO(s);
  let y = d.getFullYear(), m = d.getMonth();
  if (d.getDate() < startDay) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  return `${y}-${pad(m + 1)}`;
};
export const monthRange = (key: string, startDay = 1): { from: ISODate; to: ISODate } => {
  const [y, m] = key.split('-').map(Number);
  const from = toISO(new Date(y, m - 1, Math.min(startDay, daysInMonth(y, m - 1)), 12));
  const nextStart = toISO(new Date(y, m, Math.min(startDay, daysInMonth(y, m)), 12));
  return { from, to: addDays(nextStart, -1) };
};
export const shiftMonthKey = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const monthKeysBetween = (a: string, b: string): string[] => {
  const out: string[] = []; let k = a;
  for (let i = 0; i < 240 && k <= b; i++) { out.push(k); k = shiftMonthKey(k, 1); }
  return out;
};
export const monthLabel = (key: string, style: 'long' | 'short' = 'long') => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' });
};

export type DateFormat = 'MDY' | 'DMY' | 'YMD';
export const formatDate = (s: ISODate | undefined, fmt: DateFormat = 'MDY', withYear = true): string => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  if (fmt === 'YMD') return withYear ? `${y}-${m}-${d}` : `${m}-${d}`;
  if (fmt === 'DMY') return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
  return withYear ? `${m}/${d}/${y}` : `${m}/${d}`;
};
export const friendlyDate = (s: ISODate, today: ISODate = todayISO()): string => {
  const n = diffDays(today, s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const d = parseISO(s);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * Dates a schedule falls on within [from, to] (inclusive).
 * allowBefore: also project the schedule backwards before the anchor date (used for pay schedules).
 */
export function occurrences(anchor: ISODate, freq: Frequency, from: ISODate, to: ISODate, opts: { secondDay?: number; allowBefore?: boolean } = {}): ISODate[] {
  const out: ISODate[] = [];
  if (!isValidISO(anchor) || from > to) return out;
  const start = opts.allowBefore ? from : (anchor > from ? anchor : from);
  if (freq === 'irregular') return out;
  if (freq === 'once') return anchor >= from && anchor <= to ? [anchor] : out;
  if (freq === 'weekly' || freq === 'biweekly') {
    const step = freq === 'weekly' ? 7 : 14;
    const offset = diffDays(anchor, start);
    const k = Math.ceil(offset / step);
    let d = addDays(anchor, k * step);
    for (let i = 0; i < 1000 && d <= to; i++) { if (d >= start) out.push(d); d = addDays(d, step); }
    return out;
  }
  const day = parseISO(anchor).getDate();
  if (freq === 'twice-monthly') {
    const second = opts.secondDay ?? (day <= 15 ? Math.min(day + 15, 31) : day - 15);
    const days = [day, second].sort((a, b) => a - b);
    let key = monthKeyOf(start);
    for (let i = 0; i < 600; i++) {
      const [y, m] = key.split('-').map(Number);
      for (const dd of days) {
        const iso = toISO(new Date(y, m - 1, Math.min(dd, daysInMonth(y, m - 1)), 12));
        if (iso >= start && iso <= to && (opts.allowBefore || iso >= anchor)) out.push(iso);
      }
      if (`${key}-01` > to) break;
      key = shiftMonthKey(key, 1);
    }
    return out;
  }
  const step = freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12;
  // find first occurrence >= start, stepping from the anchor
  const monthsDiff = (() => { const a = parseISO(anchor), s = parseISO(start); return (s.getFullYear() - a.getFullYear()) * 12 + (s.getMonth() - a.getMonth()); })();
  let k = Math.floor(monthsDiff / step) - 1;
  for (let i = 0; i < 1000; i++, k++) {
    const d = addMonths(anchor, k * step, day);
    if (d > to) break;
    if (d >= start) out.push(d);
  }
  return out;
}

export const freqLabel: Record<Frequency, string> = {
  once: 'One time', weekly: 'Weekly', biweekly: 'Every 2 weeks', 'twice-monthly': 'Twice a month', monthly: 'Monthly', quarterly: 'Every 3 months', yearly: 'Yearly', irregular: 'Irregular',
};
/** Average number of times per month a schedule happens (for monthly estimates). */
export const perMonth: Record<Frequency, number> = { once: 0, weekly: 52 / 12, biweekly: 26 / 12, 'twice-monthly': 2, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12, irregular: 0 };
