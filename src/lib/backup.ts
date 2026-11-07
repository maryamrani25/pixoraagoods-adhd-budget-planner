// Export, validate and import backups.
import type { AppData } from './types';
import { emptyData, defaultSettings } from './defaults';
import { isValidISO } from './dates';

export const BACKUP_APP = 'pixoraagoods-adhd-budget-planner';

export function makeBackup(data: AppData) {
  return JSON.stringify({ app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export interface ImportResult { ok: true; data: AppData; counts: Record<string, number>; }
export interface ImportError { ok: false; error: string; }

export function parseBackup(text: string): ImportResult | ImportError {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "This file isn't a valid backup (it couldn't be read as JSON)." }; }
  const obj = raw as { app?: string; data?: Partial<AppData> };
  if (!obj || obj.app !== BACKUP_APP || typeof obj.data !== 'object' || !obj.data) return { ok: false, error: "This file doesn't look like a PixoraaGoods budget backup." };
  const d = obj.data;
  const base = emptyData();
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  const data: AppData = {
    ...base,
    settings: { ...defaultSettings(), ...(d.settings || {}), dashboard: { ...defaultSettings().dashboard, ...(d.settings?.dashboard || {}) } },
    categories: arr(d.categories).length ? arr(d.categories) : base.categories,
    budgets: d.budgets && typeof d.budgets === 'object' ? d.budgets : {},
    transactions: arr<AppData['transactions'][number]>(d.transactions).filter((t) => t && typeof t.amount === 'number' && Number.isInteger(t.amount) && isValidISO(t.date) && ['income', 'expense', 'savings', 'debt'].includes(t.type)),
    incomeSources: arr(d.incomeSources), bills: arr(d.bills), goals: arr(d.goals), debts: arr(d.debts),
    financialGoals: arr(d.financialGoals), paycheckPlans: arr(d.paycheckPlans), reserves: arr(d.reserves), checkIns: arr(d.checkIns),
    isDemo: !!d.isDemo, updatedAt: Date.now(),
  };
  const skipped = arr(d.transactions).length - data.transactions.length;
  return { ok: true, data, counts: { transactions: data.transactions.length, bills: data.bills.length, 'savings goals': data.goals.length, debts: data.debts.length, 'income sources': data.incomeSources.length, ...(skipped ? { 'skipped (invalid) records': skipped } : {}) } };
}

export function transactionsCSV(data: AppData): string {
  const cat = (id?: string) => data.categories.find((c) => c.id === id)?.name ?? '';
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [['Date', 'Type', 'Name', 'Amount', 'Category', 'Payment method', 'Notes']];
  for (const t of [...data.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    const sign = t.type === 'income' || (t.type === 'savings' && t.direction === 'out') ? 1 : -1;
    const type = t.type === 'savings' ? (t.direction === 'out' ? 'Savings withdrawal' : 'Savings transfer') : t.type === 'debt' ? (t.debtAction === 'charge' ? 'Debt charge' : 'Debt payment') : t.type[0].toUpperCase() + t.type.slice(1);
    rows.push([t.date, type, t.name, ((sign * t.amount) / 100).toFixed(2), cat(t.categoryId), t.paymentMethod ?? '', t.notes ?? '']);
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
