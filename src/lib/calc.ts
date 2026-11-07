// Reusable financial calculations. Pure functions: same data in, same numbers out.
import type { AppData, Bill, Cents, Debt, IncomeSource, ISODate, SavingsGoal, Transaction } from './types';
import { friendlyDate, addDays, diffDays, monthKeyOf, monthRange, occurrences, shiftMonthKey, monthKeysBetween } from './dates';
import { sum, formatMoney } from './money';

export const inRange = (d: ISODate, from: ISODate, to: ISODate) => d >= from && d <= to;
const txs = (data: AppData, type: Transaction['type'], from: ISODate, to: ISODate) =>
  data.transactions.filter((t) => t.type === type && inRange(t.date, from, to));

export const currentMonthKey = (data: AppData, today: ISODate) => monthKeyOf(today, data.settings.monthStartDay);
export const rangeOfMonth = (data: AppData, key: string) => monthRange(key, data.settings.monthStartDay);

// ---------- Totals ----------
export interface PeriodTotals { income: Cents; expenses: Cents; savedIn: Cents; savedOut: Cents; savedNet: Cents; debtPaid: Cents; net: Cents; }
export function periodTotals(data: AppData, from: ISODate, to: ISODate): PeriodTotals {
  const income = sum(txs(data, 'income', from, to).map((t) => t.amount));
  const expenses = sum(txs(data, 'expense', from, to).map((t) => t.amount));
  const sav = txs(data, 'savings', from, to).filter((t) => t.affectsCash);
  const savedIn = sum(sav.filter((t) => t.direction !== 'out').map((t) => t.amount));
  const savedOut = sum(sav.filter((t) => t.direction === 'out').map((t) => t.amount));
  const debtPaid = sum(txs(data, 'debt', from, to).filter((t) => t.debtAction !== 'charge').map((t) => t.amount));
  return { income, expenses, savedIn, savedOut, savedNet: savedIn - savedOut, debtPaid, net: income - expenses - (savedIn - savedOut) - debtPaid };
}
export const monthTotals = (data: AppData, key: string) => { const r = rangeOfMonth(data, key); return periodTotals(data, r.from, r.to); };

export function categorySpend(data: AppData, from: ISODate, to: ISODate): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const t of txs(data, 'expense', from, to)) { const c = t.categoryId || 'other'; out[c] = (out[c] || 0) + t.amount; }
  return out;
}

// ---------- Budgets ----------
export type BudgetState = 'none' | 'ok' | 'near' | 'at' | 'over';
export interface BudgetLine { categoryId: string; name: string; color: string; limit: Cents; spent: Cents; remaining: Cents; pct: number; state: BudgetState; }
export function budgetLines(data: AppData, key: string): BudgetLine[] {
  const r = rangeOfMonth(data, key);
  const spend = categorySpend(data, r.from, r.to);
  const limits = data.budgets[key] || {};
  return data.categories.map((c) => {
    const limit = limits[c.id] || 0; const spent = spend[c.id] || 0;
    const p = limit > 0 ? (spent / limit) * 100 : 0;
    const state: BudgetState = limit <= 0 ? 'none' : spent > limit ? 'over' : spent === limit ? 'at' : p >= 80 ? 'near' : 'ok';
    return { categoryId: c.id, name: c.name, color: c.color, limit, spent, remaining: limit - spent, pct: p, state };
  });
}
export function budgetSummary(data: AppData, key: string) {
  const lines = budgetLines(data, key);
  const planned = sum(lines.map((l) => l.limit));
  const spentInBudgeted = sum(lines.filter((l) => l.limit > 0).map((l) => l.spent));
  const spentTotal = sum(lines.map((l) => l.spent));
  return { lines, planned, spentInBudgeted, spentTotal, remaining: planned - spentInBudgeted };
}

// ---------- Bills ----------
export interface BillOccurrence { bill: Bill; due: ISODate; paidTx?: Transaction; }
export function billOccurrences(data: AppData, from: ISODate, to: ISODate): BillOccurrence[] {
  const out: BillOccurrence[] = [];
  for (const bill of data.bills) {
    if (!bill.active) continue;
    for (const due of occurrences(bill.dueDate, bill.frequency, from, to)) {
      const paidTx = data.transactions.find((t) => t.billId === bill.id && t.billDue === due);
      out.push({ bill, due, paidTx });
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.bill.name.localeCompare(b.bill.name));
}
/** Unpaid bills that were due in the last 60 days. */
export const overdueBills = (data: AppData, today: ISODate) => billOccurrences(data, addDays(today, -60), addDays(today, -1)).filter((o) => !o.paidTx);
export const upcomingBills = (data: AppData, today: ISODate, days = 30) => billOccurrences(data, today, addDays(today, days)).filter((o) => !o.paidTx);

// ---------- Savings & debt ----------
export const goalSaved = (data: AppData, goalId: string) =>
  sum(data.transactions.filter((t) => t.type === 'savings' && t.goalId === goalId).map((t) => (t.direction === 'out' ? -t.amount : t.amount)));
export function goalInfo(data: AppData, g: SavingsGoal, today: ISODate) {
  const saved = goalSaved(data, g.id);
  const remaining = Math.max(0, g.target - saved);
  let monthsLeft: number | null = null; let neededPerMonth: Cents | null = null;
  if (g.targetDate && remaining > 0) {
    monthsLeft = Math.max(1, Math.ceil(diffDays(today, g.targetDate) / 30.44));
    neededPerMonth = Math.ceil(remaining / monthsLeft);
  }
  return { saved, remaining, pct: g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0, monthsLeft, neededPerMonth, done: saved >= g.target && g.target > 0 };
}
export const totalSaved = (data: AppData) => sum(data.goals.map((g) => goalSaved(data, g.id)));

export function debtBalance(data: AppData, d: Debt, upTo?: ISODate): Cents {
  let bal = d.startBalance;
  for (const t of data.transactions) {
    if (t.type !== 'debt' || t.debtId !== d.id) continue;
    if (upTo && t.date > upTo) continue;
    bal += t.debtAction === 'charge' ? t.amount : -t.amount;
  }
  return Math.max(0, bal);
}
export const totalDebt = (data: AppData) => sum(data.debts.map((d) => debtBalance(data, d)));
export const debtPayments = (data: AppData, debtId: string) => data.transactions.filter((t) => t.type === 'debt' && t.debtId === debtId).sort((a, b) => b.date.localeCompare(a.date));

/** Rough payoff estimate with monthly compounding. Returns null when the payment does not cover interest. */
export function payoffEstimate(balance: Cents, aprPct: number, monthly: Cents): { months: number; interest: Cents } | null {
  if (balance <= 0) return { months: 0, interest: 0 };
  if (monthly <= 0) return null;
  const r = aprPct / 100 / 12;
  let b = balance, interest = 0, m = 0;
  while (b > 0 && m < 600) { const i = Math.round(b * r); if (i >= monthly && r > 0) return null; interest += i; b = b + i - monthly; m++; }
  return m >= 600 ? null : { months: m, interest };
}
export function debtOrder(data: AppData, method: 'snowball' | 'avalanche') {
  const list = data.debts.map((d) => ({ debt: d, balance: debtBalance(data, d) })).filter((x) => x.balance > 0);
  return method === 'snowball' ? list.sort((a, b) => a.balance - b.balance) : list.sort((a, b) => b.debt.interestRate - a.debt.interestRate);
}

// ---------- Income ----------
export interface ExpectedPay { source: IncomeSource; date: ISODate; received?: Transaction; }
export function expectedPaychecks(data: AppData, from: ISODate, to: ISODate): ExpectedPay[] {
  const out: ExpectedPay[] = [];
  for (const s of data.incomeSources) {
    if (!s.active) continue;
    for (const date of occurrences(s.anchorDate, s.frequency, from, to, { secondDay: s.secondDay, allowBefore: true })) {
      const received = data.transactions.find((t) => t.type === 'income' && t.sourceId === s.id && t.expectedDate === date);
      out.push({ source: s, date, received });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function nextPayday(data: AppData, today: ISODate): ExpectedPay | undefined {
  return expectedPaychecks(data, today, addDays(today, 62)).find((p) => !p.received);
}

// ---------- Cash & Safe-to-Spend ----------
/** Money in the spending account right now: entered balance + every cash movement after that date. */
export function availableFunds(data: AppData, today: ISODate): Cents | null {
  const b = data.settings.balance;
  if (!b) return null;
  let total = b.amount;
  for (const t of data.transactions) {
    if (!t.affectsCash || t.date <= b.asOf || t.date > today) continue;
    if (t.type === 'income') total += t.amount;
    else if (t.type === 'expense') total -= t.amount;
    else if (t.type === 'savings') total += t.direction === 'out' ? t.amount : -t.amount;
    else if (t.type === 'debt' && t.debtAction !== 'charge') total -= t.amount;
  }
  return total;
}

export interface SafeLine { label: string; amount: Cents; detail?: string; }
export interface SafeToSpend {
  ready: boolean; missing: string[];
  balance?: { amount: Cents; asOf: ISODate };
  available: Cents | null; horizonEnd: ISODate; horizonLabel: string;
  bills: SafeLine[]; billsTotal: Cents;
  savings: SafeLine[]; savingsTotal: Cents;
  other: SafeLine[]; otherTotal: Cents;
  reservedTotal: Cents; expected: ExpectedPay[]; expectedTotal: Cents;
  safe: Cents | null; perDay: Cents | null; daysLeft: number;
}
export function safeToSpend(data: AppData, today: ISODate): SafeToSpend {
  const missing: string[] = [];
  const available = availableFunds(data, today);
  if (available === null) missing.push('Your current bank balance (the money in your everyday spending account).');
  const key = currentMonthKey(data, today);
  const monthEnd = rangeOfMonth(data, key).to;
  const pay = nextPayday(data, today);
  let horizonEnd = monthEnd; let horizonLabel = 'the end of this month';
  if (data.settings.safeToSpendHorizon === 'payday') {
    if (pay) { horizonEnd = pay.date; horizonLabel = 'your next payday'; }
    else missing.push('Your next payday (add an income source with a pay schedule). Until then, this plans to the end of the month.');
  }

  // Bills: unpaid, due between 60 days ago and the horizon. Paid bills are already out of the balance.
  const billOcc = billOccurrences(data, addDays(today, -60), horizonEnd).filter((o) => !o.paidTx);
  const bills = billOcc.map((o) => ({ label: o.bill.name, amount: o.bill.amount, detail: o.due < today ? `past due since ${friendlyDate(o.due, today)}` : `due ${friendlyDate(o.due, today)}` }));

  // Savings: what is still planned this month (not yet moved).
  const r = rangeOfMonth(data, key);
  const savings: SafeLine[] = [];
  for (const g of data.goals) {
    if (g.monthlyPlan <= 0) continue;
    const info = goalInfo(data, g, today);
    if (info.done) continue;
    const movedThisMonth = sum(data.transactions.filter((t) => t.type === 'savings' && t.goalId === g.id && t.affectsCash && t.direction !== 'out' && inRange(t.date, r.from, r.to)).map((t) => t.amount));
    const left = Math.min(Math.max(0, g.monthlyPlan - movedThisMonth), info.remaining);
    if (left > 0) savings.push({ label: g.name, amount: left, detail: 'planned this month, not moved yet' });
  }

  // Debt minimums that are not already tracked as a bill.
  const other: SafeLine[] = [];
  const linked = new Set(data.bills.filter((b) => b.active && b.linkedDebtId).map((b) => b.linkedDebtId));
  for (const d of data.debts) {
    if (linked.has(d.id)) continue;
    const bal = debtBalance(data, d); if (bal <= 0 || d.minimumPayment <= 0) continue;
    const paidThisMonth = sum(data.transactions.filter((t) => t.type === 'debt' && t.debtId === d.id && t.debtAction !== 'charge' && inRange(t.date, r.from, r.to)).map((t) => t.amount));
    const dues = occurrences(addMonths1(r.from, d.dueDay), 'monthly', r.from, horizonEnd);
    if (dues.length && paidThisMonth < d.minimumPayment) other.push({ label: `${d.name} minimum payment`, amount: Math.min(bal, d.minimumPayment - paidThisMonth), detail: `due day ${d.dueDay}` });
  }
  for (const res of data.reserves) if (res.amount > 0) other.push({ label: res.name, amount: res.amount, detail: 'set aside by you' });

  const billsTotal = sum(bills.map((b) => b.amount));
  const savingsTotal = sum(savings.map((s) => s.amount));
  const otherTotal = sum(other.map((o) => o.amount));
  const reservedTotal = billsTotal + savingsTotal + otherTotal;
  const expected = expectedPaychecks(data, addDays(today, 1), horizonEnd < today ? today : addDays(horizonEnd, 0)).filter((p) => !p.received);
  const expectedTotal = sum(expected.map((p) => p.source.amount));
  const safe = available === null ? null : available - reservedTotal;
  const daysLeft = Math.max(1, diffDays(today, horizonEnd) + 1);
  return {
    ready: available !== null, missing, balance: data.settings.balance, available, horizonEnd, horizonLabel,
    bills, billsTotal, savings, savingsTotal, other, otherTotal, reservedTotal, expected, expectedTotal,
    safe, perDay: safe === null ? null : Math.max(0, Math.floor(safe / daysLeft)), daysLeft,
  };
}
const addMonths1 = (monthStart: ISODate, day: number) => {
  // the given day in the month of monthStart (clamped), as an anchor for a monthly schedule
  const [y, m] = monthStart.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const dd = String(Math.min(day, dim)).padStart(2, '0');
  const iso = `${y}-${String(m).padStart(2, '0')}-${dd}`;
  return iso < monthStart ? shiftDay(iso) : iso;
};
const shiftDay = (iso: ISODate) => { const [y, m, d] = iso.split('-').map(Number); const n = new Date(y, m, d, 12); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };

// ---------- Paycheck allocation ----------
export function planFor(data: AppData, key: string) { return data.paycheckPlans.find((p) => p.key === key)?.allocations ?? []; }
export function allocationSummary(data: AppData, key: string, amount: Cents) {
  const allocations = planFor(data, key);
  const allocated = sum(allocations.map((a) => a.amount));
  return { allocations, allocated, unallocated: amount - allocated };
}

// ---------- Reports ----------
export function monthlySeries(data: AppData, fromKey: string, toKey: string) {
  return monthKeysBetween(fromKey, toKey).map((key) => {
    const t = monthTotals(data, key);
    const end = rangeOfMonth(data, key).to;
    const debt = sum(data.debts.map((d) => debtBalance(data, d, end)));
    return { key, ...t, debt };
  });
}
export const lastMonths = (data: AppData, today: ISODate, n: number) => {
  const cur = currentMonthKey(data, today);
  return { from: shiftMonthKey(cur, -(n - 1)), to: cur };
};

// ---------- Gentle guidance ----------
export interface Step { text: string; action?: { label: string; to: string }; tone: 'calm' | 'nudge' | 'win'; }
export function nextSmallStep(data: AppData, today: ISODate): Step {
  const cur = data.settings.currency;
  if (!data.settings.balance) return { text: 'Add the money in your everyday account so we can work out your safe-to-spend. Just a rough number is fine.', action: { label: 'Add my balance', to: 'safe' }, tone: 'nudge' };
  const overdue = overdueBills(data, today);
  if (overdue.length) return { text: `${overdue[0].bill.name} was due ${overdue[0].due === addDays(today, -1) ? 'yesterday' : 'a few days ago'}. If you've already paid it, mark it paid. If not, that's okay, pick a day to pay it.`, action: { label: 'Review bills', to: 'bills' }, tone: 'nudge' };
  const soon = upcomingBills(data, today, 7);
  if (soon.length >= 2) return { text: `You have ${soon.length} bills coming up this week (${formatMoney(sum(soon.map((o) => o.bill.amount)), cur)} in total). Review them before your next paycheck.`, action: { label: 'See upcoming bills', to: 'bills' }, tone: 'calm' };
  if (soon.length === 1) return { text: `${soon[0].bill.name} is due soon. One quick look now saves a worry later.`, action: { label: 'See bill', to: 'bills' }, tone: 'calm' };
  const latest = data.transactions.filter((t) => t.type === 'income' && t.date <= today && diffDays(t.date, today) <= 14).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latest) { const s = allocationSummary(data, latest.id, latest.amount); if (s.allocated === 0) return { text: `Give your ${latest.name} paycheck a plan. Decide what goes to bills, savings and spending.`, action: { label: 'Plan my paycheck', to: 'paycheck' }, tone: 'calm' }; }
  const over = budgetLines(data, currentMonthKey(data, today)).find((l) => l.state === 'over');
  if (over) return { text: `${over.name} is a little over its limit this month. No stress: you can move money from another category or adjust the limit.`, action: { label: 'Open budget', to: 'budget' }, tone: 'calm' };
  const loggedToday = data.transactions.some((t) => t.type === 'expense' && t.date === today) || data.checkIns.some((c) => c.date === today && c.loggedSpending);
  if (!loggedToday) return { text: "Log today's spending. Even one coffee counts, and it only takes a few seconds.", action: { label: 'Add expense', to: '#add-expense' }, tone: 'calm' };
  return { text: "You're up to date for today. Your progress matters, and you can come back tomorrow.", tone: 'win' };
}

export const prevMonthKey = (key: string) => shiftMonthKey(key, -1);
