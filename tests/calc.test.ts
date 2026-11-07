// Unit tests for the financial calculations. Run: npm run test:unit
import { buildDemoData } from '../src/lib/demo';
import { emptyData } from '../src/lib/defaults';
import * as C from '../src/lib/calc';
import { occurrences, monthRange, monthKeyOf, addMonths, shiftMonthKey } from '../src/lib/dates';
import { parseMoney, formatMoney } from '../src/lib/money';
import { markBillPaid, unmarkBillPaid, addTx, deleteCategory } from '../src/lib/actions';
import { makeBackup, parseBackup, transactionsCSV } from '../src/lib/backup';
import type { AppData } from '../src/lib/types';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`); }
};
const clone = (d: AppData) => structuredClone(d) as AppData;

// ---- Dates ----
eq('monthly occurrences clamp to Feb 28', occurrences('2026-01-31', 'monthly', '2026-02-01', '2026-03-31'), ['2026-02-28', '2026-03-31']);
eq('biweekly occurrences', occurrences('2026-11-06', 'biweekly', '2026-11-01', '2026-12-10'), ['2026-11-06', '2026-11-20', '2026-12-04']);
eq('weekly projected backwards for pay', occurrences('2026-11-20', 'weekly', '2026-11-01', '2026-11-14', { allowBefore: true }), ['2026-11-06', '2026-11-13']);
eq('bills do not occur before start date', occurrences('2026-11-20', 'weekly', '2026-11-01', '2026-11-14'), []);
eq('twice-monthly 1st & 15th', occurrences('2026-11-01', 'twice-monthly', '2026-11-01', '2026-12-01', { secondDay: 15 }), ['2026-11-01', '2026-11-15', '2026-12-01']);
eq('twice-monthly 15th & 31st clamps', occurrences('2026-02-15', 'twice-monthly', '2026-02-01', '2026-02-28', { secondDay: 31, allowBefore: true }), ['2026-02-15', '2026-02-28']);
eq('quarterly', occurrences('2026-01-10', 'quarterly', '2026-01-01', '2026-12-31'), ['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']);
eq('yearly', occurrences('2025-03-05', 'yearly', '2026-01-01', '2027-12-31'), ['2026-03-05', '2027-03-05']);
eq('once', occurrences('2026-05-05', 'once', '2026-01-01', '2026-12-31'), ['2026-05-05']);
eq('financial month starting on 15th', monthRange('2026-11', 15), { from: '2026-11-15', to: '2026-12-14' });
eq('date before start day belongs to previous month', monthKeyOf('2026-11-10', 15), '2026-10');
eq('calendar month', monthRange('2026-02', 1), { from: '2026-02-01', to: '2026-02-28' });
eq('addMonths keeps day 31 intent', addMonths('2026-01-31', 2, 31), '2026-03-31');

// ---- Money ----
eq('parse 1,234.56', parseMoney('1,234.56'), 123456);
eq('parse $20', parseMoney('$20'), 2000);
eq('parse 0.1 + rounding', parseMoney('0.105'), 11);
eq('parse invalid', parseMoney('abc'), null);
eq('parse two dots', parseMoney('1.2.3'), null);
eq('parse negative', parseMoney('-50'), -5000);
eq('format USD', formatMoney(123456, 'USD'), '$1,234.56');
eq('format GBP', formatMoney(5000, 'GBP'), '£50.00');
eq('no negative zero', formatMoney(-0, 'USD'), '$0.00');

// ---- Demo data consistency (fixed "today": 7 Nov 2026) ----
const today = '2026-11-07';
const demo = buildDemoData(today);
for (const k of ['2026-08', '2026-09', '2026-10']) {
  const t = C.monthTotals(demo, k);
  eq(`demo ${k} income $4,000`, t.income, 400000);
  eq(`demo ${k} expenses $2,200`, t.expenses, 220000);
  eq(`demo ${k} savings $300`, t.savedNet, 30000);
  eq(`demo ${k} debt payments $255`, t.debtPaid, 25500);
}
const nov = C.monthTotals(demo, '2026-11');
eq('demo Nov income so far', nov.income, 200000);
eq('demo Nov expenses so far', nov.expenses, 120000 + 9240 + 4210 + 2402);
eq('demo available funds', C.availableFunds(demo, today), 214000 + 200000 - 135852 - 15000);
const s = C.safeToSpend(demo, today);
eq('safe-to-spend horizon is next payday', s.horizonEnd, '2026-11-15');
eq('reserved bills (Electricity)', s.billsTotal, 8500);
eq('planned savings not yet moved', s.savingsTotal, 15000);
eq('other reserved (gift)', s.otherTotal, 4000);
eq('safe-to-spend', s.safe, 263148 - 8500 - 15000 - 4000);
eq('expected income listed, not counted', s.expected.map((p) => p.date), ['2026-11-15']);
eq('demo debt balances', demo.debts.map((d) => C.debtBalance(demo, d)), [172500, 810000]);
eq('demo emergency fund', C.goalSaved(demo, 'goal-emergency'), 225000);
eq('demo next payday', C.nextPayday(demo, today)?.date, '2026-11-15');

// ---- No double counting when a bill is paid ----
{
  const d = clone(demo);
  const before = C.safeToSpend(d, today);
  const bill = d.bills.find((b) => b.id === 'bill-power')!;
  markBillPaid(d, bill, '2026-11-12', today);
  markBillPaid(d, bill, '2026-11-12', today); // clicking twice must not add twice
  const after = C.safeToSpend(d, today);
  eq('paid bill: one record only', d.transactions.filter((t) => t.billId === bill.id && t.billDue === '2026-11-12').length, 1);
  eq('paid bill: available drops by bill amount', (before.available ?? 0) - (after.available ?? 0), 8500);
  eq('paid bill: no longer reserved', after.billsTotal, 0);
  eq('paid bill: safe-to-spend unchanged', after.safe, before.safe);
  unmarkBillPaid(d, bill.id, '2026-11-12');
  eq('unmark restores', C.safeToSpend(d, today).safe, before.safe);
}
// ---- Linked debt bill reduces debt, not spending ----
{
  const d = clone(demo);
  const bill = d.bills.find((b) => b.id === 'bill-card')!;
  const exp = C.monthTotals(d, '2026-11').expenses;
  markBillPaid(d, bill, '2026-11-21', today);
  eq('debt bill not an expense', C.monthTotals(d, '2026-11').expenses, exp);
  eq('debt bill lowers balance', C.debtBalance(d, d.debts[0]), 172500 - 7500);
}
// ---- Savings transfers are not expenses, and opening balances do not touch cash ----
{
  const d = clone(demo);
  const exp = C.monthTotals(d, '2026-11').expenses; const avail = C.availableFunds(d, today)!;
  addTx(d, { type: 'savings', name: 'x', amount: 10000, date: today, goalId: 'goal-vacation', direction: 'in', affectsCash: true });
  eq('savings transfer: expenses unchanged', C.monthTotals(d, '2026-11').expenses, exp);
  eq('savings transfer: available drops', C.availableFunds(d, today), avail - 10000);
  addTx(d, { type: 'savings', name: 'opening', amount: 50000, date: today, goalId: 'goal-laptop', direction: 'in', affectsCash: false });
  eq('opening balance: available unchanged', C.availableFunds(d, today), avail - 10000);
  addTx(d, { type: 'savings', name: 'out', amount: 2500, date: today, goalId: 'goal-vacation', direction: 'out', affectsCash: true });
  eq('withdrawal adds cash back', C.availableFunds(d, today), avail - 7500);
}
// ---- Missing info is explained, not guessed ----
{
  const d = emptyData();
  const r = C.safeToSpend(d, today);
  eq('no balance: not ready', r.ready, false);
  eq('no balance: safe is null', r.safe, null);
  eq('no balance: explains', r.missing.length >= 1, true);
}
// ---- Future-dated records do not count yet ----
{
  const d = clone(demo); const avail = C.availableFunds(d, today);
  addTx(d, { type: 'expense', name: 'future', amount: 99999, date: '2026-11-20', categoryId: 'other', affectsCash: true });
  eq('future expense not in available', C.availableFunds(d, today), avail);
}
// ---- Budget states ----
{
  const d = clone(demo);
  const lines = C.budgetLines(d, '2026-10');
  const g = lines.find((l) => l.categoryId === 'groceries')!;
  eq('groceries Oct spent', g.spent, 36345);
  eq('groceries Oct remaining', g.remaining, 40000 - 36345);
  eq('groceries Oct state near (91%)', g.state, 'near');
  eq('housing at limit', lines.find((l) => l.categoryId === 'housing')!.state, 'at');
  addTx(d, { type: 'expense', name: 'big shop', amount: 5000, date: '2026-10-30', categoryId: 'groceries', affectsCash: true });
  eq('groceries over', C.budgetLines(d, '2026-10').find((l) => l.categoryId === 'groceries')!.state, 'over');
  const sum = C.budgetSummary(demo, '2026-10');
  eq('planned total', sum.planned, 242000);
  eq('all Oct spending in budgeted categories', sum.spentInBudgeted, 220000);
}
// ---- Category delete moves expenses to Other ----
{
  const d = clone(demo); const before = C.monthTotals(d, '2026-10').expenses;
  deleteCategory(d, 'dining');
  eq('category removed', d.categories.some((c) => c.id === 'dining'), false);
  eq('totals unchanged after category delete', C.monthTotals(d, '2026-10').expenses, before);
  eq('dining moved to other', C.categorySpend(d, '2026-10-01', '2026-10-31').other, 2480 + 3150 + 1890);
}
// ---- Debt payoff estimate ----
eq('payoff no interest', C.payoffEstimate(100000, 0, 10000), { months: 10, interest: 0 });
eq('payoff impossible when interest > payment', C.payoffEstimate(1000000, 24, 1000), null);
eq('snowball order', C.debtOrder(demo, 'snowball').map((x) => x.debt.id), ['debt-card', 'debt-student']);
eq('avalanche order', C.debtOrder(demo, 'avalanche').map((x) => x.debt.id), ['debt-card', 'debt-student']);
// ---- Paycheck allocations ----
{
  const pay = demo.transactions.filter((t) => t.type === 'income').sort((a, b) => b.date.localeCompare(a.date))[0];
  const a = C.allocationSummary(demo, pay.id, pay.amount);
  eq('allocated sum', a.allocated, 120000 + 15000 + 18000 + 6000 + 8500);
  eq('unallocated', a.unallocated, 200000 - 167500);
}
// ---- Month start on 15th changes totals window ----
{
  const d = clone(demo); d.settings.monthStartDay = 15;
  eq('custom month: Oct 15–Nov 14 income', C.monthTotals(d, '2026-10').income, 400000);
}
// ---- Reports: annual totals ----
{
  const series = C.monthlySeries(demo, '2026-08', '2026-10');
  eq('3-month income', series.reduce((a, b) => a + b.income, 0), 1200000);
  eq('debt series at month end', series.map((x) => x.debt), [1033500, 1008000, 982500]);
}
// ---- Backup round trip & validation ----
{
  const text = makeBackup(demo);
  const r = parseBackup(text);
  eq('backup restores', r.ok && r.data.transactions.length, demo.transactions.length);
  eq('backup keeps totals', r.ok && C.safeToSpend(r.data, today).safe, C.safeToSpend(demo, today).safe);
  eq('rejects random JSON', parseBackup('{"a":1}').ok, false);
  eq('rejects non JSON', parseBackup('hello').ok, false);
  const bad = JSON.parse(text); bad.data.transactions.push({ type: 'expense', amount: 'lots', date: 'x' });
  const rb = parseBackup(JSON.stringify(bad));
  eq('skips invalid records', rb.ok && rb.counts['skipped (invalid) records'], 1);
  eq('csv has header + rows', transactionsCSV(demo).split('\n').length, demo.transactions.length + 1);
}
eq('shiftMonthKey across year', shiftMonthKey('2026-01', -1), '2025-12');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
