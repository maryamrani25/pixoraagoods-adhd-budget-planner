// Fictional US sample data for the public demo. Dates are generated relative to "today"
// so the demo always looks current. Every dashboard number is calculated from these records.
import type { AppData, Transaction, Bill } from './types';
import { emptyData, uid } from './defaults';
import { addDays, monthKeyOf, shiftMonthKey, toISO, parseISO, daysInMonth } from './dates';

const c = (dollars: number) => Math.round(dollars * 100);

export function buildDemoData(today: string): AppData {
  const d = emptyData();
  d.isDemo = true;
  d.settings = { ...d.settings, name: 'Alex', onboarded: true, payFrequency: 'twice-monthly', theme: d.settings.theme };
  const cur = monthKeyOf(today);
  const months = [shiftMonthKey(cur, -3), shiftMonthKey(cur, -2), shiftMonthKey(cur, -1), cur];
  const start = `${months[0]}-01`;
  const dayIn = (key: string, day: number) => { const [y, m] = key.split('-').map(Number); return toISO(new Date(y, m - 1, Math.min(day, daysInMonth(y, m - 1)), 12)); };
  const now = Date.now();
  const tx: Transaction[] = [];
  const add = (t: Omit<Transaction, 'id' | 'createdAt' | 'affectsCash'> & { affectsCash?: boolean }) => { if (t.date <= today) tx.push({ id: uid(), createdAt: now, affectsCash: true, ...t }); };

  // Income: salary twice a month, $2,000 on the 1st and 15th = $4,000 a month.
  const salary = { id: 'src-salary', name: 'Salary (Brightline Studio)', kind: 'salary' as const, amount: c(2000), frequency: 'twice-monthly' as const, anchorDate: dayIn(months[0], 1), secondDay: 15, active: true };
  d.incomeSources = [salary];

  // Savings goals
  d.goals = [
    { id: 'goal-emergency', name: 'Emergency Fund', target: c(5000), targetDate: addDays(today, 365), monthlyPlan: c(300), contributionDay: 2, color: '#648A72', createdAt: now },
    { id: 'goal-vacation', name: 'Beach Vacation', target: c(1500), targetDate: addDays(today, 240), monthlyPlan: 0, color: '#D6B68F', createdAt: now },
    { id: 'goal-laptop', name: 'New Laptop', target: c(1200), monthlyPlan: 0, color: '#765477', createdAt: now },
  ];
  const opening = addDays(start, -1);
  tx.push({ id: uid(), createdAt: now, type: 'savings', name: 'Starting balance', amount: c(1200), date: opening, goalId: 'goal-emergency', direction: 'in', affectsCash: false });
  tx.push({ id: uid(), createdAt: now, type: 'savings', name: 'Starting balance', amount: c(350), date: opening, goalId: 'goal-vacation', direction: 'in', affectsCash: false });
  tx.push({ id: uid(), createdAt: now, type: 'savings', name: 'Starting balance', amount: c(180), date: opening, goalId: 'goal-laptop', direction: 'in', affectsCash: false });

  // Debts
  d.debts = [
    { id: 'debt-card', name: 'Visa Credit Card', originalBalance: c(2400), startBalance: c(1950), interestRate: 22.9, minimumPayment: c(75), dueDay: 21, createdAt: now },
    { id: 'debt-student', name: 'Student Loan', originalBalance: c(12000), startBalance: c(8640), interestRate: 5.5, minimumPayment: c(180), dueDay: 28, createdAt: now },
  ];

  // Bills ($1,515.99 a month of regular bills + the credit card payment, which is a debt payment)
  const bill = (id: string, name: string, kind: Bill['kind'], amount: number, day: number, categoryId?: string, linkedDebtId?: string): Bill =>
    ({ id, name, kind, amount: c(amount), dueDate: dayIn(months[0], day), frequency: 'monthly', categoryId, linkedDebtId, reminderDays: 3, active: true });
  d.bills = [
    bill('bill-rent', 'Rent', 'rent', 1200, 1, 'housing'),
    bill('bill-power', 'Electricity', 'electricity', 85, 12, 'utilities'),
    bill('bill-net', 'Internet', 'internet', 60, 18, 'utilities'),
    bill('bill-phone', 'Phone plan', 'phone', 45, 20, 'utilities'),
    bill('bill-stream', 'StreamBox subscription', 'subscription', 15.99, 22, 'subscriptions'),
    bill('bill-insure', 'Car insurance', 'insurance', 110, 26, 'transportation'),
    bill('bill-card', 'Visa card payment', 'credit-card', 75, 21, undefined, 'debt-card'),
  ];

  // Everyday spending: $684.01 a month. With bills that makes $2,200.00 of expenses a month.
  const everyday: [string, string, number, number, string][] = [
    ['Groceries (Fresh Market)', 'groceries', 92.40, 3, 'Debit card'], ['Bus pass top-up', 'transportation', 42.10, 6, 'Debit card'],
    ['Online course', 'education', 24.02, 5, 'Debit card'], ['Lunch with Sam', 'dining', 24.80, 8, 'Debit card'],
    ['Pharmacy', 'healthcare', 25.00, 9, 'Debit card'], ['Groceries', 'groceries', 88.15, 10, 'Debit card'],
    ['New running shoes', 'shopping', 64.99, 13, 'Debit card'], ['Pizza night', 'dining', 31.50, 15, 'Mobile wallet'],
    ['Groceries', 'groceries', 97.30, 17, 'Debit card'], ['Movie tickets', 'entertainment', 28.00, 19, 'Debit card'],
    ['Gas', 'transportation', 38.75, 20, 'Debit card'], ['Haircut', 'personal-care', 22.50, 23, 'Cash'],
    ['Groceries', 'groceries', 85.60, 24, 'Debit card'], ['Coffee & bagel', 'dining', 18.90, 27, 'Cash'],
  ];

  for (const key of months) {
    for (const day of [1, 15]) add({ type: 'income', name: salary.name, amount: salary.amount, date: dayIn(key, day), incomeKind: 'salary', sourceId: salary.id, expectedDate: dayIn(key, day) });
    for (const b of d.bills) {
      const due = dayIn(key, parseISO(b.dueDate).getDate());
      if (b.linkedDebtId) add({ type: 'debt', name: b.name, amount: b.amount, date: due, debtId: b.linkedDebtId, debtAction: 'payment', billId: b.id, billDue: due });
      else add({ type: 'expense', name: b.name, amount: b.amount, date: due, categoryId: b.categoryId, paymentMethod: 'Bank transfer', billId: b.id, billDue: due });
    }
    for (const [name, cat, amt, day, pm] of everyday) add({ type: 'expense', name, amount: c(amt), date: dayIn(key, day), categoryId: cat, paymentMethod: pm });
    for (const day of [2, 16]) add({ type: 'savings', name: 'Move to Emergency Fund', amount: c(150), date: dayIn(key, day), goalId: 'goal-emergency', direction: 'in' });
    add({ type: 'debt', name: 'Student loan payment', amount: c(180), date: dayIn(key, 28), debtId: 'debt-student', debtAction: 'payment' });
    d.budgets[key] = {
      housing: c(1200), groceries: c(400), transportation: c(220), utilities: c(200), healthcare: c(50), shopping: c(80),
      entertainment: c(40), 'personal-care': c(40), education: c(30), subscriptions: c(20), dining: c(90), other: c(50),
    };
  }
  tx.push({ id: uid(), createdAt: now, type: 'savings', name: 'Birthday money (gift, straight to savings)', amount: c(100), date: dayIn(months[1], 9), goalId: 'goal-vacation', direction: 'in', affectsCash: false });
  d.transactions = tx;

  // Balance typed in by "Alex" at the end of last month.
  d.settings.balance = { amount: c(2140), asOf: addDays(`${cur}-01`, -1) };
  d.reserves = [{ id: uid(), name: "Sam's birthday gift", amount: c(40) }];

  // A plan for the most recent paycheck
  const lastPay = [...tx].filter((t) => t.type === 'income').sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastPay) {
    const isFirst = parseISO(lastPay.date).getDate() === 1;
    d.paycheckPlans = [{ key: lastPay.id, allocations: isFirst
      ? [{ id: uid(), kind: 'bill', refId: 'bill-rent', label: 'Rent', amount: c(1200) }, { id: uid(), kind: 'savings', refId: 'goal-emergency', label: 'Emergency Fund', amount: c(150) }, { id: uid(), kind: 'category', refId: 'groceries', label: 'Groceries', amount: c(180) }, { id: uid(), kind: 'category', refId: 'transportation', label: 'Transportation', amount: c(60) }, { id: uid(), kind: 'bill', refId: 'bill-power', label: 'Electricity', amount: c(85) }]
      : [{ id: uid(), kind: 'bill', refId: 'bill-card', label: 'Visa card payment', amount: c(75) }, { id: uid(), kind: 'savings', refId: 'goal-emergency', label: 'Emergency Fund', amount: c(150) }, { id: uid(), kind: 'category', refId: 'groceries', label: 'Groceries', amount: c(200) }, { id: uid(), kind: 'debt', refId: 'debt-student', label: 'Student Loan', amount: c(180) }, { id: uid(), kind: 'bill', refId: 'bill-insure', label: 'Car insurance', amount: c(110) }] }];
  }

  d.financialGoals = [
    { id: uid(), name: 'Build a 3-month emergency fund', targetDate: addDays(today, 365), completed: false, createdAt: now, milestones: [
      { id: uid(), text: 'Open a separate savings account', done: true }, { id: uid(), text: 'Save the first $1,000', done: true }, { id: uid(), text: 'Reach $2,500', done: false }, { id: uid(), text: 'Reach $5,000', done: false }] },
    { id: uid(), name: 'Pay off the Visa card', targetDate: addDays(today, 540), completed: false, createdAt: now, milestones: [
      { id: uid(), text: 'Turn on autopay for the minimum', done: true }, { id: uid(), text: 'Stop adding new charges', done: true }, { id: uid(), text: 'Pay an extra $50 a month', done: false }] },
    { id: uid(), name: 'Track my spending for 30 days', completed: false, createdAt: now, manualProgress: 60, milestones: [] },
  ];
  d.checkIns = [1, 2, 4].map((n) => ({ date: addDays(today, -n), mood: n === 4 ? 'stressed' : 'calm', loggedSpending: true }));
  d.updatedAt = now;
  return d;
}
