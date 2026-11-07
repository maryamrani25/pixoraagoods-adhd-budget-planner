// Mutations used inside store.update(). Each takes the draft data and changes it in place.
import type { AppData, Bill, ISODate, Transaction } from './types';
import { uid } from './defaults';
import { expectedPaychecks } from './calc';
import { addDays } from './dates';

export function addTx(d: AppData, t: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
  const tx = { ...t, id: uid(), createdAt: Date.now() } as Transaction; d.transactions.push(tx); return tx;
}
export function updateTx(d: AppData, id: string, patch: Partial<Transaction>) {
  const i = d.transactions.findIndex((t) => t.id === id); if (i >= 0) d.transactions[i] = { ...d.transactions[i], ...patch };
}
export function deleteTx(d: AppData, id: string) {
  d.transactions = d.transactions.filter((t) => t.id !== id);
  d.paycheckPlans = d.paycheckPlans.filter((p) => p.key !== id);
}

/** Marks one bill occurrence as paid. Creates exactly one linked record (expense, or debt payment if linked to a debt). */
export function markBillPaid(d: AppData, bill: Bill, due: ISODate, paidOn: ISODate, amount = bill.amount) {
  if (d.transactions.some((t) => t.billId === bill.id && t.billDue === due)) return;
  if (bill.linkedDebtId && d.debts.some((x) => x.id === bill.linkedDebtId)) {
    addTx(d, { type: 'debt', name: bill.name, amount, date: paidOn, debtId: bill.linkedDebtId, debtAction: 'payment', billId: bill.id, billDue: due, affectsCash: true });
  } else {
    addTx(d, { type: 'expense', name: bill.name, amount, date: paidOn, categoryId: bill.categoryId || 'other', paymentMethod: 'Bank transfer', billId: bill.id, billDue: due, affectsCash: true });
  }
}
export function unmarkBillPaid(d: AppData, billId: string, due: ISODate) {
  d.transactions = d.transactions.filter((t) => !(t.billId === billId && t.billDue === due));
}

/** Finds the nearest expected paycheck from a source (within 7 days) that hasn't been received yet. */
export function matchExpected(d: AppData, sourceId: string, date: ISODate): ISODate | undefined {
  const list = expectedPaychecks(d, addDays(date, -7), addDays(date, 7)).filter((p) => p.source.id === sourceId && !p.received);
  list.sort((a, b) => Math.abs(new Date(a.date).getTime() - new Date(date).getTime()) - Math.abs(new Date(b.date).getTime() - new Date(date).getTime()));
  return list[0]?.date;
}

export function deleteCategory(d: AppData, id: string) {
  if (id === 'other') return;
  for (const t of d.transactions) if (t.categoryId === id) t.categoryId = 'other';
  for (const b of d.bills) if (b.categoryId === id) b.categoryId = 'other';
  for (const k of Object.keys(d.budgets)) delete d.budgets[k][id];
  d.categories = d.categories.filter((c) => c.id !== id);
}
export function deleteGoal(d: AppData, id: string) {
  d.goals = d.goals.filter((g) => g.id !== id);
  d.transactions = d.transactions.filter((t) => !(t.type === 'savings' && t.goalId === id));
}
export function deleteDebt(d: AppData, id: string) {
  d.debts = d.debts.filter((g) => g.id !== id);
  d.transactions = d.transactions.filter((t) => !(t.type === 'debt' && t.debtId === id));
  for (const b of d.bills) if (b.linkedDebtId === id) b.linkedDebtId = undefined;
}
export function deleteBill(d: AppData, id: string) {
  d.bills = d.bills.filter((b) => b.id !== id);
  for (const t of d.transactions) if (t.billId === id) { t.billId = undefined; t.billDue = undefined; } // keep payment history
}
